import path from 'path';
import { uploadToS3 } from '../../../services/storage/s3';
import fs from 'fs';
import { getS3FileUrl } from '../../../config/storage';
import { customAlphabet } from 'nanoid';
const nanoid = customAlphabet('1234567890abcdef', 5);
import { ensureDirectoryExists } from './utils';
import { extractMiddleFrames } from './frame-extraction';
import brollRepository from '../../../repositories/broll.repository';
import { downloadFile } from '../../../services/fs';
import { enqueueLibraryItemPreviewGeneratorTask, enqueueLibraryItemVideoEmbeddingTask } from '../../../services/task-queue';
import { zoomIn } from './image-effects';
import { ThumbnailDuplicateDetector } from '../../../services/video-generation/v11-proper-context/utils/thumbnail-duplicate-detector';
import promiseSpawn from '@npmcli/promise-spawn';
import ffmpeg from 'fluent-ffmpeg';
import { logger as structuredLogger } from '../../../services/logging';
export const getImageDescription = async ({
  inputVideoPath,
  timestamp,
  logger
}: {
  inputVideoPath: string;
  timestamp: string;
  logger: (msg: string) => void;
}): Promise<[string, string, number, boolean]> => {
  ensureDirectoryExists(`./tmp/${timestamp}`);
  const outputPath = `./tmp/${timestamp}/screenshot-${path.basename(inputVideoPath)}.png`;
  const outputPath1 = `./tmp/${timestamp}/screenshot-${path.basename(inputVideoPath)}_1.png`;
  const outputPath2 = `./tmp/${timestamp}/screenshot-${path.basename(inputVideoPath)}_2.png`;
  const [, duration, isVertical] = await extractMiddleFrames(inputVideoPath, outputPath, logger);
  return [outputPath1, outputPath2, duration, isVertical];
};

export const processSingleEntry = async ({
  outputDirectory,
  file,
  timestamp,
  logger,
  userId,
  isReprocess = false,
  libraryId
}: {
  outputDirectory: string;
  file: string;
  timestamp: string;
  logger: (msg: string) => void;
  userId: string;
  libraryId: string;
  isReprocess?: boolean;
}): Promise<[string, string, string, number, boolean]> => {
  const inputPath = `./${outputDirectory}/${file}`;
  const timestamp2 = new Date().getTime();
  const name = `/users/${userId}/library/${libraryId}/${timestamp2}-${nanoid()}.mp4`;

  logger('Getting video thumbnails...');
  const [thumbnailPath1, thumbnailPath2, duration, isVertical] = await getImageDescription({
    inputVideoPath: inputPath,
    timestamp,
    logger
  });

  if (!isReprocess) {
    logger('Uploading file to s3...');
    await uploadToS3(inputPath, name, {
      mimeType: 'video/mp4',
      originalName: name,
      fileSize: fs.statSync(inputPath).size,
      userId
    });
  }
  const url = getS3FileUrl(name);
  const uniqueId = nanoid();
  const thumbnailName = `/users/${userId}/library/${libraryId}/${timestamp2}-${uniqueId}-thumbnail.png`;
  if (!isReprocess) {
    await uploadToS3(thumbnailPath1, thumbnailName, {
      mimeType: 'image/png',
      originalName: thumbnailName,
      fileSize: fs.statSync(thumbnailPath1).size,
      userId
    });
  }
  const thumbnailName2 = `/users/${userId}/library/${libraryId}/${timestamp2}-${uniqueId}-thumbnail2.png`;
  await uploadToS3(thumbnailPath2, thumbnailName2, {
    mimeType: 'image/png',
    originalName: thumbnailName2,
    fileSize: fs.statSync(thumbnailPath2).size,
    userId
  });
  const thumbnailUrl = getS3FileUrl(thumbnailName);
  const thumbnailUrl2 = getS3FileUrl(thumbnailName2);

  return [url, thumbnailUrl, thumbnailUrl2, duration, isVertical];
};

const convertHeicToJpg = async (inputPath: string, outputPath: string) => {
  // First convert HEIC to JPG
  await promiseSpawn('heif-convert', [inputPath, outputPath]);

  // Check dimensions and resize if necessary
  const tempOutputPath = outputPath.replace('.png', '_resized.png');

  return new Promise<void>((resolve, reject) => {
    ffmpeg.ffprobe(outputPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
      if (!videoStream?.width || !videoStream?.height) {
        reject(new Error('Could not determine image dimensions'));
        return;
      }

      const { width, height } = videoStream;
      const maxDimension = Math.max(width, height);

      // If dimensions are within limit, just resolve
      if (maxDimension <= 2048) {
        resolve();
        return;
      }

      // Calculate new dimensions maintaining aspect ratio
      const scale = 2048 / maxDimension;
      const newWidth = Math.floor(width * scale);
      const newHeight = Math.floor(height * scale);

      // Resize the image
      ffmpeg(outputPath)
        .videoFilter(`scale=${newWidth}:${newHeight}:flags=lanczos`)
        .output(tempOutputPath)
        .on('end', () => {
          // Replace original with resized version
          fs.renameSync(tempOutputPath, outputPath);
          resolve();
        })
        .on('error', err => {
          // Clean up temp file if it exists
          if (fs.existsSync(tempOutputPath)) {
            fs.unlinkSync(tempOutputPath);
          }
          reject(err);
        })
        .run();
    });
  });
};

export const processImage = async ({
  isPublic,
  file,
  logger,
  tag,
  userId,
  prompt,
  libraryId,
  onProgress
}: {
  isPublic: boolean;
  file: string;

  tag: string;
  prompt: string;
  logger: (msg: string) => void;
  userId: string;
  libraryId: string;
  onProgress?: (progress: number) => void;
}) => {
  structuredLogger.info('processing image', { file });
  const tempDir = `/tmp/data/${nanoid()}`;
  const timestamp = `${new Date().getTime()}`;
  const duration = 10;
  try {
    fs.mkdirSync(tempDir, { recursive: true });
    onProgress?.(0.05);
    let downloadPath = path.join(tempDir, `original${path.extname(file)}`);
    await downloadFile(downloadPath, file);
    if (path.extname(file).toLowerCase().includes('.heic')) {
      const newPath = path.join(tempDir, `original.png`);
      await convertHeicToJpg(downloadPath, newPath);
      fs.unlinkSync(downloadPath);
      downloadPath = newPath;
    }

    // 4. Verify it's an image file
    const { default: mime } = await import('mime');
    const mimeType = mime.getType(downloadPath);
    if (!mimeType?.startsWith('image/')) {
      throw new Error('File is not an image');
    }
    onProgress?.(0.2);

    // 5. Randomly choose zoom in or out
    const outputVideoPath = path.join(tempDir, 'output.mp4');

    await zoomIn(downloadPath, outputVideoPath, duration);
    onProgress?.(0.9);

    // 6. Generate thumbnails
    const [thumbnail1Path, thumbnail2Path, , isVertical] = await getImageDescription({
      inputVideoPath: outputVideoPath,
      timestamp,
      logger
    });
    onProgress?.(0.95);

    // 7. Upload files to S3
    const uniqueId = nanoid();
    // Upload video
    const videoKey = `/users/${userId}/library/${libraryId}/${timestamp}-${uniqueId}-video.mp4`;
    await uploadToS3(outputVideoPath, videoKey, {
      mimeType: 'video/mp4',
      originalName: 'output.mp4',
      fileSize: fs.statSync(outputVideoPath).size,
      userId
    });

    // Upload thumbnails
    const thumbnail1Key = `/users/${userId}/library/${libraryId}/${timestamp}-${uniqueId}-thumbnail1.jpg`;
    const thumbnail2Key = `/users/${userId}/library/${libraryId}/${timestamp}-${uniqueId}-thumbnail2.jpg`;

    await Promise.all([
      uploadToS3(thumbnail1Path, thumbnail1Key, {
        mimeType: 'image/jpeg',
        originalName: 'thumbnail1.jpg',
        fileSize: fs.statSync(thumbnail1Path).size,
        userId
      }),
      uploadToS3(thumbnail2Path, thumbnail2Key, {
        mimeType: 'image/jpeg',
        originalName: 'thumbnail2.jpg',
        fileSize: fs.statSync(thumbnail2Path).size,
        userId
      })
    ]);

    const perceptualHash = await ThumbnailDuplicateDetector.getPerceptualHash(getS3FileUrl(thumbnail1Key));

    // Update broll with new URLs
    const broll = await brollRepository.create({
      url: getS3FileUrl(videoKey),
      thumbnailUrl: getS3FileUrl(thumbnail1Key),
      thumbnailUrl2: getS3FileUrl(thumbnail2Key),
      brollType: 'IMAGE',
      status: 'NEW',
      perceptualHash,
      originalYoutubeUrl: file,
      title: '',
      userId,
      libraryId,
      isPublic,
      duration,
      isVertical,
      tag
    });

    if (!broll._id) {
      throw new Error('Failed to create broll');
    }

    // 8. Enqueue video classification task
    await enqueueLibraryItemVideoEmbeddingTask({
      brollId: broll._id,
      userId,
      prompt,
      ytVideoDescription: '',
      version: '1.0.0'
    });

    await enqueueLibraryItemPreviewGeneratorTask({
      brollId: broll._id,
      userId,
      version: '1.0.0'
    });
    onProgress?.(1);
  } finally {
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};
