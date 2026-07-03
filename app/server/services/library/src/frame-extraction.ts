import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { logger as structuredLogger } from '../../../services/logging';

// Function to extract a frame from the middle of the video
export function extractMiddleFrames(
  videoPath: string,
  outputImagePath: string,
  logger: (msg: string) => void
): Promise<[string, number, boolean]> {
  return new Promise((resolve, reject) => {
    // Get video metadata to determine the middle frame
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);

      const duration = metadata.format.duration ?? 0;
      if (duration === 0) {
        structuredLogger.error('Error: The duration is 0, stopping processing of this video.');
        return reject('Duration is 0');
      }
      if (duration > 60) {
        structuredLogger.error('Error: The duration is more than 60s, stopping processing of this video.');
        return reject('Duration > 60s');
      }
      const thirdTime = duration / 3; // Get the middle of the video in seconds
      const twoThirdsTime = (duration * 2) / 3; // Get the middle of the video in seconds

      let isVertical = false;
      let aspectRatio = 16 / 9;
      const videoStream = metadata.streams?.find(stream => stream.codec_type === 'video');
      if (videoStream?.width && videoStream?.height) {
        isVertical = videoStream?.width < videoStream?.height;
        aspectRatio = videoStream?.width / videoStream?.height;
      }
      // Extract a frame at the middle time
      ffmpeg(videoPath)
        .on('end', () => {
          logger('Frame extraction complete');
          resolve([outputImagePath, duration, isVertical]);
        })
        .on('error', err => {
          reject(err);
        })
        .screenshots({
          timestamps: [thirdTime, twoThirdsTime], // Capture at the middle of the video
          filename: path.basename(outputImagePath),
          folder: path.dirname(outputImagePath),
          size: `640x${Math.round(640 / aspectRatio)}`
        });
    });
  });
}
