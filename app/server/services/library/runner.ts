import { processVideo } from './src/index';
import dotenv from 'dotenv';
import { Library } from '../../models/library';
import { sendMessage } from '../../services/sockets';
import { ILibraryUpload } from 'shared/types';
import { logger } from '../../services/logging';
import { LibraryUpload } from '../../models/library-upload';
import { LibraryTaskSettings } from 'shared/types';
import { calculateTotalProgress, delay } from 'shared/utils/misc';
import {
  getNewProcessedFiles,
  updateProcessedFileStatus,
} from './src/utils';
import { ILibraryFileUpload } from './src/types';
import { LibraryTaskSettingsModel } from '../../models/library-task-settings';
import { processImage } from './src/process-entry';

// Set a timeout of 8 hours (8 * 60 * 60 * 1000 ms)
const EIGHT_HOURS_MS = 4 * 60 * 60 * 1000;

async function getTaskSettings(): Promise<LibraryTaskSettings> {
  // Check if we're using v2 settings format
  if (process.env.SETTINGS_VERSION === '2.0.0' && process.env.SETTINGS_ID) {
    try {
      // Fetch settings from the database
      // (MongoDB connection is established at app startup via index.ts — no need to connect here)
      const settingsDoc = await LibraryTaskSettingsModel.findById(process.env.SETTINGS_ID);
      if (!settingsDoc) {
        throw new Error(`Could not find settings with ID ${process.env.SETTINGS_ID}`);
      }

      logger.info('Successfully retrieved settings from database', {
        'Settings ID': process.env.SETTINGS_ID
      });

      return settingsDoc.toObject();
    } catch (error) {
      logger.error('Error fetching settings from database', {
        'Settings ID': process.env.SETTINGS_ID,
        error
      });
      throw error;
    }
  } else {
    // Parse settings from environment variable for backward compatibility
    try {
      return JSON.parse(process.env.SETTINGS!);
    } catch (error) {
      logger.error('Error parsing settings from environment variable', { error });
      throw error;
    }
  }
}

const main = async (libraryId: string, options: { shouldExit?: boolean } = {}) => {
  const shouldExit = options.shouldExit !== false;
  const exitTimeout = setTimeout(() => {
    logger.error('ERROR: Process timed out after 8 hours - exiting');
    if (shouldExit) process.exit(1);
    else throw new Error('Process timed out after 8 hours');
  }, EIGHT_HOURS_MS);
  try {
    dotenv.config();

    // MongoDB connection is established at app startup via index.ts — no need to connect here.
    // When running standalone (not via BullMQ), the caller is responsible for connecting.
    logger.info('START', { date: new Date() });
    logger.info('LibraryUpload', { LibraryUpload });
    logger.info('Environment', { environment: process.env.ENVIRONMENT });

    // Get settings from environment or database
    const settings = await getTaskSettings();
    logger.info('Using settings version', { version: process.env.SETTINGS_VERSION || 'v1' });

    const library = await Library.findById(libraryId).populate<{
      processedFiles: ILibraryFileUpload[];
    }>('processedFiles.link');

    if (!library) {
      throw new Error('Library not found');
    }
    try {
      library.status = 'PROCESSING';
      await library.save();
      const newProcessedFiles = getNewProcessedFiles(library, settings);
      const allUploadPromises: {
        uploadLink: {
          link: ILibraryUpload;
          _id: string;
          prompt: string;
          status: 'NEW' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
        };
        settings: LibraryTaskSettings['files'][number];
        promise: Promise<number | void>;
      }[] = [];
      for (const uploadLink of newProcessedFiles) {
        try {
          await updateProcessedFileStatus(
            libraryId,
            uploadLink.settings,
            uploadLink.processedFile._id,
            'PROCESSING',
            0.01
          );
          sendMessage(
            library.userId,
            library._id.toString(),
            `Processing upload link ${uploadLink.processedFile.link.url}`
          );
          const isImage = uploadLink.processedFile.link.url.match(/\.(jpg|jpeg|png|gif|webp|svg|heic)$/i);

          if (isImage) {
            // For images, use the new processImage method
            await processImage({
              file: uploadLink.processedFile.link.url,
              libraryId,
              userId: library.userId,
              isPublic: library.isPublic ?? false,
              prompt: uploadLink.processedFile.prompt ?? '',
              tag: library.title,
              logger: msg => sendMessage(library.userId, library._id.toString(), msg),
              onProgress: async progress => {
                await Library.findByIdAndUpdate(libraryId, {
                  $set: {
                    [`asyncProgress.${uploadLink.settings.fileId}`]: progress
                  }
                });
              }
            });
            await updateProcessedFileStatus(
              libraryId,
              uploadLink.settings,
              uploadLink.processedFile._id,
              'PROCESSED',
              1
            );
          } else {
            // For videos, process the local file
            await processVideo({
              link: uploadLink.processedFile.link.url,
              libraryId,
              userId: library.userId,
              isPublic: library.isPublic ?? false,
              prompt: uploadLink.processedFile.prompt ?? '',
              tag: library.title,
              logger: msg => sendMessage(library.userId, library._id.toString(), msg),
              onContinueWithNext: promise => {
                allUploadPromises.push({
                  uploadLink: uploadLink.processedFile,
                  settings: uploadLink.settings,
                  promise
                });
              },
              onProgress: async progress => {
                await Library.findByIdAndUpdate(libraryId, {
                  $set: {
                    [`asyncProgress.${uploadLink.settings.fileId}`]: progress
                  }
                });
              }
            });
          }
        } catch (e) {
          await updateProcessedFileStatus(libraryId, uploadLink.settings, uploadLink.processedFile._id, 'FAILED', 1);
          logger.error('Error processing upload link', {
            uploadLink: uploadLink.processedFile.link.url,
            error: e
          });
          sendMessage(
            library.userId,
            library._id.toString(),
            `Error processing upload link ${uploadLink.processedFile.link.url}`
          );
        }
      }
      await Promise.allSettled(
        allUploadPromises.map(async ({ promise, uploadLink, settings }) => {
          try {
            await promise;
            await delay(1000);
            await updateProcessedFileStatus(libraryId, settings, uploadLink._id, 'PROCESSED', 1);
          } catch (e) {
            await updateProcessedFileStatus(libraryId, settings, uploadLink._id, 'FAILED', 1);
          }
        })
      );

      sendMessage(library.userId, library._id.toString(), 'Library processed successfully');

      const libraryUpdated = await Library.findById(libraryId);
      logger.info('Library processing finished for this chunk. Checking if all chunks are done.');
      if (!libraryUpdated?.userId) {
        logger.error('Library runner: User id not found', {
          userId: libraryUpdated?.userId
        });
        throw new Error('User email not found');
      } else {
        if (checkLibraryProcessingFinished(libraryUpdated)) {
          await Library.findOneAndUpdate(
            {
              _id: libraryId,
              'asyncProgress.emailSent': { $ne: true }
            },
            {
              $set: { status: 'TAGGING' }
            }
          );
        }
      }
    } catch (e) {
      await Library.findOneAndUpdate(
        {
          _id: libraryId
        },
        {
          $set: { status: 'FAILED' }
        }
      );

      sendMessage(library.userId, library._id.toString(), 'Error processing library');
      throw e;
    }
  } catch (e) {
    logger.error('Error in main', { error: e });
  } finally {
    logger.info('END', { date: new Date() });

    // Do NOT close the MongoDB connection here — it is a shared global connection
    // managed by the app lifecycle (index.ts). Closing it would break other BullMQ workers.
    clearTimeout(exitTimeout);
    if (shouldExit) process.exit(0);
  }
};

export { main };

function checkLibraryProcessingFinished(library: any) {
  logger.info('Job ending, progress', { progress: calculateTotalProgress(library) });
  return calculateTotalProgress(library) === 100;
}
