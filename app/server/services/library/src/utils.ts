import { Library } from '../../../models/library';
import { LibraryTaskSettings } from 'shared/types';
import { ILibraryFileUpload, PopulatedLibrary } from './types';
import fs from 'fs';

export const retryFunction = async <T>(
  fn: () => Promise<T>,
  retries: number = 3,
  logger: (message: string) => void
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    const err = error as any;
    if (err.stderr) logger(`Retry error stderr: ${err.stderr}`);
    if (err.stdout) logger(`Retry error stdout: ${err.stdout}`);
    if (err.code !== undefined) logger(`Retry error exitCode: ${err.code}`);
    logger(`Retry error: ${error}`);
    if (retries <= 0) throw error;
    logger(`Retrying... ${retries} attempts remaining`);
    return retryFunction(fn, retries - 1, logger);
  }
};

// Function to encode the image to base64
export function encodeImageToBase64(imagePath: string) {
  const imageBuffer = fs.readFileSync(imagePath); // Read the image file as a buffer
  const base64Image = imageBuffer.toString('base64'); // Convert buffer to base64
  return base64Image;
}

export const updateProcessedFileStatus = async (
  libraryId: string,
  settings: LibraryTaskSettings['files'][number],
  fileId: string,
  status: 'PROCESSING' | 'FAILED' | 'PROCESSED',
  progress: number
) => {
  await Library.findOneAndUpdate(
    {
      _id: libraryId,
      'processedFiles._id': fileId
    },
    {
      $set: { 'processedFiles.$.status': status, [`asyncProgress.${settings.fileId}`]: progress }
    }
  );
};

export const getNewProcessedFiles = (library: PopulatedLibrary, settings: LibraryTaskSettings) => {
  return (
    settings.files
      ?.map(file => {
        const processedFile = library.processedFiles
          .filter(i => !!i.link)
          .find(i => {
            return i.link._id?.toString() === file.fileId;
          });
        if (!processedFile) {
          return null;
        }
        return {
          processedFile,
          settings: file
        };
      })
      .filter(
        (v): v is { processedFile: ILibraryFileUpload; settings: LibraryTaskSettings['files'][number] } => v !== null
      ) ?? []
  );
};

export const ensureDirectoryExists = (path: string) => {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
  }
};
