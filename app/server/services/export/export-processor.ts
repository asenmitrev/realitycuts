import { sendMessage, sendData } from '../sockets';
import { VideoAIData } from '../../models/video-ai-data';
import { uploadToS3 } from '../storage/s3';
import { tryCatchError } from '../../utils/error-handling';
import { safelyDelete } from '../fs';
import { exportGrayVideo, exportVideo, recropVerticalVideo } from './exporter';
import { ExportJob } from '../../models/export-job';
import { getS3FileUrl } from '../../config/storage';
import { ITranscriptionJob, IVideoAIDataWithTranscriptionJob } from '../../types';
import { HighlightInstance } from '../../models/highlight-instance';
import { trimAndRemoveWords } from '../video-manipulation/trimming';
import { TranscriptionJob } from '../../models/transcription-job';
import { addCaptionsToVideo } from '../video-manipulation/captions';
import { HighlightSegment, WordBaseEdited } from '../../types/video-ai-data';
import { getAdjustedVisibleWords, getSegments } from 'shared/utils/trimming';
import { adjustRecropData } from 'shared/utils/vertical';
import moment from 'moment';
import fs from 'fs';
import { logger } from '../logging';
import { addWatermark, appendEndscreen, generateVideoFromAudio, getMetadata } from '../video-manipulation/ffmpeg';
import { UserProfile } from '../../models/user-profile';
import notificationRepository from '../../repositories/notification.repository';
import { CaptionSettings, RecroppedVideoFrame } from 'shared/types';
import { ENVIRONMENT } from '../../config/const';
import { S3Upload } from '../../models/s3-upload';
import { BrandAsset } from '../../models/brand-asset';
import { downloadFile } from '../fs';
// Import function locally to avoid circular dependencies - will define inline
const DEFAULT_CAPTIONS: CaptionSettings = {
  primaryColor: '#ffffff',
  outlineColor: '#000000',
  highlightedWordColor: '#ffffff',
  fontFamily: 'Montserrat-Bold',
  isUppercase: true,
  maxCharactersPerLine: 20,
  numberOfLines: 1,
  type: 'WORD_HIGHLIGHT',
  fontSize: 90,
  activeWordFontSize: 90,
  verticalFontSize: 120,
  verticalActiveWordFontSize: 120,
  marginV: 15,
  outlineWidth: 5,
  shadow: 4
};

export const exportJobProcessor = async (jobId: string) => {
  const job = await ExportJob.findById(jobId);
  if (!job) {
    return logger.error(`Export job not found...`);
  }
  const i = TranscriptionJob;
  const userId = job.userId;
  job.status = 'PROCESSING';
  await job.save();
  logger.info(`Processing export job ${jobId} for user ${userId}`);
  try {
    let videoAiDataModel = await VideoAIData.findById(job.videoDataId).populate<{
      transcriptionJob: ITranscriptionJob;
    }>('transcriptionJob');
    if (!videoAiDataModel) {
      return sendMessage(userId, jobId, `Your export details could not be found...`, 1);
    }
    let videoAiData = videoAiDataModel.toObject() as unknown as IVideoAIDataWithTranscriptionJob;
    sendMessage(userId, job._id, `Your project is stuck in traffic on the way to export. We're clearing the way!`, 2);

    // Generate black-bg source for chat-generated videos that have no source yet
    if (!videoAiData.source) {
      if (!videoAiData.voiceOver) {
        await sendMessage(userId, job._id, 'Export failed: no source or voiceover.', 1);
        throw new Error('Cannot export video without source or voiceover.');
      }
      let audioPath = '';
      let generatedVideoPath = '';
      try {
        sendMessage(userId, job._id, 'Generating source video from audio...', 3);
        audioPath = `./data/${Date.now()}-voiceover.mp3`;
        await downloadFile(audioPath, videoAiData.voiceOver);
        const [, videoPath] = await generateVideoFromAudio(
          audioPath,
          '1080p',
          percent =>
            percent && sendMessage(userId, job._id, 'Creating source video...', 3 + Math.round((percent * 10) / 100)),
          './data'
        );
        generatedVideoPath = videoPath;
        const metadata = await getMetadata(videoPath);
        const videoStream = metadata.streams?.find(stream => stream.codec_type === 'video');
        const recropData: RecroppedVideoFrame = {
          x1: (1920 - 1080) / 2,
          x2: 1920 - (1920 - 1080) / 2,
          y1: 0,
          y2: 1080,
          frameStart: 0,
          frameEnd: parseInt(videoStream?.nb_frames ?? '0', 10),
          timeStart: 0,
          timeEnd: parseFloat(videoStream?.duration ?? '0')
        };
        const s3Filename = `users/${userId}/chat-source-${Date.now()}.mp4`;
        await uploadToS3(videoPath, s3Filename, {
          mimeType: 'video/mp4',
          originalName: s3Filename.split('/').pop() ?? 'source.mp4',
          fileSize: fs.statSync(videoPath).size,
          userId
        });
        const videoUrl = getS3FileUrl(s3Filename);
        await VideoAIData.findByIdAndUpdate(job.videoDataId, {
          source: { url: videoUrl, metadata, thumbnail: '' },
          croppedInfo: [recropData]
        });
        videoAiData = {
          ...videoAiData,
          source: { url: videoUrl, metadata, thumbnail: '' },
          croppedInfo: [recropData]
        };
      } finally {
        audioPath && safelyDelete(audioPath);
        generatedVideoPath && safelyDelete(generatedVideoPath);
      }
    }

    if (!videoAiData.source) {
      throw new Error('Source is required for export.');
    }
    const source = videoAiData.source;

    const exportType = job.exportType ?? 'VIDEO_CAPTIONS';
    const orientationType = job.orientationType ?? 'HORIZONTAL';

    const dimensions = {
      height: source.metadata.streams[0]?.height ?? 0,
      width: source.metadata.streams[0]?.width ?? 0
    };

    let outputFileName = `${Date.now()}.mp4`;
    let outputVideoLocation: string | undefined = undefined;
    let recropData = videoAiData.croppedInfo;
    let highlight: any | undefined;
    let highlightSegments: HighlightSegment[] | undefined;
    let title: string | undefined = undefined;
    if (
      videoAiData.highlightInstanceId ||
      (videoAiData.editedWordsList &&
        videoAiData.editedWordsList.filter((word: WordBaseEdited) => word.isVisible === false).length > 0)
    ) {
      const hl = await HighlightInstance.findById(videoAiData.highlightInstanceId);
      highlight = hl;

      if (highlight || (videoAiData.editedWordsList && videoAiData.editedWordsList.length > 0)) {
        title = highlight?.title ?? videoAiData.title;

        sendMessage(userId, job._id, `Splicing some celluloid tape together...`, 5);
        highlightSegments = getSegments(highlight?.editedWordsList ?? videoAiData.editedWordsList);
        const [fn, previewVideoLocation] = await tryCatchError(
          () =>
            trimAndRemoveWords(highlightSegments!, source.url, percent => {
              percent &&
                sendMessage(
                  userId,
                  job._id,
                  `Cutting pieces of video tape together...`,
                  Math.floor(5 + (10 * percent) / 100)
                );
            }),
          userId,
          job._id,
          'Error exporting preview.'
        );

        if (recropData) {
          recropData = adjustRecropData(recropData, highlightSegments);
        }
        outputFileName = fn;
        outputVideoLocation = previewVideoLocation;
      }
    }
    if (recropData && recropData.length > 0 && orientationType === 'VERTICAL') {
      const [filename, videoLocation] = await tryCatchError(
        () =>
          recropVerticalVideo(recropData!, outputVideoLocation ?? source.url, msg => {
            sendMessage(userId, job._id, msg, 17);
          }),
        userId,
        job._id,
        'Error exporting video.'
      );

      outputVideoLocation && safelyDelete(outputVideoLocation);
      outputFileName = filename;
      outputVideoLocation = videoLocation;
    }

    if (
      (videoAiData.segments.length > 0 || (videoAiData.audio.length > 0 && videoAiData.audioEnabled)) &&
      (exportType === 'VIDEO' || exportType === 'VIDEO_CAPTIONS')
    ) {
      sendMessage(userId, job._id, `Our pet fox has gone out to Blockbuster to fetch your b-roll!`, 20);
      const [filename, videoLocation] = await tryCatchError(
        () =>
          exportVideo(
            userId,
            videoAiData,
            highlightSegments ?? [],
            outputVideoLocation ?? source.url,
            percent => {
              percent &&
                sendMessage(
                  userId,
                  job._id,
                  `Our assistant editor got distracted by TikTok. Don't worry, they're back on track!`,
                  Math.floor(20 + (60 * percent) / 100)
                );
            }
          ),
        userId,
        job._id,
        'Error exporting video.'
      );

      outputVideoLocation && safelyDelete(outputVideoLocation);
      outputFileName = filename;
      outputVideoLocation = videoLocation;
    } else if (exportType === 'CAPTIONS') {
      const [filename, videoLocation] = await tryCatchError(
        () =>
          exportGrayVideo(source.metadata.format?.duration ?? 60, dimensions, percent => {
            percent && sendMessage(userId, job._id, `Generating Background Video Progress: ${percent?.toFixed(2)}%`);
          }),
        userId,
        job._id,
        'Error exporting video.'
      );

      outputVideoLocation && safelyDelete(outputVideoLocation);
      outputFileName = filename;
      outputVideoLocation = videoLocation;
    }

    if (exportType === 'CAPTIONS' || exportType === 'VIDEO_CAPTIONS') {
      const captionedVideoFilename = `captioned-${outputFileName}`;
      const captionedVideoLocation = `./data/${captionedVideoFilename}`;
      const transcript = videoAiData.editedWordsList
        ? getAdjustedVisibleWords(videoAiData.editedWordsList as WordBaseEdited[])
        : videoAiData.transcriptionJob.deepgramResults?.results.channels[0].alternatives[0].words ?? [];
      sendMessage(userId, job._id, `Our server is sweating through the export—please send snacks...`, 80);
      await tryCatchError(
        () =>
          addCaptionsToVideo({
            videoPath: outputVideoLocation ?? source.url,
            outputVideoPath: captionedVideoLocation,
            transcript,
            subtitleSettings: videoAiData.captions ?? DEFAULT_CAPTIONS,
            onProgress: percent =>
              sendMessage(
                userId,
                job._id,
                `The timeline crashed. Don't worry, we're rebuilding—brick by brick!`,
                Math.floor(80 + (10 * percent) / 100)
              )
          }),
        userId,
        job._id,
        'Error adding captions.'
      );
      outputVideoLocation && safelyDelete(outputVideoLocation);
      outputVideoLocation = captionedVideoLocation;
    }

    const userProfile = await UserProfile.findOne({ firebaseId: userId });

    // Determine if watermark should be applied

    let watermarkedVideoLocation: string | undefined = undefined;

    // Prefer custom brand watermark if job specifies and user has entitlement
    const brandEntitled = (userProfile?.entitlements ?? []).some(
      e => (e.name as unknown as string) === 'brand-watermark'
    );
    const brandUploadId = job.brandWatermarkUploadId;
    const brandPosition = job.brandWatermarkPosition as any;

    const shouldAddWatermark = brandEntitled && !!brandUploadId;
    if (shouldAddWatermark) {
      const watermarkedFilename = brandUploadId ? `${outputFileName}-branded.mp4` : `${outputFileName}-watermarked.mp4`;
      watermarkedVideoLocation = `./data/${watermarkedFilename}`;

      if (brandEntitled && brandUploadId) {
        // Resolve brand asset to S3 upload and download logo
        const asset = await BrandAsset.findById(brandUploadId);
        const s3UploadId = asset?.s3UploadId;
        const brandUpload = s3UploadId ? await S3Upload.findById(s3UploadId) : null;
        if (brandUpload?.url) {
          const watermarkTmpPath = `./data/${Date.now()}-${brandUpload.fileName}`;
          await downloadFile(watermarkTmpPath, brandUpload.url);
          await addWatermark(
outputVideoLocation ?? source.url,
          watermarkedVideoLocation,
          {
            position: brandPosition ?? 'top-right',
              padding: 120,
              watermarkImagePath: watermarkTmpPath
            },
            progress =>
              sendMessage(
                userId,
                job._id,
                `Your project is starring in a dramatic 'Percent Complete' saga.`,
                Math.floor(90 + (5 * progress) / 100)
              )
          );
          safelyDelete(watermarkTmpPath);
        } else {
          watermarkedVideoLocation = undefined;
        }
      } else {
        // Add default watermark
        await addWatermark(
          outputVideoLocation ?? source.url,
          watermarkedVideoLocation,
          {
            position: 'top-right',
            padding: 120,
            maxSize: 312
          },
          progress =>
            sendMessage(
              userId,
              job._id,
              `Your project is starring in a dramatic 'Percent Complete' saga.`,
              Math.floor(90 + (5 * progress) / 100)
            )
        );
      }

      // Replace the main output with the watermarked version
      outputVideoLocation && safelyDelete(outputVideoLocation);
      outputVideoLocation = watermarkedVideoLocation;
      watermarkedVideoLocation = undefined; // Clear since we're using it as main output
    }

    // Determine if endscreen should be added (UAT environment only)
    const shouldAddEndscreen = ENVIRONMENT === 'uat' && orientationType === 'VERTICAL';

    // Add endscreen for UAT environment
    if (shouldAddEndscreen && outputVideoLocation) {
      const endscreenNumber = Math.random() < 0.5 ? 1 : 2;
      const endscreenPath = `./videos/endscreen-${endscreenNumber}.mp4`;
      const endscreenVideoFilename = `endscreen-${outputFileName}`;
      const endscreenVideoLocation = `./data/${endscreenVideoFilename}`;

      await tryCatchError(
        () =>
          appendEndscreen(outputVideoLocation!, endscreenVideoLocation, endscreenPath, percent =>
            sendMessage(userId, job._id, `Adding the finishing touches...`, Math.floor(95 + (5 * percent) / 100))
          ),
        userId,
        job._id,
        'Error adding endscreen.'
      );
      watermarkedVideoLocation && safelyDelete(watermarkedVideoLocation);
      watermarkedVideoLocation = endscreenVideoLocation;
    }

    sendMessage(
      userId,
      job._id,
      `Your project is so large, it's being sent by carrier pigeon... digitally speaking...`,
      99
    );

    // Determine which video to upload as the main video (for download)
    const mainVideoForUpload = watermarkedVideoLocation || outputVideoLocation;
    outputFileName = `users/${userId}/${sanitizeString(title ?? videoAiData.title ?? 'video')}_${outputFileName}`;
    const expireDate = moment(new Date()).add(5, 'days').toDate();

    // Upload main video (watermarked if available, otherwise non-watermarked)
    await tryCatchError(
      () =>
        uploadToS3(
          mainVideoForUpload ?? source.url,
          outputFileName,
          {
            mimeType: 'video/mp4',
            originalName: outputFileName,
            fileSize: fs.statSync(mainVideoForUpload ?? source.url).size,
            userId: userId
          },
          expireDate
        ),
      userId,
      job._id,
      'Error uploading video to cloud.'
    );

    const videoUrl = getS3FileUrl(outputFileName);

    // Copy AI thumbnail from TranscriptionJob to ExportJob if it exists
    const tj = videoAiData.transcriptionJob;
    if (tj?.isAiThumbnail && tj?.thumbnailUrl) {
      job.thumbnailUrl = tj.thumbnailUrl;
      await job.save();
      logger.info('AI thumbnail copied to export job', {
        'Export Job ID': job._id,
        'User ID': userId,
        'Thumbnail URL': tj.thumbnailUrl
      });
    }

    job.videoUrl = videoUrl;
    job.status = 'COMPLETED';
    await job.save();

    if (job.youtubeUpload?.channelId) {
      const { enqueueYouTubeUploadTaskBullMQ } = await import('../task-queue.js');
      await enqueueYouTubeUploadTaskBullMQ(job._id.toString());
    }

    await sendData(userId, job._id, { isExport: true, _id: job._id });

    // Send export completion notification
    await notificationRepository.create({
      userId,
      type: 'EXPORT_COMPLETE',
      title: 'Export Complete!',
      message: 'Your export for ' + (title ?? videoAiData.title ?? 'Untitled Video') + ' is ready to download!',
      links: [{ linkType: 'EXPORT', docId: job._id }]
    });

    // Clean up local video files
    outputVideoLocation && safelyDelete(outputVideoLocation);
    watermarkedVideoLocation && safelyDelete(watermarkedVideoLocation);
  } catch (e: any) {
    logger.error('Error processing export job', {
      Error: e?.toString(),
      Stack: e?.stack,
      'Export Job ID': jobId
    });
    job.status = 'FAILED';
    await job.save();
  }
};
export function sanitizeString(str: string) {
  // Replace whitespace with a single underscore
  // Remove all characters that are not letters, numbers, or underscore
  return str
    .replace(/\s+/g, '_') // Replace one or more whitespace characters with a single underscore
    .replace(/[^a-zA-Z0-9_]/g, '') // Remove all characters except letters, numbers, and underscore
    .toLowerCase()
    .substring(0, 15); // Optional: convert to lowercase (remove if you want to preserve case)
}
