import { retry } from '../utils/retry-fn';
import { TranscriptionJob } from '../models/transcription-job';
import { logger } from './logging';
import { VideoGenerationEventDataV4 } from 'shared/types/event-contracts';
import { IVideoAIData, WordBaseEdited } from '../types';
import userProfileRepository from '../repositories/user-profile.repository';
import { sendData, sendError, sendMessage } from '../services/sockets';
import { uploadToS3 } from './storage/s3';
import transcriptionJobRepository from '../repositories/transcription-job.repository';
import { safelyDelete } from './fs';
import { mapFrancResultToDeepgramLanguage } from '../utils/mapping';
import { approximateMinutesFromText } from 'shared/utils/misc';
import { generateVoiceover } from './tts';
import { getMetadata } from './video-manipulation/ffmpeg';
import { tryCatchError } from '../utils/error-handling';
import mime from 'mime';
import fs from 'fs';
import automationHistoryRepository from '../repositories/automation-history.repository';
import { videoTitleSuggestionAgent } from '../agents/video-title-suggestion.agent';
import { videoDescriptionSuggestionAgent } from '../agents/video-description-suggestion.agent';
import { getS3FileUrl } from '../config/storage';
import videoAIDataRepository from '../repositories/video-ai-data.repository';
import { transcribeUrl } from './ai/deepgram';
import { RecroppedVideoFrame } from '../types';
import { analyzeAndGenerateScript } from '../agents/script-or-prompt-simple.agent';
import { getFocusedSegments } from './video-generation/v11-proper-context/utils/get-focused-segments';
import { getSentences } from './video-generation/v11-proper-context/utils/get-sentences';
import { infographicDetectionAgent } from './video-generation/v11-proper-context/agents/infographic-detection.agent';
import { generateInfographicSegments } from './video-generation/v11-proper-context/utils/generate-infographic-segments';
import type { Segment } from 'shared/types';
/**
 * Generation Processor V5 - Uses v11 Focused Segments
 *
 * Detects whether the input is a complete script or a prompt, generates the script via the agent,
 * then uses v11 getFocusedSegments to find footage.
 *
 * Flow:
 * 1. Analyze input (script vs prompt) and generate script if needed
 * 2. Generate TTS from the script
 * 3. Use getFocusedSegments to find appropriate footage
 * 4. Build VideoAIData with the segments
 * 5. Continue with normal flow (exporting, etc.)
 */
export const generationProcessorV5 = async (
  {
    guidance,
    libraries = { pexels: false }, // Disabled by default, script writer handles search
    userId,
    privateLibraryIds,
    publicLibraryIds: publicLibraryIdsFromConfig,
    script,
    isVoicePremium,
    isAllPublicLibrariesSelected,
    voiceType,
    size,
    title,
    includeMusic,
    historyKey,
    tjId,
    captions
  }: Omit<VideoGenerationEventDataV4, 'fileUrl' | 'uploadType' | 'skipScriptGeneration'>,
  tmpDir = '/tmp/data'
): Promise<IVideoAIData | undefined> => {
  const tj = await TranscriptionJob.findById(tjId);

  try {
    if (!tj) {
      logger.error('Transcription job not found', { tjId });
      return;
    }

    const ttsMinutesRemaining = await userProfileRepository.getTTSMinutesRemaining(userId);
    let history = '';

    if (historyKey) {
      const historyRecords = await automationHistoryRepository.findByChannel(historyKey, 20);
      history = historyRecords.map(video => video.script.substring(0, 300)).join('\n\n\n');
    }

    if (!script) {
      await sendError(userId, tjId, 'Script is required for this generation mode');
      transcriptionJobRepository.update(tjId, { status: 'FAILED' });
      return;
    }

    const allLibraryIds = [...(privateLibraryIds ?? []), ...(publicLibraryIdsFromConfig ?? [])];

    if (allLibraryIds.length === 0 && !isAllPublicLibrariesSelected) {
      await sendError(userId, tjId, 'At least one library is required for this generation mode');
      transcriptionJobRepository.update(tjId, { status: 'FAILED' });
      return;
    }

    // Step 1: Determine if input is a script or prompt
    sendMessage(userId, tjId, 'Analyzing your input...', 2);

    logger.info('Analyzing input to determine if script or prompt', {
      userId,
      tjId,
      inputLength: script.length,
      inputPreview: script.substring(0, 100)
    });

    const { type: inputType, script: processedInputScript } = await analyzeAndGenerateScript(script);

    logger.info('Input analysis complete', {
      userId,
      tjId,
      inputType,
      processedScriptLength: processedInputScript.length
    });

    let processedScript = processedInputScript;

    sendMessage(userId, tjId, 'Script ready! Finding footage after voiceover generation...', 5);

    logger.info('Using v11 getFocusedSegments for generation', {
      userId,
      tjId,
      scriptLength: processedScript.length,
      inputType
    });

    sendMessage(userId, tjId, 'Script ready! Generating voiceover...', 82);

    // Step 2: Check TTS limits
    if (ttsMinutesRemaining < approximateMinutesFromText(processedScript)) {
      await sendError(
        userId,
        tjId,
        `This script is approximately ${approximateMinutesFromText(
          processedScript
        )} minutes long. You have ${ttsMinutesRemaining} minutes remaining in your subscription.`
      );
      transcriptionJobRepository.update(tjId, { status: 'FAILED' });
      return;
    }

    // Step 3: Generate TTS
    const { audioPath, audioName, transcript } = await generateVoiceover(
      processedScript,
      isVoicePremium,
      voiceType,
      tmpDir
    );

    let editedWordsList: WordBaseEdited[] = transcript || [];

    const { franc } = await import('franc');
    const language = mapFrancResultToDeepgramLanguage(
      franc(processedScript, { only: ['eng', 'rus', 'spa', 'fra', 'deu', 'ita', 'bul', 'tur'] })
    );

    // Step 4: Upload audio to S3 (editor displays audio-only source when there is no source)
    const metadata = await tryCatchError(() => getMetadata(audioPath), userId, tjId, 'Error reading audio metadata.');
    if (!metadata) {
      return;
    }

    sendMessage(userId, tjId, 'Uploading audio...', 84);
    const finalFilename = `users/${userId}/${audioName}`;
    await transcriptionJobRepository.update(tjId, { filename: finalFilename });
    await uploadToS3(audioPath, finalFilename, {
      mimeType: mime.getType(audioName) || 'audio/mpeg',
      originalName: finalFilename,
      fileSize: fs.statSync(audioPath).size,
      userId: userId
    });
    const audioUrl = getS3FileUrl(finalFilename);
    safelyDelete(audioPath);

    // Step 5: Transcribe if needed (for non-premium voices)
    if (!editedWordsList?.length) {
      const results = await retry(() => transcribeUrl(audioUrl, language), {
        maxAttempts: 3,
        delayMs: 1000,
        onRetry: (error, attempt) => {
          logger.error('Error transcribing audio, retrying', {
            Error: error,
            'Audio URL': audioUrl,
            'User ID': userId,
            Attempt: attempt
          });
        }
      });

      if (!results) {
        logger.error('Error transcribing audio', {
          'Audio URL': audioUrl,
          'User ID': userId
        });
        return;
      }
      editedWordsList = results;
    }

    const totalDuration = metadata.format.duration ?? 0;

    let segments;

    sendMessage(userId, tjId, 'Finding best footage for your script...', 88);

    logger.info('Using v11 getFocusedSegments to generate segments', {
      userId,
      tjId,
      totalDuration
    });

      // Ensure we have transcription for v11
      if (!editedWordsList?.length) {
        const results = await retry(() => transcribeUrl(audioUrl, language), {
          maxAttempts: 3,
          delayMs: 1000,
          onRetry: (error, attempt) => {
            logger.error('Error transcribing audio, retrying', {
              Error: error,
              'Audio URL': audioUrl,
              'User ID': userId,
              Attempt: attempt
            });
          }
        });
        editedWordsList = results;
      }

      const sentenceList = await getSentences(editedWordsList);
      const isHorizontal = size === '1080p';
      let infographicPicks: { sentenceIndex: number; dataPoints: string[]; reason: string }[] = [];
      let excludedTimeRanges: Array<{ start: number; end: number }> = [];

      if (isHorizontal) {
        try {
          infographicPicks = await infographicDetectionAgent.invoke({
            transcript: editedWordsList.map(w => w.punctuated_word ?? w.word).join(' '),
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
              transcript: editedWordsList,
              guidance: guidance || processedScript
            }).catch(err => {
              logger.error('Infographic generation failed, will backfill with broll', { error: err });
              return [] as Segment[];
            })
          : Promise.resolve([] as Segment[]);

      const [brollSegments, infographicSegments] = await Promise.all([
        getFocusedSegments({
          userId,
          eventId: tjId,
          privateLibraryIds: allLibraryIds,
          libraries,
          transcript: editedWordsList,
          guidance: guidance || processedScript,
          isTalkingHead: false,
          totalDuration,
          brollDuration: 4,
          useVideoEmbeddings: true,
          enableDuplicateDetection: true,
          isAllPublicLibrariesSelected,
          sentences: sentenceList,
          excludedTimeRanges
        }),
        infographicPromise
      ]);

      let finalSegments: Segment[];
      if (excludedTimeRanges.length > 0 && infographicSegments.length === 0) {
        logger.warn('Infographics failed, backfilling excluded ranges with broll');
        const backfillSegments = await getFocusedSegments({
          userId,
          eventId: tjId,
          privateLibraryIds: allLibraryIds,
          libraries,
          transcript: editedWordsList,
          guidance: guidance || processedScript,
          isTalkingHead: false,
          totalDuration,
          brollDuration: 4,
          useVideoEmbeddings: true,
          enableDuplicateDetection: true,
          isAllPublicLibrariesSelected,
          sentences: sentenceList,
          includedTimeRanges: excludedTimeRanges
        });
        finalSegments = [...brollSegments, ...backfillSegments].sort((a, b) => a.timeStart - b.timeStart);
      } else {
        finalSegments = [...brollSegments, ...infographicSegments].sort((a, b) => a.timeStart - b.timeStart);
      }
      segments = finalSegments;

    logger.info('v11 getFocusedSegments completed', {
      userId,
      tjId,
      segmentCount: segments.length,
      totalDuration
    });

    sendMessage(userId, tjId, 'Preparing video data...', 95);

    // Step 7: Generate title and description
    const generatedTitle = await videoTitleSuggestionAgent.invoke({ transcript: processedScript });
    const generatedDescription = await videoDescriptionSuggestionAgent.invoke({ transcript: processedScript });

    // Step 8: Create VideoAIData (no source = audio-only; editor uses voiceOver)
    const videoAIData: IVideoAIData = {
      transcriptionJob: tjId,
      title: title || generatedTitle,
      description: generatedDescription,
      voiceOver: audioUrl,
      audioEnabled: true,
      audioIndex: includeMusic ? 1 : -1,
      editedWordsList,
      audioVolume: 0.5,
      audio: [],
      userId,
      segments,
      formattedTranscript: processedScript,
      captions,
      privateLibraryIds,
      publicLibraryIds: publicLibraryIdsFromConfig
    };

    const videoStream = metadata?.streams?.find((s: { codec_type?: string }) => s.codec_type === 'video');
    if (videoStream && (tj.jobType === 'AUDIO' || tj.jobType === 'SCRIPT' || tj.jobType === 'PROMPT')) {
      const recropData: RecroppedVideoFrame = {
        x1: (1920 - 1080) / 2,
        x2: 1920 - (1920 - 1080) / 2,
        y2: 1080,
        y1: 0,
        frameStart: 0,
        frameEnd: parseInt(String(videoStream.nb_frames ?? 0), 10),
        timeStart: 0,
        timeEnd: parseFloat(String(videoStream.duration ?? 0))
      };
      videoAIData.croppedInfo = [recropData];
    }
    await transcriptionJobRepository.update(tjId, {
      status: 'COMPLETED',
      metadata
    });

    sendMessage(userId, tjId, 'Video generation complete!', 100);

    logger.info('Generation processor v5 completed successfully', {
      userId,
      tjId,
      segmentCount: segments.length,
      scriptLength: processedScript.length
    });

    const videAIDataDb = await videoAIDataRepository.create(videoAIData);

    await sendData(userId, tjId, { _id: videAIDataDb._id, isHighlight: false, isBroll: true });
    return videAIDataDb;
  } catch (e: any) {
    // Check if this is an insufficient footage error
    if (e.code === 'INSUFFICIENT_FOOTAGE') {
      await transcriptionJobRepository.update(tjId, { status: 'INSUFFICIENT_FOOTAGE' });
      await sendError(userId, tjId, e.message || 'Insufficient footage found for this topic', 100);
      logger.warn('Insufficient footage error in generation processor v5', {
        error: e,
        topic: e.topic,
        clipsFound: e.clipsFound,
        userId,
        tjId
      });
      // throw e;
      return;
    }

    // For all other errors, mark as FAILED
    await transcriptionJobRepository.update(tjId, { status: 'FAILED' });
    logger.error('Error in generation processor v5', {
      error: e,
      errorString: e.toString(),
      errorStack: e.stack,
      userId,
      tjId
    });
    throw e;
  }
};
