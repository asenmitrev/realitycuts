import ffmpeg from 'fluent-ffmpeg';
import { VideoMetadata } from '../../types';
import { logger } from '../logging';
import path from 'path';
import fs from 'fs';
import { safelyDelete } from '../fs';
import { concatenateSegmentsWithReencoding } from '../export/exporter';

// Platform compliance requirements
export const PLATFORM_REQUIREMENTS = {
  maxDuration: 300, // 5 minutes in seconds
  maxFileSize: 100 * 1024 * 1024, // 100 MB in bytes (reduced from 1GB)
  maxVideoBitrate: 8 * 1024 * 1024, // 8 Mbps in bits per second (reduced from 100 Mbps)
  audioBitrate: 128 * 1024, // 128 kbps in bits per second
  audioSampleRate: 48000, // 48 kHz
  minFrameRate: 23,
  maxFrameRate: 60,
  maxWidth: 1920,
  minAspectRatio: 0.01,
  maxAspectRatio: 10.0,
  recommendedAspectRatio: 9 / 16 // 9:16 for vertical videos
};

/**
 * Validates video against platform requirements
 */
export async function validateVideoPlatformCompliance(videoPath: string): Promise<{
  isCompliant: boolean;
  issues: string[];
  metadata: any;
}> {
  const issues: string[] = [];

  try {
    const metadata = await getMetadata(videoPath);
    const videoStream = metadata.streams.find(s => s.codec_type === 'video');
    const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

    if (!videoStream) {
      issues.push('No video stream found');
      return { isCompliant: false, issues, metadata };
    }

    // Check duration
    const duration = metadata.format.duration || 0;
    if (duration > PLATFORM_REQUIREMENTS.maxDuration) {
      issues.push(`Duration ${duration}s exceeds maximum ${PLATFORM_REQUIREMENTS.maxDuration}s`);
    }

    // Check file size
    const fileSize = fs.statSync(videoPath).size;
    if (fileSize > PLATFORM_REQUIREMENTS.maxFileSize) {
      issues.push(`File size ${(fileSize / (1024 * 1024 * 1024)).toFixed(2)}GB exceeds maximum 1GB`);
    }

    // Check frame rate
    const frameRate = videoStream.r_frame_rate ? Number(videoStream.r_frame_rate) : 30;
    if (frameRate < PLATFORM_REQUIREMENTS.minFrameRate || frameRate > PLATFORM_REQUIREMENTS.maxFrameRate) {
      issues.push(
        `Frame rate ${frameRate} outside allowed range ${PLATFORM_REQUIREMENTS.minFrameRate}-${PLATFORM_REQUIREMENTS.maxFrameRate} FPS`
      );
    }

    // Check resolution and aspect ratio
    const width = videoStream.width || 0;
    const height = videoStream.height || 0;
    if (width > PLATFORM_REQUIREMENTS.maxWidth) {
      issues.push(`Width ${width} exceeds maximum ${PLATFORM_REQUIREMENTS.maxWidth}`);
    }

    if (width > 0 && height > 0) {
      const aspectRatio = width / height;
      if (aspectRatio < PLATFORM_REQUIREMENTS.minAspectRatio || aspectRatio > PLATFORM_REQUIREMENTS.maxAspectRatio) {
        issues.push(
          `Aspect ratio ${aspectRatio.toFixed(3)} outside allowed range ${PLATFORM_REQUIREMENTS.minAspectRatio}-${
            PLATFORM_REQUIREMENTS.maxAspectRatio
          }`
        );
      }
    }

    // Check video codec
    if (videoStream.codec_name !== 'h264' && videoStream.codec_name !== 'hevc') {
      issues.push(`Video codec ${videoStream.codec_name} not supported (must be H.264 or HEVC)`);
    }

    // Check audio codec
    if (audioStream && audioStream.codec_name !== 'aac') {
      issues.push(`Audio codec ${audioStream.codec_name} not supported (must be AAC)`);
    }

    // Check pixel format
    if (videoStream.pix_fmt !== 'yuv420p') {
      issues.push(`Pixel format ${videoStream.pix_fmt} not supported (must be yuv420p for 4:2:0 chroma subsampling)`);
    }

    return {
      isCompliant: issues.length === 0,
      issues,
      metadata
    };
  } catch (error) {
    issues.push(`Failed to analyze video: ${error}`);
    return {
      isCompliant: false,
      issues,
      metadata: {}
    };
  }
}

/**
 * Gets standard platform-compliant output options
 */
export function getPlatformCompliantOutputOptions(): string[] {
  return [
    '-c:v libx264', // Video codec: H.264
    '-c:a aac', // Audio codec: AAC
    '-ar 48000', // Audio sample rate: 48kHz max
    '-b:a 192k', // Audio bitrate: 192kbps - increased for better audio quality
    '-pix_fmt yuv420p', // 4:2:0 chroma subsampling
    '-profile:v high', // H.264 high profile
    '-flags +cgop', // Closed GOP
    '-sc_threshold 0', // Force closed GOP
    '-g 30', // GOP size (keyframe every 30 frames)
    '-crf 18', // Constant Rate Factor (lower = better quality/larger files)
    '-maxrate 12M', // Maximum bitrate (12 Mbps - safety limit)
    '-bufsize 16M', // Buffer size for VBR (increased for better quality)
    '-movflags faststart' // Move moov atom to beginning
  ];
}

if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}
if (process.env.FFPROBE_PATH) {
  ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
}

export async function getAudio(input: string, output: string) {
  let hasEnded = false;
  await new Promise((resolve, reject) => {
    ffmpeg(input)
      .toFormat('mp3')
      .saveToFile(output)
      .on('end', function () {
        if (!hasEnded) {
          resolve(null);
          hasEnded = !hasEnded;
        }
      })
      .on('error', function (err) {
        logger.error('error: ', err);
        reject('ERROR: Failed processing audio.');
      })
      .run();
  });
}
export async function getSourceThumbnail(input: string, output: string) {
  let hasEnded = false;
  await new Promise((resolve, reject) => {
    ffmpeg(input)
      .seekInput('00:00:01')
      .frames(1)
      .output(output)
      .on('end', () => {
        if (!hasEnded) {
          resolve(null);
          hasEnded = !hasEnded;
        }
      })
      .on('error', err => {
        logger.error('Error processing source thumbnail', {
          Error: err
        });
        reject('ERROR: Failed processing thumbnail.');
      })
      .run();
  });
}

const mapMetadata = (metadata: ffmpeg.FfprobeData): VideoMetadata => {
  return {
    streams: metadata.streams.map(stream => ({
      index: stream.index,
      codec_name: stream.codec_name,
      tags: stream.tags,
      disposition: stream.disposition,
      codec_long_name: stream.codec_long_name,
      profile: stream.profile,
      codec_type: stream.codec_type,
      codec_tag_string: stream.codec_tag_string,
      codec_tag: stream.codec_tag,
      width: stream.width,
      height: stream.height,
      coded_width: stream.coded_width,
      coded_height: stream.coded_height,
      closed_captions: stream.closed_captions,
      film_grain: stream.film_grain,
      has_b_frames: stream.has_b_frames,
      sample_aspect_ratio: stream.sample_aspect_ratio,
      display_aspect_ratio: stream.display_aspect_ratio,
      pix_fmt: stream.pix_fmt,
      level: stream.level,
      color_range: stream.color_range,
      color_space: stream.color_space,
      color_transfer: stream.color_transfer,
      color_primaries: stream.color_primaries,
      chroma_location: stream.chroma_location,
      field_order: stream.field_order,
      refs: stream.refs,
      is_avc: stream.is_avc,
      nal_length_size: stream.nal_length_size,
      id: stream.id,
      r_frame_rate: stream.r_frame_rate,
      avg_frame_rate: stream.avg_frame_rate,
      time_base: stream.time_base,
      start_pts: stream.start_pts,
      start_time: stream.start_time,
      duration_ts: stream.duration_ts,
      duration: stream.duration,
      bit_rate: stream.bit_rate,
      max_bit_rate: stream.max_bit_rate,
      bits_per_raw_sample: stream.bits_per_raw_sample,
      nb_frames: stream.nb_frames,
      nb_read_frames: stream.nb_read_frames,
      nb_read_packets: stream.nb_read_packets,
      extradata_size: stream.extradata_size
    })),
    format: {
      filename: metadata.format.filename,
      nb_streams: metadata.format.nb_streams,
      nb_programs: metadata.format.nb_programs,
      format_name: metadata.format.format_name,
      format_long_name: metadata.format.format_long_name,
      start_time: metadata.format.start_time,
      duration: metadata.format.duration,
      size: metadata.format.size,
      bit_rate: metadata.format.bit_rate,
      probe_score: metadata.format.probe_score
    }
  };
};
export async function getMetadata(input: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(input, function (err, metadata) {
      if (err) {
        return reject(err);
      }

      resolve(mapMetadata(metadata));
    });
  });
}

export async function resizeVideo(input: string, output: string, resolution: { width: number; height: number }) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .videoFilter(`scale=${resolution.width}:${resolution.height}:flags=lanczos`)
      .outputOptions('-preset slow')
      .outputOptions('-pix_fmt', 'yuv420p') // 4:2:0 chroma subsampling
      .outputOptions('-profile:v', 'high') // H.264 profile
      .outputOptions('-flags', '+cgop') // Closed GOP
      .outputOptions('-sc_threshold', '0') // Force closed GOP
      .outputOptions('-g', '30') // GOP size
      .outputOptions('-movflags faststart')
      .output(output)
      .on('end', () => {
        resolve(output);
      })
      .on('error', err => {
        reject(err);
        logger.error('Error during conversion', {
          Error: err
        });
      })
      .run();
  });
}

export async function trimVideo(
  input: string,
  start: number,
  end: number,
  onProgress?: (progress: number) => void
): Promise<[string, string]> {
  const filename = `${Date.now()}.mp4`;
  const outputVideoPath = `/tmp/data/${filename}`;
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .outputOptions([`-ss ${start}`, `-t ${end - start}`, '-c copy', '-movflags faststart'])
      .on('end', function () {
        resolve([filename, outputVideoPath]);
      })
      .on('error', function (err: { message: string }) {
        reject('An error occurred: ' + err.message);
      })
      .on('progress', function (progress) {
        onProgress?.(progress.percent ?? 0);
      })
      .saveToFile(outputVideoPath);
  });
}

export async function generateVideoFromAudio(
  inputAudio: string,
  size: '1080p' | '1080x1920',
  onProgress?: (progress: number) => void,
  tmpDir = '/tmp/data'
): Promise<[string, string]> {
  const filename = `${Date.now()}.mp4`;
  const outputVideoPath = `${tmpDir}/${filename}`;
  const videoTemplate = (() => {
    switch (size) {
      case '1080p':
        return './templates/fullhd_blank.mp4';
      case '1080x1920':
        return './templates/vfullhd_blank.mp4';
    }
  })();

  // First, get the audio duration
  const tempMetadata = await getMetadata(inputAudio);
  const audioDuration = tempMetadata.format.duration || 0;

  return new Promise((resolve, reject) => {
    // Create a new FFmpeg command
    ffmpeg()
      .input(inputAudio) // Input the audio file
      .input(videoTemplate) // Input the image file
      .format('mp4') // Output format is mp4
      .outputOptions([
        '-c:v libx264', // Video codec
        '-c:a aac', // Audio codec
        '-ar 48000', // Audio sample rate (48kHz max)
        '-b:a 192k', // Audio bitrate (192kbps - increased for better audio quality)
        '-pix_fmt yuv420p', // 4:2:0 chroma subsampling
        '-profile:v high', // H.264 profile
        '-flags +cgop', // Closed GOP
        '-sc_threshold 0', // Force closed GOP
        '-g 30', // GOP size (keyframe every 30 frames for 30fps = 1 second)
        '-crf 18', // Constant Rate Factor (lower = better quality/larger files)
        '-maxrate 12M', // Maximum bitrate (12 Mbps - safety limit)
        '-bufsize 16M', // Buffer size for VBR (increased for better quality)
        '-map 0:a', // Map audio from first input
        '-map 1:v', // Map video from second input
        ...(audioDuration > 0 ? [`-t ${audioDuration}`] : []),
        '-shortest', // Stop when shortest input ends
        '-max_muxing_queue_size 1024', // Increase muxing queue size
        '-movflags faststart' // Move moov atom to beginning for better streaming
      ])
      .on('error', err => {
        reject('An error occurred: ' + err.message);
      })
      .on('end', () => {
        resolve([filename, outputVideoPath]);
      })
      .on('progress', function (progress) {
        onProgress?.(progress.percent ?? 0);
      })
      .save(outputVideoPath); // Output the final video
  });
}

export async function getAudioTrackFromVideo(input: string, output: string): Promise<[string, string]> {
  return new Promise((resolve, reject) => {
    // Create a new FFmpeg command
    // Create a new FFmpeg command
    ffmpeg()
      .input(input) // Input the video file
      .format('mp3') // Output format is mp4
      .on('start', cmd => {
        logger.info('cmd', cmd);
      })
      .on('error', err => {
        reject('An error occurred: ' + err.message);
      })
      .on('end', () => {
        resolve([input, output]);
      })
      .save(output); // Output the f
  });
}

/**
 * Position options for watermark placement
 */
type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

/**
 * Configuration options for watermark
 */
interface WatermarkOptions {
  position?: WatermarkPosition;
  padding?: number;
  maxSize?: number;
  watermarkImagePath?: string; // local path to watermark image
}

export async function addWatermark(
  inputPath: string,
  outputPath: string,
  options: WatermarkOptions = {},
  onProgress?: (progress: number) => void
): Promise<void> {
  const { position = 'top-right', padding = 120, watermarkImagePath, maxSize = 260 } = options;

  // Calculate positioning based on option
  let filterComplex: string;
  let overlayPosition: string;

  switch (position) {
    case 'top-left':
      overlayPosition = `${padding}:${padding}`;
      break;
    case 'top-right':
      overlayPosition = `main_w-overlay_w-${padding}:${padding}`;
      break;
    case 'bottom-left':
      overlayPosition = `${padding}:main_h-overlay_h-${padding}`;
      break;
    case 'bottom-right':
      overlayPosition = `main_w-overlay_w-${padding}:main_h-overlay_h-${padding}`;
      break;
    case 'center':
      overlayPosition = `(main_w-overlay_w)/2:(main_h-overlay_h)/2`;
      break;
    default:
      // Ensure exhaustive type checking
      throw new Error(`Unhandled position: ${position}`);
  }

  filterComplex = `[1:v] scale='min(${maxSize},iw)':'min(${maxSize},ih)':force_original_aspect_ratio=decrease[wm]; [0:v][wm] overlay=${overlayPosition}`;

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      // Add watermark image
      .input(watermarkImagePath ?? './images/watermark.png')
      // Apply watermark using complex filter
      .complexFilter(filterComplex)
      // Keep all audio streams
      .audioCodec('aac')
      .outputOptions('-ar', '48000') // Audio sample rate (48kHz max)
      .outputOptions('-b:a', '192k') // Audio bitrate (192kbps - increased for better audio quality)
      // Use good quality video encoding
      .videoCodec('libx264')
      .outputOptions('-pix_fmt', 'yuv420p') // 4:2:0 chroma subsampling
      .outputOptions('-profile:v', 'high') // H.264 profile
      .outputOptions('-flags', '+cgop') // Closed GOP
      .outputOptions('-sc_threshold', '0') // Force closed GOP
      .outputOptions('-g', '30') // GOP size
      .outputOptions('-preset', 'slow')
      .outputOptions('-crf', '18') // Constant Rate Factor (lower = better quality/larger files)
      .outputOptions('-maxrate', '12M') // Maximum bitrate (12 Mbps - safety limit)
      .outputOptions('-bufsize', '16M') // Buffer size for VBR (increased for better quality)
      .outputOptions('-movflags', 'faststart')
      // Output file
      .save(outputPath)
      .on('progress', function (progress) {
        onProgress?.(progress.percent ?? 0);
      })
      // Handle events
      .on('end', () => {
        resolve();
      })
      .on('error', (err: Error) => {
        reject(`FFmpeg processing failed: ${err.message}`);
      });
  });
}

export const cutVideo = (inputPath: string, outputPath: string, start: number, end: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([`-ss ${start}`, `-t ${end - start}`, '-c copy', '-movflags faststart'])
      .output(outputPath)
      .on('end', () => {
        resolve();
      })
      .on('error', err => {
        reject(`FFmpeg processing failed: ${err.message}`);
      })
      .run();
  });
};

export const chunkVideo = (inputPath: string, outputDir: string, duration: number = 20): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Create output subdirectory for this video
    const filename = path.basename(inputPath, path.extname(inputPath));
    const videoOutputDir = path.join(outputDir, filename);

    // Ensure video output directory exists
    if (!fs.existsSync(videoOutputDir)) {
      fs.mkdirSync(videoOutputDir, { recursive: true });
    }

    // Output filename pattern
    const outputPattern = path.join(videoOutputDir, `${filename}_%03d${path.extname(inputPath)}`);

    ffmpeg(inputPath)
      .outputOptions([
        '-f segment', // Use segment muxer
        `-segment_time ${duration}`, // 20-second chunks
        '-movflags faststart' // Move moov atom to beginning for better streaming
      ])
      .output(outputPattern)
      .on('end', () => {
        logger.info(`Chunked: ${inputPath}`);
        resolve(filename);
      })
      .on('error', err => {
        logger.error(`Error chunking ${inputPath}:`, err);
        reject(err);
      })
      .run();
  });
};
export const isLongVideo = async (filePath: string): Promise<boolean> => {
  try {
    const metadata = await getMetadata(filePath);
    const durationInSeconds = metadata.format.duration;
    logger.info('durationInSeconds', durationInSeconds);
    if ((durationInSeconds ?? 0) > 60) {
      logger.info('Found long video', durationInSeconds, filePath);
    }
    return (durationInSeconds ?? 0) > 60;
  } catch (error) {
    logger.error(`Error probing ${filePath}:`, error);
    return false;
  }
};

export const concatenateAudioFiles = (
  inputPaths: string[],
  outputPath: string,
  onProgress?: (progress: number) => void
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      if (inputPaths.length === 1) {
        fs.renameSync(inputPaths[0], outputPath);
        resolve();
        return;
      }
      const concatFilePath = `${outputPath}.txt`;
      // Generate concat file content
      // Use basenames since concat file is in same directory as input files
      const fileContent = inputPaths.map(filepath => `file '${path.basename(filepath)}'`).join('\n');
      fs.writeFileSync(concatFilePath, fileContent, 'utf8');

      // Change working directory to where the files are
      const filesDir = path.dirname(inputPaths[0]);

      ffmpeg()
        .input(concatFilePath)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions(['-c copy', '-movflags', 'faststart'])
        .output(outputPath)
        .on('start', cmd => {
          logger.info('Concatenating files from directory:', filesDir);
          logger.info('FFmpeg command:', cmd);
        })
        .on('progress', function (progress) {
          onProgress?.(progress.percent ?? 0);
        })
        .on('end', () => {
          safelyDelete(concatFilePath);
          resolve();
        })
        .on('error', err => {
          logger.error('Error concatenating files', err);
          safelyDelete(concatFilePath);
          reject(err);
        })
        .run();
    } catch (error) {
      logger.error('Error concatenating audio files', error);
      reject(error);
    }
  });
};

export function checkAndConvertAV1(inputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // First probe the file to get codec information
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      // Get video stream info
      const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');

      if (!videoStream) {
        reject(new Error('No video stream found'));
        return;
      }

      // Check if codec is AV1
      if (videoStream.codec_name === 'av1') {
        logger.info('AV1 codec detected, converting to H.264...');

        // Create output path by appending '_converted' before extension
        const parsedPath = path.parse(inputPath);
        const outputPath = path.join(parsedPath.dir, `${parsedPath.name}_converted${parsedPath.ext}`);

        // Convert to H.264
        ffmpeg(inputPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions('-ar', '48000') // Audio sample rate (48kHz max)
          .outputOptions('-b:a', '192k') // Audio bitrate (192kbps - increased for better audio quality)
          .outputOptions('-pix_fmt', 'yuv420p') // 4:2:0 chroma subsampling
          .outputOptions('-profile:v', 'high') // H.264 profile
          .outputOptions('-flags', '+cgop') // Closed GOP
          .outputOptions('-sc_threshold', '0') // Force closed GOP
          .outputOptions('-g', '30') // GOP size
          .outputOptions('-crf', '18') // Constant Rate Factor (lower = better quality/larger files)
          .outputOptions('-maxrate', '12M') // Maximum bitrate (12 Mbps - safety limit)
          .outputOptions('-bufsize', '16M') // Buffer size for VBR (increased for better quality)
          .outputOptions('-preset', 'veryfast')
          .outputOptions('-movflags', 'faststart')
          .output(outputPath)
          .on('progress', function (progress) {
            logger.info('AV1 conversion progress', progress.percent);
          })
          .on('end', () => {
            logger.info('Conversion finished');
            resolve(outputPath);
          })
          .on('error', err => {
            reject(new Error(`Conversion error: ${err.message}`));
          })
          .run();
      } else {
        // If not AV1, return original path
        logger.info('Video is not AV1, no conversion needed');
        resolve(inputPath);
      }
    });
  });
}

/**
 * Appends an endscreen video to the main video
 * Uses concat filter with proper stream synchronization to prevent audio/video desync
 * @param inputPath Path to the main video
 * @param outputPath Path for the output video with endscreen appended
 * @param endscreenPath Path to the endscreen video (endscreen-1.mp4 or endscreen-2.mp4)
 * @param onProgress Optional progress callback
 */
export async function appendEndscreen(
  inputPath: string,
  outputPath: string,
  endscreenPath: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const concatFilePath = `concat-endscreen.txt`;
      // Generate concat file coantent
      const fileContent = [inputPath, endscreenPath].map(filepath => `file '${filepath}'`).join('\n');
      fs.writeFileSync(concatFilePath, fileContent, 'utf8');

      ffmpeg()
        .input(concatFilePath)
        .inputOptions(['-f concat', '-safe 0'])
        // Re-encode to ensure proper timing and prevent subtitle misalignment
        .videoCodec('libx264')
        .outputOptions([
          '-avoid_negative_ts make_zero', // Ensure timestamps start at 0
          '-vsync cfr', // Force constant frame rate to prevent timing issues
          '-c:a aac',
          '-ar 48000',
          '-b:a 192k',
          '-pix_fmt yuv420p',
          '-profile:v high',
          '-flags +cgop',
          '-sc_threshold 0',
          '-g 30',
          '-crf 18',
          '-maxrate 12M',
          '-bufsize 16M',
          '-movflags faststart',
          '-fflags +genpts', // Regenerate timestamps
          '-max_interleave_delta 0' // Reduce interleaving issues
        ])
        .output(outputPath)
        .on('start', cmd => {
          logger?.info(`Concatenating segments: ${cmd}`);
        })
        .on('progress', function (progress) {
          onProgress?.(progress.percent ?? 0);
        })
        .on('end', () => {
          safelyDelete(concatFilePath);
          resolve();
        })
        .on('error', err => {
          logger?.error(`Error concatenating segments: ${err.message}`);
          safelyDelete(concatFilePath);
          reject(err);
        })
        .run();
    } catch (error) {
      logger?.error(`Error in concatenateSegmentsWithReencoding: ${error}`);
      reject(error);
    }
  });
}
