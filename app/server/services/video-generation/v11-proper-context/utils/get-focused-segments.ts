import { Segment, WordBaseEdited, Alternative } from '../../../../types/video-ai-data';
import { sendMessage } from '../../../sockets';
import { getContextForSentence } from './get-sentence-context';
import { generateSearchTermForSentence } from './get-search-term-sentence';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../logging';
import { overlayAnalysisAgent } from '../agents/overlay-analysis.agent';
import { brollImagePromptAgent } from '../agents/broll-image-prompt.agent';
import { searchLibrary } from './library-search';
import { getSentences } from './get-sentences';
import { getTheFinalSolution } from './get-final-solution';
import { ThumbnailDuplicateDetector } from './thumbnail-duplicate-detector';
import { totalContextAnalysisAgent } from '../agents/total-context-analysis.agent';
import { runFluxPredictionUrl } from '../../../replicate.service';
import { uploadToS3 } from '../../../storage/s3';
import { getS3FileUrl } from '../../../../config/storage';
import { downloadFile, safelyDelete } from '../../../fs';
import fs from 'fs';
const RE_SEARCH_THRESHOLD = 30;

export const searchAndRank = async ({
  firstSearchPrompt,
  secondSearchPrompt,
  vectorSearchPrompt,
  formattedSentence,
  context,
  userId,
  selectedTags = [],
  privateLibraryIds,
  existingPineconeIds,
  libraries,
  useVideoEmbeddings = true,
  enableDuplicateDetection = true,
  previouslyUsedAlternatives = [],
  isAllPublicLibrariesSelected = false,
  includeVectorInOutput = false,
  filterOnlyBroll = false
}: {
  firstSearchPrompt: string;
  secondSearchPrompt: string;
  vectorSearchPrompt: string;
  formattedSentence: string;
  context: string;
  userId: string;
  selectedTags?: string[];
  privateLibraryIds: string[];
  existingPineconeIds: string[];
  libraries: { pexels: boolean };
  useVideoEmbeddings?: boolean;
  enableDuplicateDetection?: boolean;
  previouslyUsedAlternatives?: Alternative[];
  isAllPublicLibrariesSelected?: boolean;
  includeVectorInOutput?: boolean;
  filterOnlyBroll?: boolean;
}) => {
  const [[alternatives, keywords], pexelsResults, pineconeResults] = await searchLibrary({
    firstSearchPrompt,
    secondSearchPrompt,
    vectorSearchPrompt,
    userId,
    selectedTags: selectedTags ?? [],
    privateLibraryIds: privateLibraryIds ?? [],
    existingPineconeIds,
    libraries,
    useVideoEmbeddings,
    isAllPublicLibrariesSelected,
    includeVectorInOutput,
    filterOnlyBroll
  });

  const allResults = [...pineconeResults, ...alternatives, ...pexelsResults];

  let finalUniqueAlternatives = allResults;

  // Detect and filter out duplicate thumbnails if enabled
  if (enableDuplicateDetection && allResults.length > 1) {
    const { uniqueAlternatives } = await ThumbnailDuplicateDetector.detectDuplicates(
      previouslyUsedAlternatives,
      allResults
    );
    finalUniqueAlternatives = uniqueAlternatives;
  }

  // Use the filtered alternatives for ranking
  // const photosToRank = [
  //   finalUniqueAlternatives.find(r => pineconeResults.some(p => p.dbId === r.dbId))?.thumbnailUrl,
  //   finalUniqueAlternatives.find(r => alternatives.some(a => a.dbId === r.dbId))?.thumbnailUrl,
  //   finalUniqueAlternatives.find(r => pexelsResults.some(p => p.dbId === r.dbId))?.thumbnailUrl
  // ].filter((url): url is string => Boolean(url));

  return finalUniqueAlternatives;

  // const rankedIndex = await overlayRankingAgent(formattedSentence, context, photosToRank);
  // const rankedPhotoIndex = finalUniqueAlternatives.findIndex(r => r.thumbnailUrl === photosToRank[rankedIndex]);
  // let rankedAlternatives = [...finalUniqueAlternatives.splice(rankedPhotoIndex, 1), ...finalUniqueAlternatives];

  // return rankedAlternatives;
};

export async function getFocusedSegments({
  userId,
  eventId,
  selectedTags,
  privateLibraryIds,
  libraries = { pexels: false },
  transcript,
  guidance,
  isTalkingHead,
  totalDuration,
  brollDuration,
  useVideoEmbeddings,
  enableDuplicateDetection = true,
  isAllPublicLibrariesSelected = false,
  sentences,
  excludedTimeRanges,
  includedTimeRanges
}: {
  userId: string;
  eventId: string;
  selectedTags?: string[];
  privateLibraryIds?: string[];
  isTalkingHead: boolean;
  libraries?: {
    pexels: boolean;
  };
  transcript: WordBaseEdited[];
  guidance: string;
  systemPrompt?: string;
  brollDuration: number;
  totalDuration?: number;
  useVideoEmbeddings: boolean;
  enableDuplicateDetection?: boolean;
  isAllPublicLibrariesSelected?: boolean;
  /** Pre-computed sentences; if not provided, getSentences(transcript) is called */
  sentences?: WordBaseEdited[][];
  /** Time ranges to skip (e.g. reserved for infographics); sentences inside these ranges produce no broll */
  excludedTimeRanges?: Array<{ start: number; end: number }>;
  /** When set, only process sentences that overlap these ranges (used for broll backfill when infographics fail) */
  includedTimeRanges?: Array<{ start: number; end: number }>;
}) {
  await sendMessage(
    userId,
    eventId,
    'Playing hundreds of videos to our team of squirrels. They are choosing the best ones for you...',
    30
  );

  const results: Segment[] = [];
  const transcriptEnd = transcript[transcript.length - 1]?.end ?? 0;
  const existingPineconeIds: string[] = [];
  const sentenceAccumulator: string[] = [];
  const incrementTime = Math.max(brollDuration, 0.5);
  const globalContext = await totalContextAnalysisAgent.invoke({
    transcript: transcript.map(w => w.punctuated_word ?? w.word).join(' ')
  });
  // Track previously used alternatives to prevent duplicates across segments
  const previouslyUsedAlternatives: Alternative[] = [];

  const sentenceList = sentences ?? (await getSentences(transcript));
  let startTime = 0;

  for (const sentence of sentenceList) {
    const nextSentence = sentenceList[sentenceList.indexOf(sentence) + 1];
    const desiredEndTime =
      nextSentence?.[0]?.start !== undefined ? nextSentence[0].start : totalDuration ?? transcriptEnd;
    const desiredDuration = desiredEndTime - startTime;
    const sentenceStart = sentence[0]?.start ?? 0;
    const sentenceEnd = sentence[sentence.length - 1]?.end ?? 0;

    if (excludedTimeRanges?.length) {
      const isExcluded = excludedTimeRanges.some(
        range => sentenceStart >= range.start && sentenceEnd <= range.end
      );
      if (isExcluded) {
        startTime = desiredEndTime;
        continue;
      }
    }

    if (includedTimeRanges?.length) {
      const isIncluded = includedTimeRanges.some(
        range =>
          (sentenceStart >= range.start && sentenceStart < range.end) ||
          (sentenceEnd > range.start && sentenceEnd <= range.end) ||
          (sentenceStart <= range.start && sentenceEnd >= range.end)
      );
      if (!isIncluded) {
        startTime = desiredEndTime;
        continue;
      }
    }

    if (desiredDuration < 2) {
      logger.debug('SEGMENT TOO SHORT');
    }
    const sentenceToProcess = sentence.filter((w: WordBaseEdited) => w.start && w.start >= startTime);
    const formattedSentence = sentenceToProcess
      .map((w: WordBaseEdited) => w.punctuated_word ?? w.word)
      .join(' ');
    const context = getContextForSentence(transcript, startTime, desiredEndTime);

    if (sentence.length === 0) {
      startTime += incrementTime;
      continue;
    }
    // Search Term Generation: Get the search terms for the sentence
    const segment = await generateSearchTermForSentence(
      sentence,
      sentenceAccumulator,
      context,
      startTime,
      isTalkingHead,
      globalContext,
      guidance
    );
    if (segment !== null) {
      let firstSearchTerm = segment.first_search_prompt;
      let secondSearchTerm = segment.second_search_prompt;
      let vectorSearchTerm = segment.vector_search_prompt;
      logger.debug('formatted sentence ' + formattedSentence);
      logger.debug('context ' + context);
      // Overlay Analysis: Get the broll for the sentence
      let rankedAlternatives = await searchAndRank({
        firstSearchPrompt: firstSearchTerm,
        secondSearchPrompt: secondSearchTerm,
        vectorSearchPrompt: vectorSearchTerm,
        formattedSentence,
        context,
        userId,
        selectedTags: selectedTags ?? [],
        privateLibraryIds: privateLibraryIds ?? [],
        existingPineconeIds,
        libraries,
        useVideoEmbeddings,
        enableDuplicateDetection,
        previouslyUsedAlternatives,
        isAllPublicLibrariesSelected,
        filterOnlyBroll: true
      });
      let rankedAlternativesFinal = getTheFinalSolution(rankedAlternatives, desiredDuration);

      if (!rankedAlternativesFinal.length) {
        continue;
      }
      const brollScore = await overlayAnalysisAgent({
        script: formattedSentence,
        brollThumbnailUrl: rankedAlternatives?.[0]?.thumbnailUrl,
        context
      });
      const score = parseInt(brollScore) || 50;
      if (isNaN(score)) {
        // TODO: Log this error
        throw new Error('Overlay analysis agent returned an invalid score');
      } else {
        if (score < RE_SEARCH_THRESHOLD) {
          // Generate AI photo instead of re-searching
          const imagePrompt = await brollImagePromptAgent.invoke({
            script: formattedSentence,
            context,
            guidance
          });

          const fluxOutput = await runFluxPredictionUrl({
            prompt: imagePrompt,
            aspect_ratio: '16:9',
            output_format: 'png'
          });

          const urlOrString = typeof fluxOutput?.url === 'function' ? fluxOutput.url() : (fluxOutput as any)?.url;
          const imageUrlFromFlux = typeof urlOrString === 'string' ? urlOrString : (urlOrString as URL)?.toString?.() ?? '';
          const tmpPath = `/tmp/${Date.now()}-ai-broll.png`;
          await downloadFile(tmpPath, imageUrlFromFlux);
          const s3Key = `users/${userId}/ai-broll-${Date.now()}.png`;
          await uploadToS3(tmpPath, s3Key, {
            mimeType: 'image/png',
            originalName: s3Key,
            fileSize: fs.statSync(tmpPath).size,
            userId
          });
          safelyDelete(tmpPath);
          const imageUrl = getS3FileUrl(s3Key);

          const aiPhotoAlternative: Alternative = {
            link: imageUrl,
            preview: imageUrl,
            thumbnailUrl: imageUrl,
            title: imagePrompt,
            duration: desiredDuration,
            offsetStart: 0,
            isVisible: true,
            isFocused: true,
            score: 100,
            type: 'pinecone',
            id: 0,
            brollType: 'AI_PHOTO'
          };

          rankedAlternativesFinal = [
            {
              alternative: aiPhotoAlternative,
              bounds: [0, desiredDuration]
            }
          ];
        }
      }

      let timeStart = startTime;
      const segments: Segment[] = [];
      for (const a of rankedAlternativesFinal) {
        segments.push({
          segmentId: uuidv4(),
          timeStart: Math.max(timeStart, 0),
          timeEnd: timeStart + (a.bounds[2] ?? a.bounds[1]),
          alternatives: [
            a.alternative,
            ...rankedAlternatives
              .filter(r => (r.dbId && r.dbId !== a.alternative.dbId) || (r.id && r.id !== a.alternative.id))
              .slice(1)
          ],
          keywords: `${firstSearchTerm},${secondSearchTerm},${vectorSearchTerm}`
        });

        // Add the focused (first) alternative to the previously used list
        if (a.alternative) {
          previouslyUsedAlternatives.push(a.alternative);
        }

        timeStart += a.bounds[2] ?? a.bounds[1];
      }

      results.push(...segments);
      const dbIds = rankedAlternativesFinal.map(a => a.alternative.dbId).filter(a => a !== undefined);
      if (dbIds.length > 0) {
        existingPineconeIds.push(...dbIds);
      }
      startTime = results[results.length - 1].timeEnd;

      sentenceAccumulator.push(`${firstSearchTerm},${secondSearchTerm},${vectorSearchTerm}`);
    } else {
      startTime += incrementTime;
    }
    const percentComplete = 30 + Math.round((startTime / transcriptEnd) * (90 - 30));
    await sendMessage(userId, eventId, getProgressMessage(percentComplete), percentComplete);
  }

  if (totalDuration && results.length > 0) {
    const lastSegment = results[results.length - 1];
    const currentEndTime = lastSegment.timeEnd;

    if (currentEndTime < totalDuration) {
      // Get the alternatives from the last segment to fill remaining time
      const remainingDuration = totalDuration - currentEndTime;
      const lastSegmentAlternatives = lastSegment.alternatives.slice(1); // Skip the first (already used) alternative

      let timeToFill = remainingDuration;
      let currentTime = currentEndTime;
      const newSegments: Segment[] = [];

      // Only proceed if we have alternatives to work with
      if (lastSegmentAlternatives.length > 0) {
        // Recursively add alternatives until we reach totalDuration or run out
        for (const alternative of lastSegmentAlternatives) {
          if (timeToFill <= 0.1) break; // Stop if remaining time is negligible

          const alternativeDuration = alternative.duration ?? 4; // Default to 4 seconds if no duration
          const segmentDuration = Math.min(alternativeDuration, timeToFill);

          // Only create segment if duration is meaningful (at least 0.5 seconds)
          if (segmentDuration >= 0.5) {
            newSegments.push({
              segmentId: uuidv4(),
              timeStart: currentTime,
              timeEnd: currentTime + segmentDuration,
              alternatives: [
                alternative,
                ...lastSegment.alternatives.filter(
                  alt => (alt.dbId && alt.dbId !== alternative.dbId) || (alt.id && alt.id !== alternative.id)
                )
              ],
              keywords: lastSegment.keywords
            });

            currentTime += segmentDuration;
            timeToFill -= segmentDuration;
          }
        }
      }

      // Add the new segments to results
      if (newSegments.length > 0) {
        results.push(...newSegments);
      }

      // If we still haven't reached totalDuration, extend the very last segment
      if (currentTime < totalDuration && results.length > 0) {
        results[results.length - 1].timeEnd = totalDuration;
      }
    }
  }

  await sendMessage(
    userId,
    eventId,
    `Playing hundreds of videos to our team of squirrels. They are choosing the best ones for you...`,
    91
  );

  logger.info('Finished generating focused segments', {
    'User ID': userId,
    'Event ID': eventId,
    'Total Previously Used Alternatives': previouslyUsedAlternatives.length
  });
  return results;
}

const getProgressMessage = (percentComplete: number) => {
  if (percentComplete < 40) {
    return `Playing hundreds of videos to our team of squirrels. They are choosing the best ones for you...`;
  }
  if (percentComplete < 50) {
    return `Some of the squirrels fell asleep, waking them up...`;
  }
  if (percentComplete < 60) {
    return `Our squirrel army is working hard, however we are running out of peanuts... Sending the intern for more!`;
  }
  if (percentComplete < 70) {
    return `Intern came back, the squirrels are motivated again. Hope they don't ask for a pay raise, we're already maxed out on peanuts!`;
  }
  if (percentComplete < 80) {
    return `Our orangutan has entered the room and is throwing bananas at the video editor.`;
  }

  return `Alright, we're almost done. We really shouldn't have hired animals for this...`;
};
