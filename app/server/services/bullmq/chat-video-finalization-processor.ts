/**
 * Chat video finalization processor — single source of truth for the chat
 * video finalization logic.
 *
 * Used by:
 * - BullMQ workers on EC2 (via app/server/services/bullmq/workers.ts)
 * - Lambda function (via import from 'server/services/bullmq/chat-video-finalization-processor')
 *   during migration so both paths execute identical logic.
 *
 * Mirrors the processing logic from:
 * - functions/chat-video-finalization-lambda/src/index.ts (processChatVideoFinalizationTask)
 */

import type { ChatVideoFinalizationEventData } from 'shared/types/event-contracts';
import { RecroppedVideoFrame } from 'shared/types';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { downloadFile, safelyDelete } from '../fs';
import {
  generateVideoFromAudio,
  getMetadata,
} from '../video-manipulation/ffmpeg';
import { uploadToS3 } from '../storage/s3';
import { getS3FileUrl } from '../../config/storage';
import videoAIDataRepository from '../../repositories/video-ai-data.repository';
import transcriptionJobRepository from '../../repositories/transcription-job.repository';
import { UserProfile } from '../../models/user-profile';
import { sendMessage, sendData, sendError } from '../sockets';
import fs from 'fs';
import mime from 'mime';
import { logger } from '../logging';

const TMP_DIR = '/tmp';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Increment the user's TTS minutes spent based on the video duration in seconds.
 */
async function updateTTSMinutesSpent(
  userId: string,
  durationInSeconds?: number | null
): Promise<void> {
  if (durationInSeconds === undefined || durationInSeconds === null) {
    return;
  }
  const minutes = Math.round((durationInSeconds / 60) * 100) / 100;
  await UserProfile.findOneAndUpdate(
    { firebaseId: userId },
    { $inc: { 'usage.ttsMinutesSpent': minutes } },
    { new: true }
  );
  logger.info('Updated TTS minutes spent', { userId, minutes });
}

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

/**
 * Process a single chat video finalization task.
 *
 * Downloads the voiceover from S3, generates a black-screen video from the
 * audio, uploads the result to S3, and updates both VideoAIData and
 * TranscriptionJob records.
 *
 * @param eventData — job payload from the 'chat-video-finalization' queue
 */
export async function processChatVideoFinalizationTaskBullMQ(
  eventData: ChatVideoFinalizationEventData
): Promise<void> {
  const { videoAIDataId, tjId, userId, voiceOverUrl, title } = eventData;

  let audioPath = '';
  let videoPath = '';

  try {
    logger.info('Starting chat video finalization', {
      videoAIDataId,
      tjId,
      userId,
      title,
    });

    // Step 1: Send initial progress
    await sendMessage(userId, tjId, 'Starting video finalization...', 5);

    // Step 2: Download voiceover from S3 to temp file
    await sendMessage(userId, tjId, 'Downloading audio...', 10);
    const audioFilename = `${Date.now()}-voiceover.mp3`;
    audioPath = path.join(TMP_DIR, audioFilename);
    await downloadFile(audioPath, voiceOverUrl);

    logger.info('Downloaded voiceover', {
      tjId,
      audioPath,
      voiceOverUrl,
    });

    // Step 3: Generate black screen video from audio (horizontal 1080p)
    await sendMessage(userId, tjId, 'Creating video from audio...', 20);
    const [videoName, generatedVideoPath] = await generateVideoFromAudio(
      audioPath,
      '1080p', // Always horizontal
      (percent) => {
        const mappedProgress = 20 + Math.round((percent * 50) / 100);
        sendMessage(userId, tjId, 'Creating video...', mappedProgress);
      },
      TMP_DIR
    );
    videoPath = generatedVideoPath;

    logger.info('Generated video from audio', {
      tjId,
      videoPath,
      videoName,
    });

    // Step 4: Get video metadata
    await sendMessage(userId, tjId, 'Extracting metadata...', 75);
    const metadata = await getMetadata(videoPath);

    logger.info('Extracted video metadata', {
      tjId,
      duration: metadata.format.duration,
      width: metadata.streams?.[0]?.width,
      height: metadata.streams?.[0]?.height,
    });

    // Step 4b: Calculate vertical recrop data (center crop from 1920x1080 to 1080x1920)
    const recropData: RecroppedVideoFrame = {
      x1: (1920 - 1080) / 2,
      x2: 1920 - (1920 - 1080) / 2,
      y1: 0,
      y2: 1080,
      frameStart: 0,
      frameEnd: parseInt(
        metadata.streams.find((stream) => stream.codec_type === 'video')
          ?.nb_frames ?? '0',
        10
      ),
      timeStart: 0,
      timeEnd: parseFloat(
        metadata.streams.find((stream) => stream.codec_type === 'video')
          ?.duration ?? '0'
      ),
    };

    // Step 5: Upload video to S3
    await sendMessage(userId, tjId, 'Uploading video...', 80);
    const s3Filename = `users/${userId}/chat-video-${Date.now()}.mp4`;
    await uploadToS3(videoPath, s3Filename, {
      mimeType: mime.getType(videoPath) || 'video/mp4',
      originalName: videoName,
      fileSize: fs.statSync(videoPath).size,
      userId,
    });
    const videoUrl = getS3FileUrl(s3Filename);

    logger.info('Uploaded video to S3', {
      tjId,
      videoUrl,
      s3Filename,
    });

    // Step 6: Update VideoAIData with source and transcriptionJob reference
    await sendMessage(userId, tjId, 'Updating video data...', 90);
    await videoAIDataRepository.update(videoAIDataId, {
      source: {
        url: videoUrl,
        metadata,
        thumbnail: '', // No thumbnail for black screen video
      },
      transcriptionJob: tjId,
      croppedInfo: [recropData],
    });

    logger.info('Updated VideoAIData with source', {
      tjId,
      videoAIDataId,
      videoUrl,
    });

    // Step 7: Update TranscriptionJob
    await transcriptionJobRepository.update(tjId, {
      videoUrl,
      metadata,
      status: 'COMPLETED',
    });

    logger.info('Updated TranscriptionJob status to COMPLETED', {
      tjId,
      videoUrl,
    });

    // Step 8: Mark TTS minutes as spent for the user
    await updateTTSMinutesSpent(userId, metadata.format.duration);

    // Step 9: Send completion data event
    await sendMessage(userId, tjId, 'Video finalization complete!', 100);
    await sendData(userId, tjId, { _id: videoAIDataId });

    logger.info('Chat video finalization completed successfully', {
      videoAIDataId,
      tjId,
      userId,
    });
  } catch (error: any) {
    logger.error('Error in chat video finalization', {
      videoAIDataId,
      tjId,
      userId,
      error: error.message,
      errorStack: error.stack,
    });

    // Update TranscriptionJob status to FAILED
    try {
      await transcriptionJobRepository.update(tjId, {
        status: 'FAILED',
      });
    } catch (updateError) {
      logger.error('Failed to update TranscriptionJob status to FAILED', {
        tjId,
        error: updateError,
      });
    }

    // Send error to user
    await sendError(
      userId,
      tjId,
      'Error finalizing video. Please try again.'
    );

    throw error;
  } finally {
    // Step 10: Clean up temp files
    if (audioPath) safelyDelete(audioPath);
    if (videoPath) safelyDelete(videoPath);
  }
}
