import { uploadToS3 } from '../storage/s3';
import { getSourceThumbnail } from '../video-manipulation/ffmpeg';


import { safelyDelete } from '../fs';
import { getS3FileUrl } from '../../config/storage';
import { ITranscriptionJob } from '../../types';
import mime from 'mime';
import fs from 'fs';
import { logger } from 'server/services/logging';
import { tryCatchError } from '../../utils/error-handling';
import transcriptionJobRepository from '../../repositories/transcription-job.repository';

async function generateAndUploadThumbnail(
  filepath: string,
  filename: string,
  userId: string,
  tj: ITranscriptionJob,
  scriptOnly?: boolean,
  size?: '1080p' | '1080x1920',
  tmpDir = '/tmp/data'
) {
  const eventId = tj._id!;
  const thumbnailName = `users/${userId}/${filename}_thumbnail.png`;
  let thumbnailPath = `${tmpDir}/${filename}_thumbnail.png`;
  const thumbnailUrl = getS3FileUrl(thumbnailName);
  if (scriptOnly) {
    thumbnailPath =
      (() => {
        switch (size) {
          case '1080p':
            return './images/video_bg_hd.png';
          case '1080x1920':
            return './images/video_bg_1080x1920.png';
        }
      })() ?? '';
  } else {
    await tryCatchError(
      () => getSourceThumbnail(filepath, thumbnailPath),
      userId,
      eventId,
      'Error generating thumbnail.'
    );
  }
  await tryCatchError(
    () =>
      uploadToS3(thumbnailPath, thumbnailName, {
        mimeType: mime.getType(thumbnailPath) ?? '',
        originalName: thumbnailName,
        fileSize: fs.statSync(thumbnailPath).size,
        userId: userId
      }),
    userId,
    eventId,
    'Error uploading thumbnail to cloud.'
  );
  tj.thumbnailUrl = thumbnailUrl;
  !scriptOnly && safelyDelete(thumbnailPath);

  await transcriptionJobRepository.save(tj);

  return thumbnailUrl;
}

export { tryCatchError, generateAndUploadThumbnail };
