import { sendMessage, sendData } from '../../sockets';
import { ITranscriptionJob } from '../../../types';
import { CaptionSettings, RecroppedVideoFrame, WordBaseEdited } from '../../../types/video-ai-data';
import { tryCatchError } from '../footage-generation';
import { Notification } from '../../../models/notification';
import { getFocusedSegments } from './utils/get-focused-segments';
import { getSentences } from './utils/get-sentences';
import { infographicDetectionAgent } from './agents/infographic-detection.agent';
import { generateInfographicSegments } from './utils/generate-infographic-segments';
import type { Segment } from 'shared/types';
import transcriptionJobRepository from '../../../repositories/transcription-job.repository';
import videoAIDataRepository from '../../../repositories/video-ai-data.repository';
import { IVideoAIData } from '../../../types/video-ai-data';
import { getElevenLabsMusic } from '../../ai/elevenlabs';
import { formatTranscriptionWords } from '../../../utils/formatter';
import { v4 as uuidv4 } from 'uuid';
import { uploadToS3 } from '../../storage/s3';
import { getS3FileUrl } from '../../../config/storage';
import { safelyDelete } from '../../fs';
import { generateMusicPrompt, analyzeVideoContent } from '../../../agents/music-prompt.agent';
import generatedMusicRepository from '../../../repositories/generated-music.repository';
import { logger } from 'server/services/logging';
/**
 * Trims b-roll segments so they don't overlap with infographic segments.
 * If a b-roll segment partially overlaps a range it is clipped; if it is
 * fully contained within a range it is dropped entirely.
 */
export function trimBrollOverlaps(brollSegments: Segment[], infographicSegments: Segment[]): Segment[] {
  if (!infographicSegments.length) return brollSegments;

  const infographicRanges = infographicSegments.map(s => ({ start: s.timeStart, end: s.timeEnd }));

  const trimmed: Segment[] = [];
  for (const seg of brollSegments) {
    let { timeStart, timeEnd } = seg;

    for (const range of infographicRanges) {
      if (timeStart >= timeEnd) break;

      // Broll starts inside an infographic range — push start to after it
      if (timeStart >= range.start && timeStart < range.end) {
        timeStart = range.end;
      }
      // Broll end falls inside an infographic range — clip to before it
      else if (timeEnd > range.start && timeEnd <= range.end) {
        timeEnd = range.start;
      }
      // Broll fully covers an infographic range — clip end to before it
      else if (timeStart < range.start && timeEnd > range.end) {
        timeEnd = range.start;
      }
    }

    if (timeEnd - timeStart > 0.1) {
      trimmed.push({ ...seg, timeStart, timeEnd });
    }
  }
  return trimmed;
}

export const generateFootageSuggestions = async ({
  transcript,
  formattedTranscript,
  description,
  guidance,
  libraries = { pexels: false },
  userId,
  privateLibraryIds,
  publicLibraryIds,
  videoUrl,
  systemPrompt,
  selectedTags,
  title,
  isTalkingHead,
  includeMusic,
  musicPrompt,
  tj,
  totalDuration,
  brollDuration,
  useVideoEmbeddings,
  isAllPublicLibrariesSelected,
  captions,
  createInfographics,
  isAudioOnly = false
}: {
  guidance: string;
  userId: string;
  description?: string;
  formattedTranscript?: string;
  videoUrl: string;
  systemPrompt?: string;
  privateLibraryIds?: string[];
  publicLibraryIds?: string[];
  selectedTags?: string[];
  libraries?: {
    pexels: boolean;
  };
  title: string;
  transcript: WordBaseEdited[];
  isTalkingHead: boolean;
  includeMusic: boolean;
  musicPrompt?: string;
  tj: ITranscriptionJob;
  totalDuration?: number;
  brollDuration: number;
  useVideoEmbeddings: boolean;
  isAllPublicLibrariesSelected?: boolean;
  captions?: CaptionSettings;
  createInfographics?: boolean;
  size?: '1080p' | '1080x1920';
  isAudioOnly?: boolean;
}): Promise<IVideoAIData | undefined> => {
  const eventId = tj._id!;

  const sentenceList = await getSentences(transcript);
  let infographicPicks: { sentenceIndex: number; dataPoints: string[]; reason: string }[] = [];
  let excludedTimeRanges: Array<{ start: number; end: number }> = [];

  if (createInfographics) {
    try {
      infographicPicks = await infographicDetectionAgent.invoke({
        transcript: transcript.map(w => w.punctuated_word ?? w.word).join(' '),
        sentences: sentenceList.map((s, i) => ({
          index: i,
          text: s.map(w => w.punctuated_word ?? w.word).join(' '),
          timeStart: s[0]?.start ?? 0,
          timeEnd: s[s.length - 1]?.end ?? 0
        }))
      });
      if (infographicPicks.length > 0) {
        excludedTimeRanges = infographicPicks.map(p => ({
          start: sentenceList[p.sentenceIndex][0]?.start ?? 0,
          end: sentenceList[p.sentenceIndex][sentenceList[p.sentenceIndex].length - 1]?.end ?? 0
        }));
      }
    } catch (detectErr) {
      logger.warn('Infographic detection failed, continuing without infographics', { error: detectErr });
    }
  }

  const infographicPromise =
    excludedTimeRanges.length > 0
      ? generateInfographicSegments({
        userId,
        sentences: sentenceList,
        selectedPicks: infographicPicks,
        transcript,
        guidance: guidance ?? '',
        title
      }).catch(err => {
        logger.error('Infographic generation failed, will backfill with broll', { error: err });
        return [] as Segment[];
      })
      : Promise.resolve([] as Segment[]);

  const [brollSegments, infographicSegments] = await Promise.all([
    getFocusedSegments({
      userId,
      libraries,
      eventId,
      guidance,
      selectedTags,
      privateLibraryIds: [...(privateLibraryIds ?? []), ...(publicLibraryIds ?? [])],
      transcript,
      totalDuration,
      systemPrompt,
      isTalkingHead,
      brollDuration,
      useVideoEmbeddings,
      isAllPublicLibrariesSelected,
      sentences: sentenceList,
      excludedTimeRanges
    }),
    infographicPromise
  ]);

  let focusedSegments: Segment[];
  if (excludedTimeRanges.length > 0 && infographicSegments.length === 0) {
    logger.warn('Infographics failed, backfilling excluded ranges with broll');
    const backfillSegments = await getFocusedSegments({
      userId,
      libraries,
      eventId,
      guidance,
      selectedTags,
      privateLibraryIds: [...(privateLibraryIds ?? []), ...(publicLibraryIds ?? [])],
      transcript,
      totalDuration,
      systemPrompt,
      isTalkingHead,
      brollDuration,
      useVideoEmbeddings,
      isAllPublicLibrariesSelected,
      sentences: sentenceList,
      includedTimeRanges: excludedTimeRanges
    });
    // Trim broll that overlaps backfill slots (same as infographic success path)
    focusedSegments = [
      ...trimBrollOverlaps(brollSegments, backfillSegments),
      ...backfillSegments
    ].sort((a, b) => a.timeStart - b.timeStart);
  } else {
    focusedSegments = [
      ...trimBrollOverlaps(brollSegments, infographicSegments),
      ...infographicSegments
    ].sort((a, b) => a.timeStart - b.timeStart);
  }
  const videoData = await tryCatchError(
    async () => {
      await sendMessage(userId, eventId, 'Someone left the camera cap on... fixing that rookie mistake!', 95); // 95%

      const videoAIDataInput: Partial<IVideoAIData> = {
        title: title,
        segments: focusedSegments,
        transcriptionJob: tj._id,
        editedWordsList: transcript,
        formattedTranscript: formattedTranscript ?? '',
        captions,
        ...(isAudioOnly
          ? { voiceOver: videoUrl }
          : {
              source: {
                url: videoUrl,
                metadata: tj.metadata!,
                thumbnail: tj.thumbnailUrl ?? '',
                audio: tj.audioUrl
              }
            }),
        userId,
        description,
        publicLibraryIds,
        privateLibraryIds
      };

      const isScriptLike = tj.jobType === 'AUDIO' || tj.jobType === 'SCRIPT' || tj.jobType === 'PROMPT';
      if (isScriptLike) {
        const videoStream = tj.metadata?.streams?.find((s: { codec_type?: string }) => s.codec_type === 'video');
        const duration = videoStream
          ? parseFloat(String(videoStream.duration ?? 0))
          : (totalDuration ?? 0);
        const frameEnd = videoStream
          ? parseInt(String(videoStream.nb_frames ?? 0), 10)
          : Math.round((totalDuration ?? 0) * 30);

        if (duration > 0) {
          const recropData: RecroppedVideoFrame = {
            x1: (1920 - 1080) / 2,
            x2: 1920 - (1920 - 1080) / 2,
            y1: 0,
            y2: 1080,
            frameStart: 0,
            frameEnd,
            timeStart: 0,
            timeEnd: duration
          };
          videoAIDataInput.croppedInfo = [recropData];
        }
      }

      const savedModel = await videoAIDataRepository.create(videoAIDataInput);
      tj.status = 'COMPLETED';
      await transcriptionJobRepository.save(tj);
      return savedModel;
    },
    userId,
    eventId,
    'ERROR: Failed to fetch footage suggestions.'
  );

  return await tryCatchError(
    async () => {
      if (includeMusic) {
        await sendMessage(
          userId,
          eventId,
          `We're convincing the composer to stop playing the ukulele and focus on your soundtrack!`,
          98
        );

        try {
          // Format transcript to plain text for music generation
          const formattedTranscript = formatTranscriptionWords(transcript, true);

          // Calculate duration from transcript (get the last word's end time, or use totalDuration, or default to 30 seconds)
          const transcriptDuration =
            transcript.length > 0 ? transcript[transcript.length - 1].end : totalDuration ?? 30;

          // Convert to milliseconds for ElevenLabs API (minimum 3 seconds, maximum 300 seconds)
          const musicLengthMs = Math.max(3000, Math.min(300000, transcriptDuration * 1000));

          await sendMessage(
            userId,
            eventId,
            'Our AI music director is analyzing your content and composing the perfect instrumental soundtrack...',
            98
          );

          // Use custom music prompt if provided, otherwise generate one
          let finalMusicPrompt: string;
          let contentAnalysis: any;
          let musicPromptResponse: any;

          if (musicPrompt && musicPrompt.trim()) {
            // User provided a custom music prompt
            finalMusicPrompt = musicPrompt.trim();
            // Set defaults for metadata when using custom prompt
            contentAnalysis = { estimatedMood: 'custom', suggestedVideoType: 'other', confidence: 1.0 };
            musicPromptResponse = { prompt: finalMusicPrompt, reasoning: 'User-provided custom music style' };
            await sendMessage(userId, eventId, 'Using your custom music style to create the perfect soundtrack...', 98);
          } else {
            // Generate optimized music prompt based on content analysis
            await sendMessage(
              userId,
              eventId,
              'Our AI music director is analyzing your content and composing the perfect instrumental soundtrack...',
              98
            );

            contentAnalysis = analyzeVideoContent(formattedTranscript, title);

            musicPromptResponse = await generateMusicPrompt({
              transcript: formattedTranscript,
              title,
              duration: transcriptDuration,
              videoType: contentAnalysis.suggestedVideoType
            });

            finalMusicPrompt = musicPromptResponse.prompt;
          }

          // Generate unique filename for the music
          const musicFileName = `music_${uuidv4()}.mp3`;
          const localMusicPath = `/tmp/${musicFileName}`;

          await sendMessage(userId, eventId, 'Our AI composer is now creating your custom instrumental track...', 99);

          // Generate music using ElevenLabs with the final prompt
          const music = await getElevenLabsMusic(
            `Create purely instrumental music, no vocals, lyrics, or spoken words, ${finalMusicPrompt}`,
            musicLengthMs,
            localMusicPath
          );
          try {
            // Upload to S3
            await uploadToS3(localMusicPath, `audio/${musicFileName}`, {
              mimeType: 'audio/mpeg',
              originalName: musicFileName,
              fileSize: require('fs').statSync(localMusicPath).size,
              userId
            });

            // Get the S3 URL
            const musicUrl = getS3FileUrl(`audio/${musicFileName}`);

            // Save the new music to the GeneratedMusic collection for future reuse
            await generatedMusicRepository.create({
              userId,
              url: musicUrl,
              duration: transcriptDuration,
              prompt: finalMusicPrompt,
              reasoning: musicPromptResponse.reasoning,
              videoType: contentAnalysis.suggestedVideoType,
              estimatedMood: contentAnalysis.estimatedMood,
              confidence: contentAnalysis.confidence,
              filename: musicFileName,
              fileSize: require('fs').statSync(localMusicPath).size,
              elevenlabsMetadata: music.json.songMetadata,
              elevenlabsCompositionPlan: music.json.compositionPlan
            });

            // Add music to video data
            const updatedVideoData = await videoAIDataRepository.update(videoData._id!.toString(), {
              audio: [
                {
                  preview: musicUrl,
                  duration: transcriptDuration,
                  title: `AI Generated ${contentAnalysis.estimatedMood.charAt(0).toUpperCase() + contentAnalysis.estimatedMood.slice(1)
                    } Instrumental Music`,
                  metadata: {
                    prompt: musicPromptResponse.prompt,
                    reasoning: musicPromptResponse.reasoning,
                    videoType: contentAnalysis.suggestedVideoType,
                    estimatedMood: contentAnalysis.estimatedMood,
                    confidence: contentAnalysis.confidence
                  }
                }
              ],
              audioVolume: 0.07,
              audioEnabled: true
            });
          } finally {
            // Clean up local file
            safelyDelete(localMusicPath);
          }
        } catch (error) {
          logger.error('Error generating music:', error);
          await sendMessage(
            userId,
            eventId,
            'Our composer had a creative block, but your video is still ready! You can add music later in the editor.',
            99
          );

          // Continue without music - don't fail the entire process
          await videoAIDataRepository.update(videoData._id!.toString(), {
            audioEnabled: false
          });
        }
      }

      await sendData(userId, eventId, { _id: videoData._id, isHighlight: false, isBroll: true });
      await new Notification({
        userId,
        type: 'VIDEO_COMPLETE',
        title: 'Video Generated!',
        message: `Video ${title ?? 'Untitled Video'} is ready to view and edit!`,
        links: [{ linkType: 'VIDEO', docId: videoData._id }]
      }).save();

      return videoData;
    },
    userId,
    eventId,
    'ERROR: Failed to fetch audio suggestions.'
  );
};
