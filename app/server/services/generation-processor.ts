import { UserProfile } from '../models/user-profile';
import { retry } from '../utils/retry-fn';
import { TranscriptionJob } from '../models/transcription-job';
import { logger } from './logging';
import { transcribeUrl } from './ai/deepgram';
import {
  VideoGenerationEventDataV1,
  VideoGenerationEventDataV3,
} from 'shared/types/event-contracts';
import { IVideoAIData, WordBaseEdited } from '../types';
import userProfileRepository from '../repositories/user-profile.repository';
import { sendError, sendMessage } from '../services/sockets';
import { uploadToS3 } from './storage/s3';
import transcriptionJobRepository from '../repositories/transcription-job.repository';
import { downloadFile, safelyDelete } from './fs';
import path from 'path';
import { mapFrancResultToDeepgramLanguage } from '../utils/mapping';
import { generateVoiceover } from './tts';
import { getMetadata } from './video-manipulation/ffmpeg';
import { getS3FileUrl } from '../config/storage';
import { tryCatchError } from '../utils/error-handling';
import { generateAndUploadThumbnail } from './video-generation/footage-generation';
import mime from 'mime';
import fs from 'fs';
import { analyzeAndGenerateScript } from '../agents/script-or-prompt.agent';
import { generateScript } from './video-generation/v13-script-writer';
import libraryRepository from '../repositories/library.repository';
import automationHistoryRepository from '../repositories/automation-history.repository';
import { videoTitleSuggestionAgent } from '../agents/video-title-suggestion.agent';
import { videoDescriptionSuggestionAgent } from '../agents/video-description-suggestion.agent';

import { generateFootageSuggestions } from './video-generation/v11-proper-context/get-suggestions';
import { annotationRemoverAgent } from '../agents/annotation-remover.agent';
import { thumbnailPromptGeneratorAgent } from '../agents/thumbnail-prompt-generator.agent';
import { runFluxPredictionUrl } from './replicate.service';
import fsPromise from 'fs/promises';

export const generationProcessor = async ({
  guidance,
  libraries = { pexels: false },
  userId,
  privateLibraryIds,
  publicLibraryIds: publicLibraryIdsFromConfig,
  videoUrl,
  systemPrompt,
  selectedTags,
  title,
  language,
  isTalkingHead,
  useVideoEmbeddings,
  includeMusic,
  tjId,
  totalDuration,
  brollDuration,
  isAllPublicLibrariesSelected
}: VideoGenerationEventDataV1): Promise<IVideoAIData | undefined> => {
  const tj = await TranscriptionJob.findById(tjId);
  if (!tj) {
    logger.error('Transcription job not found', {
      tjId
    });
    return;
  }
  const metadata = tj.metadata;
  if (!metadata) {
    logger.error('Transcription job not found', {
      tjId
    });
    return;
  }

  if (!tj.transcript?.length) {
    const results = await retry(() => transcribeUrl(videoUrl, language), {
      maxAttempts: 3,
      delayMs: 1000,
      onRetry: (error, attempt) => {
        logger.error('Error transcribing video, retrying', {
          Error: error,
          'Video URL': videoUrl,
          'User ID': userId,
          Attempt: attempt
        });
      }
    });

    if (!results) {
      logger.error('Error transcribing video', {
        'Video URL': videoUrl,
        'User ID': userId
      });
      return;
    }
    tj.transcript = results;
  }

  const publicLibraryIds = (await libraryRepository.findPublicLibrariesByIds(publicLibraryIdsFromConfig ?? []))
    .map(library => library._id?.toString())
    .filter(id => id !== undefined && id !== null);

  tj.status = 'TRANSCRIBED';
  await tj.save();
  try {
    // Do content generation
    const videoAiData = await generateFootageSuggestions({
      guidance,
      systemPrompt,
      userId,
      includeMusic,
      musicPrompt: undefined, // V1 events don't have musicPrompt
      videoUrl,
      transcript: tj.transcript,
      tj,
      selectedTags,
      brollDuration,
      totalDuration,
      isTalkingHead,
      privateLibraryIds,
      publicLibraryIds,
      useVideoEmbeddings,
      libraries,
      title,
      isAllPublicLibrariesSelected
    });

    if (metadata.format.duration) {
      await UserProfile.findOneAndUpdate(
        { firebaseId: userId },
        { $inc: { 'usage.ttsMinutesSpent': Math.round((metadata.format.duration / 60) * 100) / 100 } },
        { new: true }
      );
    }
  } catch (e: any) {
    sendError(userId, tj._id.toString(), 'An unexpected error occurred. Please try again.');
    tj.status = 'FAILED';
    await tj.save();
    logger.error('Error generating footage suggestions', {
      error: e,
      errorString: e.toString(),
      errorStack: e.stack,
      guidance
    });
    throw e;
  }
};

const logError = (error: any, userId: string, tjId: string, message: string) => {
  logger.error(message, {
    error,
    userId,
    tjId
  });
};

const getEditedWordsList = async (videoUrl: string, language: string | undefined, userId: string) => {
  const results = await retry(() => transcribeUrl(videoUrl, language), {
    maxAttempts: 3,
    delayMs: 1000,
    onRetry: (error, attempt) => {
      logger.info('Issue transcribing video, retrying', {
        Issue: error,
        'Video URL': videoUrl,
        'User ID': userId,
        Attempt: attempt
      });
    }
  });

  if (!results) {
    logger.error('Error transcribing video', {
      'Video URL': videoUrl,
      'User ID': userId
    });
    throw new Error('Error transcribing video');
  }
  return results;
};

const updateTTSMinutesSpent = async (userId: string, duration?: number | null) => {
  if (duration === undefined || duration === null) {
    return;
  }
  await UserProfile.findOneAndUpdate(
    { firebaseId: userId },
    { $inc: { 'usage.ttsMinutesSpent': Math.round((duration / 60) * 100) / 100 } },
    { new: true }
  );
};

const getPublicLibraryIds = async (publicLibraryIdsFromConfig?: string[]) => {
  return (await libraryRepository.findPublicLibrariesByIds(publicLibraryIdsFromConfig ?? []))
    .map(library => library._id?.toString())
    .filter(id => id !== undefined && id !== null);
};

export const generationProcessorV2 = async (
  {
    guidance,
    libraries = { pexels: false },
    userId,
    privateLibraryIds,
    publicLibraryIds: publicLibraryIdsFromConfig,
    fileUrl,
    script,
    systemPrompt,
    isVoicePremium,
    voiceType,
    uploadType,
    size,
    selectedTags,
    title,
    isTalkingHead,
    includeMusic,
    musicPrompt,
    skipScriptGeneration = false,
    historyKey,
    tjId,
    brollDuration,
    isAllPublicLibrariesSelected,
    orientation,
    captions,
    linkedChannelIds,
    exportConfig
  }: VideoGenerationEventDataV3,
  tmpDir = '/tmp/data'
) => {
  const tj = await TranscriptionJob.findById(tjId);

  try {
    if (!tj) {
      logError(undefined, userId, tjId, 'Transcription job not found');
      return;
    }

    // CHECKPOINT: Check if we already have a videoUrl (resume from timeout)
    if (tj.videoUrl && tj.transcript?.length && tj.metadata) {
      logger.info('Checkpoint detected: videoUrl and transcript exist, skipping to footage generation', {
        tjId,
        userId,
        videoUrl: tj.videoUrl
      });
      sendMessage(userId, tjId, 'Resuming from previous progress...', 28);

      const publicLibraryIds = (await libraryRepository.findPublicLibrariesByIds(publicLibraryIdsFromConfig ?? []))
        .map(library => library._id?.toString())
        .filter(id => id !== undefined && id !== null);

      // Jump straight to footage generation
      const videoAiData = await generateFootageSuggestions({
        guidance,
        systemPrompt,
        userId,
        includeMusic,
        musicPrompt,
        videoUrl: tj.videoUrl,
        transcript: tj.transcript,
        formattedTranscript: tj.script || '',
        tj,
        selectedTags,
        brollDuration,
        totalDuration: tj.metadata.format.duration,
        isTalkingHead,
        privateLibraryIds,
        publicLibraryIds,
        useVideoEmbeddings: true,
        libraries,
        captions,
        title: tj.title ?? title,
        description: undefined,
        isAllPublicLibrariesSelected,
        createInfographics: orientation === 'HORIZONTAL',
        size,
        isAudioOnly: !!tj.isAudioOnly
      });

      updateTTSMinutesSpent(userId, tj.metadata.format.duration);

      return videoAiData;
    }

    let filename = fileUrl ? path.basename(fileUrl) : '';
    let filepath = `${tmpDir}/${filename}`;
    const hirizontallyAdjustedHistoryKey = orientation === 'HORIZONTAL' ? `${historyKey}-horizontal` : historyKey;

    if (fileUrl) {
      await downloadFile(filepath, fileUrl);
    }
    let language: string | undefined;
    let editedWordsList: WordBaseEdited[] = [];
    const ttsMinutesRemaining = await userProfileRepository.getTTSMinutesRemaining(userId);
    let blackThumbnail = false;
    let isAudioOnly = false;
    let metadata: Awaited<ReturnType<typeof getMetadata>> | undefined;
    let history = '';
    let processedScript: string = '';
    if (historyKey && hirizontallyAdjustedHistoryKey) {
      const historyRecords = await automationHistoryRepository.findByChannel(hirizontallyAdjustedHistoryKey, 50);
      history = historyRecords.map(video => video.script.substring(0, 300)).join('\n\n\n');
    }
    if (script) {
      if (uploadType === 'script') {
        // For script type, remove annotations
        const deannotatedScript = (await annotationRemoverAgent.invoke({ input: script })).text;
        processedScript = deannotatedScript;
      } else if (uploadType === 'prompt') {
        // For prompt type, run scriptwriter
        if (
          (privateLibraryIds && privateLibraryIds.length > 0) ||
          (publicLibraryIdsFromConfig && publicLibraryIdsFromConfig.length > 0)
        ) {
          try {
            const scriptResult = await generateScript(
              script,
              [...(privateLibraryIds ?? []), ...(publicLibraryIdsFromConfig ?? [])],
              history,
              orientation === 'HORIZONTAL',
              userId,
              linkedChannelIds,
              hirizontallyAdjustedHistoryKey
            );
            processedScript = scriptResult;

            logger.info('Generated library-aware script from prompt', {
              userId,
              tjId,
              scriptLength: processedScript.length
            });
          } catch (error) {
            logger.warn('Library-aware script generation failed, falling back to standard generation', {
              userId,
              tjId,
              error: error
            });
            throw error;
          }
        } else {
          const { script: result } = await analyzeAndGenerateScript(script);
          processedScript = result;
        }
      }

      sendMessage(
        userId,
        tjId,
        "Our narrator's alarm didn't go off... but don't worry, we're knocking on their door!",
        4
      ); // 4%
      // if (ttsMinutesRemaining < approximateMinutesFromText(processedScript)) {
      //   await sendError(
      //     userId,
      //     tjId,
      //     `This script is approximately ${approximateMinutesFromText(
      //       processedScript
      //     )} minutes long. You have ${ttsMinutesRemaining} minutes remaining in your subscription.`
      //   );
      //   transcriptionJobRepository.update(tjId, { status: 'FAILED' });
      //   return;
      // }
      blackThumbnail = true;

      const { audioPath, audioName, transcript } = await generateVoiceover(
        processedScript,
        isVoicePremium,
        voiceType,
        tmpDir
      );
      editedWordsList = transcript;
      const { franc } = await import('franc');
      language = mapFrancResultToDeepgramLanguage(
        franc(processedScript, { only: ['eng', 'rus', 'spa', 'fra', 'deu', 'ita', 'bul', 'tur'] })
      );
      sendMessage(userId, tjId, 'Uploading audio...', 7);
      const scriptMetadata = await tryCatchError(
        () => getMetadata(audioPath),
        userId,
        tjId,
        'Error reading audio metadata.'
      );
      if (!scriptMetadata) return;
      const scriptFinalFilename = `users/${userId}/${audioName}`;
      await transcriptionJobRepository.update(tjId, { filename: scriptFinalFilename });
      await tryCatchError(
        () =>
          uploadToS3(audioPath, scriptFinalFilename, {
            mimeType: mime.getType(audioName) ?? 'audio/mpeg',
            originalName: path.parse(scriptFinalFilename).name,
            fileSize: fs.statSync(audioPath).size,
            userId: userId
          }),
        userId,
        tjId,
        'Error saving audio.'
      );
      safelyDelete(audioPath);
      filename = scriptFinalFilename;
      filepath = '';
      metadata = scriptMetadata;
      isAudioOnly = true;
    } else if (uploadType === 'audio') {
      sendMessage(userId, tjId, 'Uploading audio...', 4);
      const audioMetadata = await tryCatchError(
        () => getMetadata(filepath),
        userId,
        tjId,
        'Error reading audio metadata.'
      );
      if (!audioMetadata) return;
      const audioFinalFilename = `users/${userId}/${path.basename(filepath)}`;
      await transcriptionJobRepository.update(tjId, { filename: audioFinalFilename });
      await tryCatchError(
        () =>
          uploadToS3(filepath, audioFinalFilename, {
            mimeType: mime.getType(filepath) ?? 'audio/mpeg',
            originalName: path.parse(audioFinalFilename).name,
            fileSize: fs.statSync(filepath).size,
            userId: userId
          }),
        userId,
        tjId,
        'Error saving audio.'
      );
      safelyDelete(filepath);
      blackThumbnail = true;
      filename = audioFinalFilename;
      filepath = '';
      metadata = audioMetadata;
      isAudioOnly = true;
    }
    if (!isAudioOnly) {
      metadata = await tryCatchError(() => getMetadata(filepath), userId, tjId, 'Error reading file metadata.');
      if (!metadata) return;
      filename = `users/${userId}/${path.basename(filepath)}`;
      await transcriptionJobRepository.update(tjId, { filename });
      await tryCatchError(
        () =>
          uploadToS3(filepath, filename, {
            mimeType: mime.getType(filepath) ?? '',
            originalName: path.parse(filename).name,
            fileSize: fs.statSync(filepath).size,
            userId: userId
          }),
        userId,
        tjId,
        'Error saving source.'
      );
    }
    if (!metadata) {
      logError(undefined, userId, tjId, 'Missing metadata');
      return;
    }
    sendMessage(userId, tjId, 'Coffee cup is full, editor is back at work.', 25); // 25%
    sendMessage(userId, tjId, 'Asking a room full of monkeys to describe our new video...', 15); // 15%

    const videoUrl = getS3FileUrl(filename);

    // CHECKPOINT: Save videoUrl, metadata, and filename early for resume capability
    await transcriptionJobRepository.update(tjId, {
      filename,
      videoUrl,
      metadata,
      script: processedScript,
      ...(isAudioOnly ? { isAudioOnly: true } : {})
    });

    sendMessage(userId, tjId, 'Our editor needed a coffee refill—your project is back in action shortly...', 20); // 20%

    let generatedTitle = title;
    if (!title) {
      try {
        generatedTitle = await videoTitleSuggestionAgent.invoke({ transcript: processedScript });
      } catch (e) {
        logger.error('Error generating title', {
          error: e,
          transcript: processedScript
        });
      }
    }
    let generatedDescription = '';
    try {
      generatedDescription = await videoDescriptionSuggestionAgent.invoke({ transcript: processedScript });
    } catch (e) {
      logger.error('Error generating description', {
        error: e,
        transcript: processedScript
      });
    }
    const returned = await transcriptionJobRepository.update(tjId, { title: generatedTitle });

    sendMessage(userId, tjId, 'A very talented elephant is drawing a thumbnail for your video...', 26); // 26%

    // Generate thumbnail - AI or frame extraction
    if (exportConfig?.generateThumbnail && processedScript) {
      // Generate AI thumbnail using Flux
      await tryCatchError(
        async () => {
          // Generate thumbnail prompt using the agent
          const promptResponse = await thumbnailPromptGeneratorAgent.invoke({ input: processedScript });
          const thumbnailPrompt = promptResponse;

          if (!thumbnailPrompt) {
            logger.error('Error generating thumbnail prompt', {
              userId,
              tjId,
              processedScript
            });
            return;
          }

          // Determine aspect ratio based on orientation
          const aspectRatio = orientation === 'VERTICAL' ? '9:16' : '16:9';

          // Generate thumbnail using Replicate Flux
          const thumbnailImage = await runFluxPredictionUrl({
            prompt: thumbnailPrompt,
            aspect_ratio: aspectRatio,
            output_format: 'png'
          });

          // Write the file to disk
          const thumbnailTempPath = `${tmpDir}/${Date.now()}-ai-thumbnail.png`;
          await fsPromise.writeFile(thumbnailTempPath, thumbnailImage as any);

          // Upload to S3
          const sanitizedTitle = (generatedTitle ?? 'video')
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9_]/g, '')
            .toLowerCase()
            .substring(0, 15);
          const thumbnailFileName = `users/${userId}/${sanitizedTitle}_ai_thumbnail_${Date.now()}.png`;
          await uploadToS3(thumbnailTempPath, thumbnailFileName, {
            mimeType: mime.getType(thumbnailTempPath) ?? 'image/png',
            originalName: thumbnailFileName,
            fileSize: fs.statSync(thumbnailTempPath).size,
            userId: userId
          });

          // Get S3 URL and save to TranscriptionJob
          const thumbnailUrl = getS3FileUrl(thumbnailFileName);
          returned!.thumbnailUrl = thumbnailUrl;
          returned!.isAiThumbnail = true;
          await transcriptionJobRepository.save(returned!);

          // Clean up temp file
          safelyDelete(thumbnailTempPath);

          logger.info('AI thumbnail generated successfully', {
            userId,
            tjId,
            thumbnailUrl
          });
        },
        userId,
        tjId,
        'Error generating AI thumbnail.'
      );
    } else if (!isAudioOnly) {
      // Use existing frame extraction method (skip for audio-only)
      await generateAndUploadThumbnail(
        filepath,
        path.parse(filename).name,
        userId,
        returned!,
        blackThumbnail,
        size,
        tmpDir
      );
      // Mark as non-AI thumbnail
      returned!.isAiThumbnail = false;
      await transcriptionJobRepository.save(returned!);
    } else {
      returned!.thumbnailUrl = '';
      returned!.isAiThumbnail = false;
      await transcriptionJobRepository.save(returned!);
    }

    sendMessage(
      userId,
      tjId,
      "Turns out our elephant wasn't a great painter, but we have to work with what we have...",
      28
    ); // 28%
    if (!isAudioOnly) safelyDelete(filepath);

    if (!editedWordsList?.length) {
      editedWordsList = await getEditedWordsList(videoUrl, language, userId);
    }

    const publicLibraryIds = await getPublicLibraryIds(publicLibraryIdsFromConfig);
    // CHECKPOINT: Save transcript after transcription
    const returned2 = await transcriptionJobRepository.update(tjId, { transcript: editedWordsList });

    // Do content generation
    const videoAiData = await generateFootageSuggestions({
      guidance,
      systemPrompt,
      userId,
      includeMusic,
      musicPrompt,
      videoUrl,
      transcript: editedWordsList,
      formattedTranscript: processedScript || '',
      tj: returned2!,
      selectedTags,
      brollDuration,
      totalDuration: metadata.format.duration,
      isTalkingHead,
      privateLibraryIds,
      publicLibraryIds,
      useVideoEmbeddings: true,
      libraries,
      captions,
      title: generatedTitle,
      description: generatedDescription ?? undefined,
      createInfographics: orientation === 'HORIZONTAL',
      isAllPublicLibrariesSelected,
      size,
      isAudioOnly
    });

    updateTTSMinutesSpent(userId, metadata.format.duration);

    if (hirizontallyAdjustedHistoryKey && processedScript) {
      await automationHistoryRepository.create({
        userId,
        title: videoAiData?.title ?? '',
        theme: script ?? '',
        script: processedScript,
        channelId: hirizontallyAdjustedHistoryKey,
        tjId: tjId
      });
    }

    return videoAiData;
  } catch (e: any) {
    await sendError(userId, tjId, 'An unexpected error occurred. Please try again.');
    await transcriptionJobRepository.update(tjId, { status: 'FAILED' });
    logger.error('Error generating footage suggestions', {
      error: e,
      errorString: e.toString(),
      errorStack: e.stack,
      guidance
    });
    throw e;
  }
};
