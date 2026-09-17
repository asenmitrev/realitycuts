import videoAIDataRepository from '../repositories/video-ai-data.repository';
import userProfileRepository from '../repositories/user-profile.repository';
import exportRepository from '../repositories/export.repository';
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from '../errors';
import { ENVIRONMENT, IS_PROD } from '../config/const';
import { IExportJob, ITranscriptionJob, UploadType } from '../types';
import { videoTitleSuggestionAgent } from '../agents/video-title-suggestion.agent';
import { videoDescriptionSuggestionAgent } from '../agents/video-description-suggestion.agent';
import { logger } from '../services/logging';
import { sendError, sendMessage } from '../services/sockets';
import {
  enqueueExporterTaskBullMQ,
  enqueueLambdaVideoGenerationTask,
  enqueueFCPXMLExportTask
} from '../services/task-queue';
import { deleteFromS3, getKeyFromUrl, uploadToS3 } from './storage/s3';
import { getUserEmail } from './auth';
import transcriptionJobRepository from '../repositories/transcription-job.repository';
import { safelyDelete } from './fs';
import path from 'path';
import { mapUploadTypeToJobType } from '../utils/mapping';
import { approximateMinutesFromText } from 'shared/utils/misc';
import { getMetadata } from './video-manipulation/ffmpeg';
import { VideoGenerationEventDataV4, VideoGenerationEventDataV3 } from 'shared/types/event-contracts';
import { getS3FileUrl } from '../config/storage';
import { tryCatchError } from '../utils/error-handling';
import mime from 'mime';
import fs from 'fs';
import uploadService from './upload.service';
export class VideoService {
  /**
   * Get videos with pagination
   */
  async getVideos(userId: string, skip: number = 0, limit: number = 1000) {
    const result = await videoAIDataRepository.findVideosWithPagination(userId, skip, limit);
    return result;
  }

  /**
   * Get video statistics by user
   */
  async getVideoStatsByUser(days: number = 25): Promise<Array<{ _id: string; count: number }>> {
    return await videoAIDataRepository.getVideoStatsByUser(days);
  }

  /**
   * Get ALL videos across all users with pagination (for secret admin page)
   * ONLY ACCESSIBLE IN UAT ENVIRONMENT
   */
  async getAllVideosForAdmin(skip: number = 0, limit: number = 50) {
    if (ENVIRONMENT !== 'uat') {
      throw new UnauthorizedError('This endpoint is only available in UAT environment');
    }

    return await videoAIDataRepository.findAllVideosWithPagination(skip, limit);
  }

  /**
   * Get a video by ID
   */
  async getVideo(id: string, userId: string) {
    if (!id) {
      throw new BadRequestError('Video id is mandatory.');
    }

    const result = await videoAIDataRepository.findById(id);

    if (!result) {
      throw new NotFoundError('Video not found.');
    }

    if (ENVIRONMENT === 'prod' && !(userId === result?.userId)) {
      throw new UnauthorizedError('Not authorized to edit this video.');
    }

    return result;
  }

  /**
   * Update a video
   */
  async updateVideo(id: string, userId: string, data: any) {
    if (!id) {
      throw new BadRequestError('Video id is mandatory.');
    }

    const video = await videoAIDataRepository.findById(id);

    if (!video) {
      throw new NotFoundError('Video not found.');
    }

    if (video.userId !== userId) {
      throw new UnauthorizedError('Not authorized to edit this video.');
    }

    return await videoAIDataRepository.update(id, data);
  }

  async regenerateBroll(
    id: string,
    userId: string,
    startTime: number,
    endTime: number,
    privateLibraryIds: string[],
    pexels: boolean,
    eventId: string
  ) {
    if (!id) {
      throw new BadRequestError('Video id is mandatory.');
    }
    const video = await videoAIDataRepository.findById(id);
    if (!video) {
      throw new NotFoundError('Video not found.');
    }
    throw new NotFoundError('Not implemented');
    // const visibleWords = video.editedWordsList!.filter(w => w.start! >= startTime && w.end! <= endTime);
    // const focusedSegments = await getFocusedSegments({
    //   transcript: visibleWords,
    //   privateLibraryIds,
    //   libraries: { storyblocks, pexels },
    //   isTalkingHead: true,
    //   eventId,
    //   brollDuration: 3.5,
    //   guidance: '',
    //   userId,
    //   useVideoEmbeddings: true
    // });

    // return focusedSegments;
  }

  /**
   * Export video with different export options
   */
  async exportVideo(
    id: string,
    userId: string,
    exportType: 'VIDEO' | 'VIDEO_CAPTIONS' | 'CAPTIONS',
    orientationType: 'BOTH' | 'HORIZONTAL' | 'VERTICAL',
    brandWatermarkUploadId?: string,
    brandWatermarkPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center',
    generateThumbnail?: boolean
  ) {
    const videoAiData = await videoAIDataRepository.findById(id);

    if (!videoAiData) {
      throw new NotFoundError('Video data not found');
    }

    logger.info('Creating export job', {
      'User ID': userId,
      'Video Data ID': videoAiData._id
    });

    // On non-prod, use the video owner's profile so cross-account export works (same pattern as getVideo)
    const profileUserId = ENVIRONMENT === 'prod' ? userId : videoAiData.userId;
    const userProfile = await userProfileRepository.findByFirebaseId(profileUserId);

    if (!userProfile) {
      throw new NotFoundError('User profile not found');
    }

    // Create job data
    const jobData: Partial<IExportJob> = {
      userId,
      videoDataId: videoAiData._id,
      status: 'QUEUED',
      exportType,
      isWatermarked: false,
      orientationType,
      brandWatermarkUploadId,
      brandWatermarkPosition,
      // Only generate thumbnail for horizontal videos if enabled
      generateThumbnail: generateThumbnail === true && (orientationType === 'HORIZONTAL' || orientationType === 'BOTH')
    };

    // Create a new export job using the repository
    const job = await exportRepository.create(jobData);

    const result = await enqueueExporterTaskBullMQ(job._id.toString());
    return { eventId: job._id };
  }

  async generateTitle(id: string) {
    const videoAiData = await videoAIDataRepository.findById(id, true);

    if (!videoAiData) {
      throw new NotFoundError('Video not found');
    }

    const transcript =
      videoAiData.editedWordsList?.map(word => word.word).join(' ') ||
      videoAiData.transcriptionJob.deepgramResults?.results.channels[0].alternatives[0].words
        .map(word => word.punctuated_word ?? word.word)
        .join(' ');

    let title = await videoTitleSuggestionAgent.invoke({ transcript: transcript || '' });
    if (title.includes('"')) {
      title = title.replace(/"/g, '');
    }

    return title;
  }

  async generateDescription(id: string) {
    const videoAiData = await videoAIDataRepository.findById(id, true);

    if (!videoAiData) {
      throw new NotFoundError('Video not found');
    }

    const transcript =
      videoAiData.editedWordsList?.map(word => word.word).join(' ') ||
      videoAiData.transcriptionJob.deepgramResults?.results.channels[0].alternatives[0].words
        .map(word => word.punctuated_word ?? word.word)
        .join(' ');

    if (!transcript) {
      throw new BadRequestError('No transcript found');
    }
    let description = await videoDescriptionSuggestionAgent.invoke({ transcript });
    if (description.includes('"')) {
      description = description.replace(/"/g, '');
    }

    return description;
  }

  async generateFCPXML(id: string, userId: string) {
    const userProfile = await userProfileRepository.findByFirebaseId(userId);
    if (!userProfile) {
      throw new NotFoundError('You have no profile. Please logout and log back in...');
    }
    const videoAiData = await videoAIDataRepository.findById(id, false);

    // Download all the video files from the segments in VideoAiData
    const segments = videoAiData?.segments;
    if (!segments) {
      throw new BadRequestError('No segments found');
    }

    const job = await exportRepository.create({
      userId,
      videoDataId: videoAiData._id,
      status: 'QUEUED',
      exportType: 'FCPXML',
      orientationType: 'HORIZONTAL'
    });
    await job.save();
    try {
      if (IS_PROD) {
        await enqueueFCPXMLExportTask({
          exportJobId: job._id.toString(),
          version: '1.0.0'
        });
      } else {
        const { generateFCPXML } = await import('./export/export-fcp');
        await generateFCPXML(videoAiData, job._id.toString(), userId);
      }
      sendMessage(userId, job._id.toString(), 'FCPXML export queued for processing', 5);
    } catch (e) {
      sendError(userId, job._id, 'Error queuing FCPXML export', 100);
      throw e;
    }
    return job._id;
  }

  async deleteVideo(id: string, userId: string) {
    if (!id) {
      throw new BadRequestError('Video id is mandatory.');
    }
    const result = await videoAIDataRepository.findById(id, false);

    if (!result) {
      throw new NotFoundError('Video not found.');
    }
    const transcriptionJob = await transcriptionJobRepository.findById(result.transcriptionJob);
    const sourceUrl = result.source?.url;
    if (sourceUrl) {
      const urlParts = sourceUrl.split('/').reverse();
      const videoName = urlParts[0];
      deleteFromS3(videoName, async err => {
        if (err) {
          logger.error('Error deleting source from cloud', {
            Error: err,
            'Video Name': videoName,
            'User ID': userId
          });
        }
      });
    }

    const thumbnailUrl = result.source?.thumbnail;
    if (thumbnailUrl) {
      const urlParts = thumbnailUrl.split('/').reverse();
      const thumbnailName = urlParts[0];
      deleteFromS3(thumbnailName, async err => {
        if (err) {
          logger.error('Error deleting thumbnail from cloud', {
            Error: err,
            'Thumbnail Name': thumbnailName,
            'User ID': userId
          });
        }
      });
    }
    if (transcriptionJob?.audioUrl) {
      const urlParts = transcriptionJob.audioUrl.split('/').reverse();
      const audioName = urlParts[0];
      deleteFromS3(audioName, err => {
        if (err) {
          logger.error('Error deleting audio from cloud', {
            Error: err,
            'Audio Name': audioName,
            'User ID': userId
          });
        }
      });
    }
    if (transcriptionJob?._id) {
      await transcriptionJobRepository.delete(transcriptionJob._id);
    }
    await videoAIDataRepository.delete(id);
  }

  /**
   * One-shot pipeline: search YouTube for relevant clips, build a library, then
   * auto-generate a video once the library finishes processing.
   *
   * Flow:
   *   1. Search YouTube for B-roll videos matching the prompt
   *   2. Create a TranscriptionJob to track overall status
   *   3. Create a library tagged with pendingOneShotJob so the embedding Lambda
   *      knows to enqueue video generation when processing completes
   *   4. Kick off library processing (Fargate yt-dlp pipeline)
   */
  async createOneShotVideo({
    prompt,
    userId
  }: {
    prompt: string;
    userId: string;
  }): Promise<{ jobId: string; libraryId: string }> {
    const email = await getUserEmail(userId);
    if (!email) {
      throw new BadRequestError('An email address is required to generate a video. Please sign in with an email.');
    }

    const existingCount = await videoAIDataRepository.getVideoCount(userId);
    if (existingCount >= 1) {
      throw new ConflictError('You already have a video in progress. Please go to your dashboard to view it.');
    }

    const { searchAndFilterYoutubeVideos } = await import('./youtube');
    const libraryService = (await import('./library.service')).default;
    const { generateLibraryName } = await import('../agents/library-name.agent');
    const { createClaudeVisionCheapCompletion } = await import('./ai/anthropic');

    let [videos, libraryName] = await Promise.all([
      searchAndFilterYoutubeVideos(prompt, 3),
      generateLibraryName(prompt).catch(err => {
        logger.error('Failed to generate library name for one-shot video', { err, prompt });
        return prompt.slice(0, 60);
      })
    ]);

    if (videos.length === 0) {
      logger.info('No YouTube videos found for original prompt, retrying with simpler search term', { prompt });
      let simplerTerm = prompt.split(' ').slice(0, 3).join(' ');
      try {
        const response = await createClaudeVisionCheapCompletion([
          {
            role: 'user',
            content: `Extract the core topic (2-4 words) from this video prompt that would work well as a YouTube search query. Return only the search term, nothing else.\n\nPrompt: "${prompt}"`
          }
        ]);
        if (response.trim()) {
          simplerTerm = response.trim();
        }
      } catch (err) {
        logger.warn('Failed to generate simpler search term, using word truncation fallback', { err, prompt });
      }
      logger.info('Retrying YouTube search with simpler term', { simplerTerm });
      videos = await searchAndFilterYoutubeVideos(simplerTerm, 3);
    }

    if (videos.length === 0) {
      throw new BadRequestError('No YouTube videos found for this topic. Please try a different or more general topic.');
    }

    const existingVideoCount = await videoAIDataRepository.getVideoCount(userId);
    const isFirstVideo = existingVideoCount === 0;

    const { TranscriptionJob } = await import('../models/transcription-job');
    const transcriptionJob = new TranscriptionJob({
      userId,
      title: prompt.slice(0, 100),
      jobType: 'PROMPT',
      status: 'VIDEO_RECEIVED',
      guidance: prompt
    });
    await transcriptionJob.save();
    const tjId = transcriptionJob._id.toString();

    const library = await libraryService.createLibrary(
      { title: libraryName, pendingOneShotJob: { prompt, tjId } },
      userId
    );
    const libraryId = library._id!.toString();

    await libraryService.processLibrary(
      libraryId,
      userId,
      videos.map(v => ({ isNew: true, description: v.title, link: v.youtubeUrl })),
      [],
      false,
      prompt.slice(0, 60),
      isFirstVideo
    );

    return { jobId: tjId, libraryId };
  }

  async createVideo({
    userId,
    fileUrl,
    file,
    uploadId,
    script,
    privateLibraryIds,
    title,
    brollDuration,
    pexels,
    selectedTags,
    guidance,
    systemPrompt,
    size,
    voiceType,
    uploadType,
    includeMusic,
    isVoicePremium,
    publicLibraryIds,
    isAllPublicLibrariesSelected = false,
    orientation
  }: {
    userId: string;
    fileUrl?: string;
    file?: Express.Multer.File;
    uploadId?: string;
    script: string;
    title: string;
    brollDuration: string;
    uploadType: UploadType;
    size: '1080p' | '1080x1920';
    privateLibraryIds: string[];
    publicLibraryIds: string[];
    pexels: boolean;
    selectedTags: string[];
    includeMusic: boolean;
    isVoicePremium: boolean;
    guidance: string;
    systemPrompt: string;
    voiceType: string;
    isAllPublicLibrariesSelected?: boolean;
    orientation?: 'horizontal' | 'vertical';
  }) {
    if (!file && !fileUrl && !uploadId && !script) {
      throw new BadRequestError('No file uploaded or error uploading file.');
    }
    if (!userId) {
      logger.info('No userId has been sent with request', {
        method: 'generate-data',
        'User ID': userId
      });
      throw new BadRequestError('No userId has been sent with request. Aborting...');
    }
    if (
      !privateLibraryIds?.length &&
      !publicLibraryIds?.length &&
      !pexels &&
      !selectedTags?.length &&
      !isAllPublicLibrariesSelected
    ) {
      logger.info('No video library selected', {
        method: 'generate-data',
        'User ID': userId
      });
      throw new BadRequestError('Select at least one video library to add b-roll from...');
    }
    if (uploadType === 'highlight') {
      throw new BadRequestError('Highlighting is no longer supported.');
    }
    let tjId = '';
    const userProfile = await userProfileRepository.findByFirebaseId(userId);
    if (!userProfile) {
      throw new NotFoundError('Users without a profile cannot upload...');
    }

    let duration: number;

    // Calculate duration based on upload type
    if (uploadId) {
      const upload = await uploadService.getUpload(uploadId, userId);
      if (upload.uploadStatus !== 'COMPLETED') {
        throw new BadRequestError('Upload is not completed. Please wait for upload to finish or try again.');
      }
      // Get duration from metadata if available, otherwise use approximation
      if (upload.url) {
        try {
          duration = upload.duration ?? 60;
        } catch (error) {
          // Fallback to script approximation if metadata extraction fails
          duration = approximateMinutesFromText(script) * 60;
        }
      } else {
        duration = approximateMinutesFromText(script) * 60;
      }
    } else if (file && file.path) {
      const metadata = await tryCatchError(() => getMetadata(file.path), userId, tjId, 'Error reading file metadata.');
      duration = metadata.format.duration ?? 0;
    } else {
      duration = approximateMinutesFromText(script) * 60;
    }
    // Allow 5 minutes (300 seconds) for horizontal videos, 10 minutes (600 seconds) for vertical/default
    const maxDurationSeconds = orientation === 'horizontal' ? 600 : 600;
    if (duration > maxDurationSeconds) {
      const maxMinutes = orientation === 'horizontal' ? 10 : 10;
      throw new BadRequestError(`Video generation is not supported for videos longer than ${maxMinutes} minutes.`);
    }
    // if ((await userProfileRepository.getGbRemaining(userId)) <= 0 && !userProfile.isAdmin && ENVIRONMENT === 'prod') {
    //   logger.info('User has no storage remaining', {
    //     method: 'generate-data',
    //     'User ID': userId
    //   });
    //   throw new BadRequestError('You have no storage remaining in your subscription.');
    // }
    const tjobj: Partial<ITranscriptionJob> = {
      userId,
      title: title,
      includeMusic,
      brollDuration: parseFloat(brollDuration) || 3.5,
      script,
      jobType: mapUploadTypeToJobType(uploadType),
      status: 'VIDEO_RECEIVED'
    };
    let tj = await transcriptionJobRepository.create(tjobj);
    tjId = tj._id!.toString();

    let uploadedFileUrl: string | undefined = undefined;

    // Handle presigned upload
    if (uploadId) {
      const upload = await uploadService.getUpload(uploadId, userId);
      if (upload.uploadStatus !== 'COMPLETED') {
        throw new BadRequestError('Upload is not completed. Please wait for upload to finish or try again.');
      }
      uploadedFileUrl = upload.url;
    }
    // Handle traditional file upload (legacy)
    else if (file && file.path) {
      await uploadToS3(file.path, `users/${userId}/${tj._id}/${file.filename}`, {
        mimeType: mime.getType(file.path) ?? '',
        originalName: path.parse(file.filename).name,
        fileSize: fs.statSync(file.path).size,
        userId: userId
      });
      uploadedFileUrl = getS3FileUrl(`users/${userId}/${tj._id}/${file.filename}`);
    }
    // Handle external file URL
    else if (fileUrl) {
      uploadedFileUrl = fileUrl;
    }

    try {
      const videoGenerationEventData: VideoGenerationEventDataV3 = {
        guidance,
        userId,
        uploadType,
        includeMusic,
        script,
        fileUrl: uploadedFileUrl,
        brollDuration: 3.5,
        tjId: tjId.toString(),
        isTalkingHead: uploadType === 'video',
        privateLibraryIds,
        publicLibraryIds,
        isVoicePremium,
        voiceType,
        size,
        libraries: {
          pexels
        },
        title: title,
        version: '3.0.0',
        isAllPublicLibrariesSelected,
        orientation: orientation === 'horizontal' ? 'HORIZONTAL' : orientation === 'vertical' ? 'VERTICAL' : undefined
      };

      if (IS_PROD) {
        // Duration-based routing: Use Lambda for videos < 3 minutes (or < 5 minutes for horizontal), job runner for longer videos
        const durationMinutes = duration / 60;
        const maxDurationMinutes = orientation === 'horizontal' ? 5 : 3;
        const useLambda = durationMinutes < maxDurationMinutes;

        await enqueueLambdaVideoGenerationTask(videoGenerationEventData);
      } else {
        const eventV4: VideoGenerationEventDataV4 = { ...videoGenerationEventData, version: '4.0.0' };
        await enqueueLambdaVideoGenerationTask(eventV4);
      }
    } catch (e) {
      file?.path && safelyDelete(file.path);
      sendError(userId, tjId, 'ERROR: An unexpected error occurred.');
      await transcriptionJobRepository.update(tjId, { status: 'FAILED' });
      throw e;
    }
    return tjId;
  }

  /**
   * Clone a sample video for a user
   */
  async cloneSampleVideoForUser(sampleVideoId: string, userId: string) {
    // Use the repository method to clone the video for the user
    return await videoAIDataRepository.cloneForUser(sampleVideoId, userId);
  }
}

export default new VideoService();
