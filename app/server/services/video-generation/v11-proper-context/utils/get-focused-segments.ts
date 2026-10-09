import { Segment, WordBaseEdited, Alternative } from '../../../../types/video-ai-data';
import { sendMessage } from '../../../sockets';
import { getContextForSentence } from './get-sentence-context';
import { generateSearchTermForSentence } from './get-search-term-sentence';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../logging';
import { PINECONE_SEARCH_LIMIT, searchLibrary } from './library-search';
import { getSentences } from './get-sentences';
import { getTheFinalSolution } from './get-final-solution';
import { ThumbnailDuplicateDetector } from './thumbnail-duplicate-detector';
import { createLimiter } from '../../../../utils/concurrency';

// Search terms are generated in order within a chain, so each prompt sees the chain's earlier terms
// (the prompt asks not to repeat footage within a paragraph). Chains end at paragraph ends or after
// this many sentences, and different chains run concurrently.
const MAX_SENTENCES_PER_TERM_CHAIN = 8;
const SEARCH_TERM_CONCURRENCY = 6;
const RETRIEVAL_CONCURRENCY = 6;
// searchVideoEmbeddingsV2 returns up to `limit * 2` rows when filterOnlyBroll is set.
const VECTOR_ROWS_PER_SENTENCE = PINECONE_SEARCH_LIMIT * 2;
// Candidates are fetched before earlier sentences have picked their clips, so over-fetch to keep
// VECTOR_ROWS_PER_SENTENCE rows after the used-clip filter applied during placement.
const PREFETCH_VECTOR_LIMIT = PINECONE_SEARCH_LIMIT * 3;
const PREFETCH_VECTOR_ROWS = PREFETCH_VECTOR_LIMIT * 2;

type SearchPrompts = { firstSearchPrompt: string; secondSearchPrompt: string; vectorSearchPrompt: string };
type PreparedSentence = {
  prompts: SearchPrompts;
  keywords: string;
  vectorRows: Alternative[];
  pexelsResults: Alternative[];
} | null;

/**
 * Picks b-roll for every sentence of the transcript.
 *
 * Network work (search-term LLM calls, vector/Pexels searches, thumbnail hashing) runs concurrently
 * per sentence. Placement then walks the sentences in order: it carries uncovered time into the next
 * sentence and never reuses a clip, exactly as a fully sequential pass would. When the prefetched
 * candidates run short after removing used clips, that sentence is re-queried excluding them.
 */
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
  const incrementTime = Math.max(brollDuration, 0.5);
  // Clips already placed; later sentences must not reuse them (by id, or by thumbnail hash).
  const usedClipIds = new Set<string>();
  const previouslyUsedAlternatives: Alternative[] = [];

  const sentenceList = sentences ?? (await getSentences(transcript));
  // A sentence's slot runs until the next sentence starts (or the end of the video).
  const desiredEndTimeOf = (index: number) => sentenceList[index + 1]?.[0]?.start ?? totalDuration ?? transcriptEnd;
  const isOutsideTimeRanges = sentenceList.map(sentence => {
    const sentenceStart = sentence[0]?.start ?? 0;
    const sentenceEnd = sentence[sentence.length - 1]?.end ?? 0;
    const isExcluded =
      excludedTimeRanges?.some(range => sentenceStart >= range.start && sentenceEnd <= range.end) ?? false;
    const isIncluded =
      !includedTimeRanges?.length ||
      includedTimeRanges.some(
        range =>
          (sentenceStart >= range.start && sentenceStart < range.end) ||
          (sentenceEnd > range.start && sentenceEnd <= range.end) ||
          (sentenceStart <= range.start && sentenceEnd >= range.end)
      );
    return isExcluded || !isIncluded;
  });
  const librarySearchOptions = {
    userId,
    selectedTags: selectedTags ?? [],
    privateLibraryIds: privateLibraryIds ?? [],
    useVideoEmbeddings,
    isAllPublicLibrariesSelected,
    filterOnlyBroll: true
  };

  // Phase 1: search terms + candidate retrieval, concurrently.
  const searchTermLimit = createLimiter(SEARCH_TERM_CONCURRENCY);
  const retrievalLimit = createLimiter(RETRIEVAL_CONCURRENCY);
  const prepared: Promise<PreparedSentence>[] = [];
  let chainSearchTerms: string[] = [];
  let chainLength = 0;
  let previousInChain: Promise<unknown> = Promise.resolve();

  for (let index = 0; index < sentenceList.length; index++) {
    const sentence = sentenceList[index];
    if (isOutsideTimeRanges[index] || sentence.length === 0) {
      continue;
    }
    const previousSearchTerms = chainSearchTerms;
    // Matches the sequential pass whenever the previous sentence filled its slot.
    const nominalStart = index === 0 ? 0 : sentence[0].start;
    const context = getContextForSentence(transcript, nominalStart, desiredEndTimeOf(index));

    const termsPromise = previousInChain
      .then(() =>
        searchTermLimit(() =>
          generateSearchTermForSentence(sentence, [...previousSearchTerms], context, nominalStart, isTalkingHead, guidance)
        )
      )
      .then(terms => {
        if (terms === null) {
          return null;
        }
        const keywords = `${terms.first_search_prompt},${terms.second_search_prompt},${terms.vector_search_prompt}`;
        previousSearchTerms.push(keywords);
        const prompts: SearchPrompts = {
          firstSearchPrompt: terms.first_search_prompt,
          secondSearchPrompt: terms.second_search_prompt,
          vectorSearchPrompt: terms.vector_search_prompt
        };
        return { prompts, keywords };
      });

    const preparedPromise: Promise<PreparedSentence> = termsPromise.then(terms =>
      terms === null
        ? null
        : retrievalLimit(async () => {
            const [, pexelsResults, vectorRows] = await searchLibrary({
              ...librarySearchOptions,
              ...terms.prompts,
              existingPineconeIds: [],
              libraries,
              vectorSearchLimit: PREFETCH_VECTOR_LIMIT
            });
            if (enableDuplicateDetection) {
              await ThumbnailDuplicateDetector.ensureHashes([...vectorRows, ...pexelsResults]);
            }
            return { ...terms, vectorRows, pexelsResults };
          })
    );
    // Failures surface when phase 2 awaits this promise. The no-op handler only stops Node from
    // flagging the rejection as unhandled while earlier sentences are still being placed.
    preparedPromise.catch(() => undefined);
    prepared[index] = preparedPromise;

    previousInChain = termsPromise;
    chainLength++;
    if (chainLength === MAX_SENTENCES_PER_TERM_CHAIN || sentence.some(w => w.isParagraphEnd)) {
      chainSearchTerms = [];
      chainLength = 0;
      previousInChain = Promise.resolve();
    }
  }

  // Phase 2: place clips in transcript order.
  let startTime = 0;
  for (let index = 0; index < sentenceList.length; index++) {
    const sentence = sentenceList[index];
    const desiredEndTime = desiredEndTimeOf(index);
    const desiredDuration = desiredEndTime - startTime;

    if (isOutsideTimeRanges[index]) {
      startTime = desiredEndTime;
      continue;
    }
    if (desiredDuration < 2) {
      logger.debug('SEGMENT TOO SHORT');
    }
    if (sentence.length === 0) {
      startTime += incrementTime;
      continue;
    }

    const preparedSentence = await prepared[index];
    if (preparedSentence !== null) {
      const { prompts, keywords, pexelsResults } = preparedSentence;
      let vectorCandidates = preparedSentence.vectorRows.filter(row => !row.dbId || !usedClipIds.has(row.dbId));
      const vectorIndexExhausted = preparedSentence.vectorRows.length < PREFETCH_VECTOR_ROWS;
      if (vectorCandidates.length >= VECTOR_ROWS_PER_SENTENCE || vectorIndexExhausted) {
        vectorCandidates = vectorCandidates.slice(0, VECTOR_ROWS_PER_SENTENCE);
      } else {
        logger.debug('Prefetched b-roll exhausted by used clips, re-querying', { sentenceIndex: index });
        [, , vectorCandidates] = await searchLibrary({
          ...librarySearchOptions,
          ...prompts,
          existingPineconeIds: [...usedClipIds],
          libraries: { pexels: false }
        });
        if (enableDuplicateDetection) {
          await ThumbnailDuplicateDetector.ensureHashes(vectorCandidates);
        }
      }

      const allResults = [...vectorCandidates, ...pexelsResults];
      const rankedAlternatives =
        enableDuplicateDetection && allResults.length > 1
          ? ThumbnailDuplicateDetector.filterUnique(previouslyUsedAlternatives, allResults)
          : allResults;
      const rankedAlternativesFinal = getTheFinalSolution(rankedAlternatives, desiredDuration);

      if (!rankedAlternativesFinal.length) {
        continue;
      }
      let timeStart = startTime;
      for (const a of rankedAlternativesFinal) {
        results.push({
          segmentId: uuidv4(),
          timeStart: Math.max(timeStart, 0),
          timeEnd: timeStart + (a.bounds[2] ?? a.bounds[1]),
          alternatives: [
            a.alternative,
            ...rankedAlternatives
              .filter(r => (r.dbId && r.dbId !== a.alternative.dbId) || (r.id && r.id !== a.alternative.id))
              .slice(1)
          ],
          keywords
        });

        previouslyUsedAlternatives.push(a.alternative);
        if (a.alternative.dbId !== undefined) {
          usedClipIds.add(a.alternative.dbId);
        }

        timeStart += a.bounds[2] ?? a.bounds[1];
      }
      startTime = results[results.length - 1].timeEnd;
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
