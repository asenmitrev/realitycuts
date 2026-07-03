import ffmpeg from 'fluent-ffmpeg';
import { getMetadata } from './ffmpeg';
import fs from 'fs';
import { CaptionSettings, WordBase } from '../../types';
import { getAssFileString } from 'shared/utils/captions';
import { logger } from '../logging';

type OnProgressCallback = (percent: number) => void;

function processVideo(
  videoPath: string,
  outputVideoPath: string,
  subtitleFile: string,
  fontName: string = 'Roboto',
  onProgress: OnProgressCallback
) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(videoPath);
    command
      .videoFilter(`subtitles=${subtitleFile}:fontsdir=./fonts:force_style='FontName=${fontName}'`)
      .outputOptions('-c:a', 'aac') // Audio codec
      .outputOptions('-ar', '48000') // Audio sample rate (48kHz max)
      .outputOptions('-b:a', '192k') // Audio bitrate (192kbps - increased for better audio quality)
      .outputOptions('-c:v', 'libx264') // Video codec
      .outputOptions('-pix_fmt', 'yuv420p') // 4:2:0 chroma subsampling
      .outputOptions('-profile:v', 'high') // H.264 profile
      .outputOptions('-flags', '+cgop') // Closed GOP
      .outputOptions('-sc_threshold', '0') // Force closed GOP
      .outputOptions('-g', '30') // GOP size
      .outputOptions('-crf', '18') // Constant Rate Factor (lower = better quality/larger files)
      .outputOptions('-maxrate', '12M') // Maximum bitrate (12 Mbps - safety limit)
      .outputOptions('-bufsize', '16M') // Buffer size for VBR (increased for better quality)
      .outputOptions('-movflags', 'faststart')
      .output(outputVideoPath)
      .on('progress', function (progress) {
        progress.percent && onProgress?.(progress.percent);
      })
      .on('error', function (err) {
        logger.error('An error occurred: ' + err.message);
        reject(err);
      })
      .on('end', function () {
        logger.info('Processing finished !');
        resolve(outputVideoPath);
      })
      .run();
  });
}
export const addCaptionsToVideo = async ({
  videoPath,
  transcript,
  outputVideoPath,
  subtitleSettings,
  onProgress
}: {
  videoPath: string;
  outputVideoPath: string;
  transcript: WordBase[];
  subtitleSettings: CaptionSettings;
  width?: number;
  height?: number;
  onProgress: OnProgressCallback;
}) => {
  const videoMetadata = (await getMetadata(videoPath)) as any;

  const subtitleFileName = `${new Date().getTime()}.ass`;

  const subtitleFilePath = `./data/${subtitleFileName}`;
  const assFile = getAssFileString({
    videoMetadata,
    transcript,
    subtitleSettings
  });
  fs.writeFileSync(subtitleFilePath, assFile);
  await processVideo(videoPath, outputVideoPath, subtitleFilePath, subtitleSettings.fontFamily, onProgress);
  fs.rmSync(subtitleFilePath);
};
