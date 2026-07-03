import path from 'path';
import { uploadToS3 } from '../../../services/storage/s3';
import fs from 'fs';
import { execSync } from 'child_process';
import promiseSpawn from '@npmcli/promise-spawn';
import { IBrollFootageMetadata, LibraryTaskSettings } from 'shared/types';
import { downloadFile, readFilesInDirectory } from '../../../services/fs';
import { isLongVideo, chunkVideo, checkAndConvertAV1 } from '../../../services/video-manipulation/ffmpeg';
import { ensureDirectoryExists } from './utils';
import { processSingleEntry } from './process-entry';
import { LibraryItemVideoEmbeddingEventData } from 'shared/types/event-contracts';
import { enqueueLibraryItemPreviewGeneratorTask, enqueueLibraryItemVideoEmbeddingTask } from '../../../services/task-queue';
import { customAlphabet } from 'nanoid';
import { BrollFootageMetadata } from '../../../models/broll-video-metadata';
import { ThumbnailDuplicateDetector } from '../../../services/video-generation/v11-proper-context/utils/thumbnail-duplicate-detector';
import { logger as structuredLogger } from '../../../services/logging';
const customNanoId = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 5);
const ASYNC_BATCH_SIZE = 5;

export const processVideo = async ({
  link,
  tag,
  prompt,
  userId,
  libraryId,
  isPublic,
  settings,
  logger,
  onContinueWithNext,
  onProgress
}: {
  link: string;
  tag: string | undefined;
  userId: string;
  prompt: string;
  libraryId: string;
  isPublic: boolean;
  settings?: LibraryTaskSettings['files'][number];
  logger: (msg: string) => void;
  onProgress: (progressPercent: number) => void;
  onContinueWithNext: (promise: Promise<number | void>) => void;
}) => {
  const downloadAndSplit = async (
    link: string,
    outputDirectory: string,
    timestamp: string,
    onFileDownloaded: () => void
  ) => {
    ensureDirectoryExists('./tmp');
    ensureDirectoryExists(`./tmp/${timestamp}`);
    ensureDirectoryExists('./in');
    ensureDirectoryExists(outputDirectory);

    const inputVideo = `./tmp/${timestamp}/${timestamp}.mp4`;
    await downloadFile(inputVideo, link);
    onFileDownloaded();
    onProgress(0.2);
    logger(`Finished downloading video with link: ${link}`);
    logger(`Started splitting video with link: ${link}`);
    await promiseSpawn(
      `scenedetect`,
      [
        '-i',
        inputVideo,
        '-m',
        '2.0',
        '--drop-short-scenes',
        'detect-adaptive',
        'detect-hist',
        'split-video',
        '-o',
        outputDirectory,
        '-hq',
        '-p',
        'veryfast'
      ],
      {
        stdio: 'inherit'
      }
    );
    onProgress(0.3);
  };

  const chunkVideos = async (files: string[], directory: string): Promise<string[]> => {
    return new Promise(async (resolve, reject) => {
      try {
        const allChunkedFiles: string[] = [];
        await Promise.all(
          files.map(async file => {
            const filePath = path.join(directory, file);
            const stats = fs.statSync(filePath);
            if (stats.isFile() && (await isLongVideo(filePath))) {
              logger(`Chunking ${filePath}`);
              const chunkedDir = await chunkVideo(filePath, directory);
              const chunkedFiles = await readFilesInDirectory(path.join(directory, chunkedDir));
              chunkedFiles.forEach(file => {
                allChunkedFiles.push(path.join(chunkedDir, file));
              });
            }
          })
        );
        resolve(allChunkedFiles);
      } catch (e) {
        reject(e);
      }
    });
  };

  const processSingleVideo = async (onFileDownloaded: () => void) => {
    const timestamp = customNanoId();
    try {
      const outputDirectory = `./in/${timestamp}`;
      logger(`Downloading video with link: ${link}`);
      onProgress(0.1);
      await downloadAndSplit(link, outputDirectory, timestamp, onFileDownloaded);
      logger(`Finished splitting video with link: ${link}`);
      let files = await readFilesInDirectory(outputDirectory);
      logger(`FILES READ: ${files.length} files`);

      try {
        logger('Attempting to chunk videos...');
        const chunkedFiles = await chunkVideos(files, outputDirectory);
        files.push(...chunkedFiles.map(f => f.replace(outputDirectory, '')));
      } catch (e) {
        logger('Error chunking videos ' + e);
      }

      const out = [];
      const n = ASYNC_BATCH_SIZE;
      for (let i = 0; i < files.length; i += n) {
        const chunk = files.slice(i, i + n);

        const chunkResults = await Promise.all(
          chunk.map(async file => {
            logger(`Processing file ${files.indexOf(file)}`);
            try {
              const [videoUrl, thumbnailUrl, thumbnailUrl2, duration, isVertical] = await processSingleEntry({
                outputDirectory,
                file,
                timestamp,
                logger,
                userId,
                libraryId
              });
              const perceptualHash = await ThumbnailDuplicateDetector.getPerceptualHash(thumbnailUrl);
              const broll: IBrollFootageMetadata = {
                url: videoUrl,
                userId,
                libraryId,
                status: 'NEW',
                isPublic,
                thumbnailUrl,
                thumbnailUrl2,
                duration,
                perceptualHash,
                isVertical,
                tag,
                originalYoutubeUrl: link,
                title: ''
              };
              const savedBroll = await new BrollFootageMetadata(broll).save();
              const eventData: LibraryItemVideoEmbeddingEventData = {
                brollId: savedBroll._id.toString(),
                userId,
                prompt,
                ytVideoDescription: '',
                version: '1.0.0'
              };
              await enqueueLibraryItemVideoEmbeddingTask(eventData);
              await enqueueLibraryItemPreviewGeneratorTask({
                brollId: savedBroll._id.toString(),
                userId,
                version: '1.0.0'
              });
              await onProgress(Math.round((0.3 + ((files.indexOf(file) + 1) / files.length) * 0.7) * 100) / 100);
              return true;
            } catch (e) {
              structuredLogger.error('Error processing file. Continuing...', { file, link, error: e });
              logger('Error processing file ' + file + '. Continuing...');
              return false;
            }
          })
        );
        out.push(...chunkResults);
      }
      execSync(`rm -rf ./in/${timestamp} && rm -rf ./tmp/${timestamp}`);

      return 0;
    } catch (e) {
      execSync(`rm -rf ./in/${timestamp} && rm -rf ./tmp/${timestamp}`);
      throw e;
    }
  };

  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      reject('Timeout');
    }, 60 * 60 * 1000);
    try {
      const processPromise = processSingleVideo(() => {
        processPromise && onContinueWithNext(processPromise);
        clearTimeout(timeout);
        resolve(true);
      }).catch(e => {
        logger('Error processing video ' + e);
        clearTimeout(timeout);
        reject(e);
      });
    } catch (e) {
      clearTimeout(timeout);
      reject(e);
    }
  });
};
