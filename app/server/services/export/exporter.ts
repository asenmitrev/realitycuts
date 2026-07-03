import ffmpeg from 'fluent-ffmpeg';
import { HighlightSegment, IVideoAIData, RecroppedVideoFrame, Segment } from '../../types';
import fs from 'fs';
import path from 'path';
import { safelyDelete } from '../fs';
import { logger } from '../logging';
import { toInternalMediaUrl } from '../../config/storage';

export type IntermediaryVideo = {
  downloadLink: string;
  timeStart: number;
  timeEnd: number;
  videoId: number;
  type: 'pinecone' | 'pexels';
  offsetStart: number;
  duration: number;
  leftPosition?: number;
  topPosition?: number;
  brollType?: 'VIDEO' | 'IMAGE' | 'AI_PHOTO' | 'SVG_INFOGRAPHIC';
};
type FfprobeData = {
  width?: number;
  height?: number;
  duration?: number;
};
type TimelineSegment = {
  startTime: number;
  endTime: number;
  overlays: IntermediaryVideo[];
  needsProcessing: boolean;
};
function getVideoResolution(videoPath: string, callback: (error: unknown, data?: FfprobeData) => void) {
  ffmpeg.ffprobe(videoPath, (err, metadata) => {
    if (err) {
      callback(err);
    } else {
      const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
      if (videoStream) {
        const resolution = {
          width: videoStream.width,
          height: videoStream.height,
          duration: metadata.format.duration
        };
        callback(null, resolution);
      } else {
        callback(new Error('No video stream found'));
      }
    }
  });
}

function getVideoResolutionPromise(videoPath: string): Promise<FfprobeData | undefined> {
  return new Promise((resolve, reject) => {
    getVideoResolution(videoPath, (err, resolution) => {
      if (err) {
        reject(err);
      } else {
        resolve(resolution);
      }
    });
  });
}

/**
 * Segments the timeline by overlay boundaries to process each segment independently
 * This eliminates OOM issues from chained overlay filters
 */
function segmentTimelineByOverlays(overlays: IntermediaryVideo[], sourceDuration: number): TimelineSegment[] {
  if (overlays.length === 0) {
    // No overlays - return single segment with no processing needed
    return [
      {
        startTime: 0,
        endTime: sourceDuration,
        overlays: [],
        needsProcessing: false
      }
    ];
  }

  // Sort overlays by start time
  const sortedOverlays = [...overlays].sort((a, b) => a.timeStart - b.timeStart);

  // Collect all boundary points (start and end times of overlays)
  // Round to 4 decimal places to avoid floating point precision artifacts
  const round4 = (n: number) => Math.round(n * 10000) / 10000;
  const boundaryPoints = new Set<number>([0, round4(sourceDuration)]);
  sortedOverlays.forEach(overlay => {
    boundaryPoints.add(round4(overlay.timeStart));
    boundaryPoints.add(round4(overlay.timeEnd));
  });

  // Sort boundary points
  const sortedBoundaries = Array.from(boundaryPoints).sort((a, b) => a - b);

  // Create segments between each pair of boundaries
  const segments: TimelineSegment[] = [];
  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const startTime = sortedBoundaries[i];
    const endTime = sortedBoundaries[i + 1];

    // Skip segments with negligible duration (floating point precision artifacts)
    // These can occur when overlay boundaries nearly coincide, producing durations
    // like 2.8e-14 which ffmpeg rejects as invalid
    if (endTime - startTime < 0.001) {
      continue;
    }

    // Find all overlays that apply to this segment
    const applicableOverlays = sortedOverlays.filter(
      overlay => overlay.timeStart < endTime && overlay.timeEnd > startTime
    );

    segments.push({
      startTime,
      endTime,
      overlays: applicableOverlays,
      needsProcessing: applicableOverlays.length > 0
    });
  }

  return segments;
}

/**
 * Cuts video with re-encoding for precise, frame-accurate cuts
 * This prevents black frames that can occur with stream copy at keyframe boundaries
 */
async function cutVideoWithReencoding(
  inputPath: string,
  outputPath: string,
  start: number,
  end: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .inputOptions([
        '-accurate_seek', // Enable frame-accurate seeking
        `-ss ${start}`
      ])
      .videoCodec('libx264')
      .outputOptions([
        `-t ${end - start}`,
        '-avoid_negative_ts make_zero', // Ensure timestamps start at 0
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
        '-movflags faststart'
      ])
      .output(outputPath)
      .on('end', () => {
        resolve();
      })
      .on('error', err => {
        reject(`FFmpeg processing failed: ${err.message}`);
      })
      .run();
  });
}

/**
 * Concatenates video segments with re-encoding to ensure proper timing
 * This prevents subtitle misalignment issues that can occur with stream copy
 */
export async function concatenateSegmentsWithReencoding(
  inputPaths: string[],
  outputPath: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (inputPaths.length === 1) {
        fs.renameSync(inputPaths[0], outputPath);
        resolve();
        return;
      }
      const concatFilePath = `${outputPath}.txt`;
      // Generate concat file content
      const fileContent = inputPaths.map(filepath => `file '${path.basename(filepath)}'`).join('\n');
      fs.writeFileSync(concatFilePath, fileContent, 'utf8');

      ffmpeg()
        .input(concatFilePath)
        .inputOptions(['-f concat', '-safe 0'])
        // Re-encode to ensure proper timing and prevent subtitle misalignment
        .videoCodec('libx264')
        .outputOptions([
          '-avoid_negative_ts make_zero', // Ensure timestamps start at 0
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
          '-movflags faststart'
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

/**
 * Processes a single timeline segment with its overlays
 * This approach avoids memory issues by only loading necessary overlay videos
 */
async function processVideoSegment(
  sourceUrl: string,
  segment: TimelineSegment,
  resolution: { width: number; height: number },
  onProgress?: (percent: number) => void
): Promise<string> {
  const filename = `${Date.now()}_segment_${segment.startTime.toFixed(2)}.mp4`;
  const outputPath = `./data/${filename}`;

  return new Promise((resolve, reject) => {
    // If no overlays, still re-encode (not stream copy) for precise timing
    // Stream copy can only cut at keyframes and causes black frames at the end
    if (!segment.needsProcessing || segment.overlays.length === 0) {
      const duration = segment.endTime - segment.startTime;
      ffmpeg()
        .input(sourceUrl)
        .inputOptions([
          '-accurate_seek', // Enable frame-accurate seeking
          `-ss ${segment.startTime}`
        ])
        .videoCodec('libx264')
        .outputOptions([
          `-t ${duration}`, // Duration as output option for precision
          '-avoid_negative_ts make_zero', // Ensure timestamps start at 0
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
          '-movflags faststart'
        ])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', err => reject(err))
        .on('progress', progress => onProgress?.(progress.percent ?? 0))
        .run();
      return;
    }

    const isVertical = resolution.width < resolution.height;
    const ffmpegCommand = ffmpeg();

    // Add source video as first input (trimmed to segment)
    const segmentDuration = segment.endTime - segment.startTime;
    ffmpegCommand.input(sourceUrl).inputOptions([
      '-accurate_seek', // Enable frame-accurate seeking
      `-ss ${segment.startTime}`
    ]);

    // Build filter graph for overlays
    const filters: any[] = [];
    let overlayOutput = '0:v';

    segment.overlays.forEach((overlay, index) => {
      const inputLabel = `${index + 1}`;
      const scaledLabel = `scaled${inputLabel}`;
      const overlayLabel = `overlay${inputLabel}`;

      if (overlay.brollType === 'AI_PHOTO') {
        // AI_PHOTO: Still image with slow zoom-in effect (Ken Burns style)
        // Replicates the frontend's zoom from 1.0x to 1.08x over the segment duration
        ffmpegCommand.input(overlay.downloadLink);

        const totalFrames = Math.ceil(segmentDuration * 30);
        const prescaledLabel = `prescaled${inputLabel}`;
        const croppedLabel = `cropped${inputLabel}`;
        const zoomedLabel = `zoomed${inputLabel}`;
        const fmtLabel = `fmt${inputLabel}`;

        // Scale image to 4x output dimensions to eliminate zoompan jitter.
        // zoompan rounds x/y crop positions to integers each frame, causing visible
        // 1-pixel vibration at native resolution. At 4x, the rounding error is only
        // 0.25 output pixels — completely invisible.
        const zpScale = 4;
        const zpW = resolution.width * zpScale;
        const zpH = resolution.height * zpScale;

        filters.push({
          filter: 'scale',
          options: { w: zpW, h: zpH, force_original_aspect_ratio: 'increase' },
          inputs: `${inputLabel}:v`,
          outputs: prescaledLabel
        });

        // Center crop to 4x output dimensions
        filters.push({
          filter: 'crop',
          options: { w: zpW, h: zpH },
          inputs: prescaledLabel,
          outputs: croppedLabel
        });

        // Apply zoompan at 4x resolution for smooth sub-pixel panning,
        // then output directly at target resolution (1.0x to 1.08x zoom over segment)
        filters.push({
          filter: 'zoompan',
          options: {
            z: `1+on*0.08/${totalFrames}`,
            x: 'iw/2-(iw/zoom/2)',
            y: 'ih/2-(ih/zoom/2)',
            d: totalFrames,
            fps: 30,
            s: `${resolution.width}x${resolution.height}`
          },
          inputs: croppedLabel,
          outputs: zoomedLabel
        });

        // Ensure pixel format compatibility with source video for overlay
        filters.push({
          filter: 'format',
          options: { pix_fmts: 'yuv420p' },
          inputs: zoomedLabel,
          outputs: fmtLabel
        });

        // Overlay the zoomed image onto the source
        filters.push({
          filter: 'overlay',
          options: { x: '0', y: '0' },
          inputs: [overlayOutput, fmtLabel],
          outputs: overlayLabel
        });
      } else {
        // Regular VIDEO/IMAGE overlay (and SVG_INFOGRAPHIC: pre-rendered MP4, same handling)
        // Since segments are created at overlay boundaries, the overlay spans the entire segment
        // We just need to seek to the right position in the overlay video file itself
        const overlayVideoSeekPosition = overlay.offsetStart + Math.max(0, segment.startTime - overlay.timeStart);

        // Add overlay video as input - trimmed to exact segment duration
        // Sometimes videos have a 1 black frame from cutting in the beginning, so we start the overlay by 100ms later
        // Use -itsoffset to shift timestamps backward so the black frame gets skipped by the overlay filter
        const inputOptions: string[] = [
          `-itsoffset -${overlayVideoSeekPosition + 0.1}`, // Shift timestamps backward by 100ms to skip black frame
          `-t ${overlayVideoSeekPosition + segmentDuration + 0.1}` // Extend duration to account for the offset
        ];

        ffmpegCommand.input(overlay.downloadLink).inputOptions(inputOptions);

        // Calculate position offsets
        const xOffset = {
          x: `(W-w) * 0.5 * ${Math.round((overlay.leftPosition ?? 0) * 100) / 100}`,
          y: `(H-h) * 0.5 * ${Math.round((overlay.topPosition ?? 0) * 100) / 100}`
        };

        // Scale overlay to match source dimensions
        filters.push({
          filter: 'scale',
          options: isVertical ? { h: resolution.height, w: '-1' } : { w: resolution.width, h: '-1' },
          inputs: `${inputLabel}:v`,
          outputs: scaledLabel
        });

        // Apply overlay - both inputs are already trimmed to exact segment duration
        filters.push({
          filter: 'overlay',
          options: {
            ...xOffset
          },
          inputs: [overlayOutput, scaledLabel],
          outputs: overlayLabel
        });
      }

      overlayOutput = overlayLabel;
    });

    // Configure output
    ffmpegCommand
      .complexFilter(filters)
      .videoCodec('libx264')
      .outputOptions([
        `-t ${segmentDuration}`, // Precise duration for frame-accurate cuts
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
        `-map [${overlayOutput}]`,
        '-map 0:a',
        '-movflags faststart'
      ])
      .output(outputPath)
      .on('start', cmd => {
        logger?.info(`Processing segment ${segment.startTime}-${segment.endTime}: ${cmd}`);
      })
      .on('end', () => resolve(outputPath))
      .on('error', err => {
        logger?.error(`Error processing segment: ${err.message}`);
        reject(err);
      })
      .on('progress', progress => onProgress?.(progress.percent ?? 0))
      .run();
  });
}

/**
 * Processes video with overlays using segment-based approach
 * This eliminates OOM issues by processing segments independently
 */
async function processVideo(
  sourceUrl: string,
  data: IntermediaryVideo[],
  onProgress: (percent: number) => void
): Promise<[string, string]> {
  try {
    // Get source video metadata
    const resolution = await getVideoResolutionPromise(sourceUrl);
    if (!resolution?.width || !resolution?.height || !resolution?.duration) {
      throw new Error('No appropriate metadata on source video.');
    }

    // Sort overlays by start time
    const sortedOverlays = [...data].sort((a, b) => a.timeStart - b.timeStart);

    // Handle edge case: no overlays
    if (sortedOverlays.length === 0) {
      logger?.info('No overlays to process, returning source video re-encoded for timing consistency');
      const filename = `${Date.now()}.mp4`;
      const finalOutput = `./data/${filename}`;

      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(sourceUrl)
          .videoCodec('libx264')
          .outputOptions([
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
            '-movflags faststart'
          ])
          .output(finalOutput)
          .on('end', () => resolve())
          .on('error', err => reject(err))
          .on('progress', progress => onProgress?.(progress.percent ?? 0))
          .run();
      });

      return [filename, finalOutput];
    }

    // Segment the timeline by overlay boundaries
    const segments = segmentTimelineByOverlays(sortedOverlays, resolution.duration);
    logger?.info(`Processing ${segments.length} timeline segments`);

    // Handle edge case: single segment optimization
    if (segments.length === 1 && segments[0].needsProcessing) {
      logger?.info('Single segment detected, processing directly');
      const outputPath = await processVideoSegment(
        sourceUrl,
        segments[0],
        { width: resolution.width, height: resolution.height },
        onProgress
      );
      const filename = outputPath.split('/').pop()!;
      return [filename, outputPath];
    }

    // Process each segment independently
    const segmentPaths: string[] = [];
    const totalSegments = segments.length;
    let currentProgress = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentPercent = 90 / totalSegments; // Reserve 10% for concatenation

      logger?.info(
        `Processing segment ${i + 1}/${totalSegments} (${segment.startTime.toFixed(2)}-${segment.endTime.toFixed(
          2
        )}s) with ${segment.overlays.length} overlays`
      );

      const segmentPath = await processVideoSegment(
        sourceUrl,
        segment,
        { width: resolution.width, height: resolution.height },
        percent => {
          const adjustedPercent = Math.min(100, currentProgress + (percent * segmentPercent) / 100);
          onProgress?.(adjustedPercent);
        }
      );

      segmentPaths.push(segmentPath);
      currentProgress += segmentPercent;
      onProgress?.(Math.min(100, currentProgress));
    }

    // Concatenate all segments
    logger?.info(`Concatenating ${segmentPaths.length} segments`);
    const filename = `${Date.now()}.mp4`;
    const finalOutput = `./data/${filename}`;

    await concatenateSegmentsWithReencoding(segmentPaths, finalOutput, percent => {
      const adjustedPercent = Math.min(100, 90 + (percent * 10) / 100);
      onProgress?.(adjustedPercent);
    });

    // Clean up intermediate segment files
    logger?.info('Cleaning up intermediate segment files');
    for (const segmentPath of segmentPaths) {
      safelyDelete(segmentPath);
    }

    onProgress?.(100);
    logger?.info('Video processing complete');

    return [filename, finalOutput];
  } catch (error) {
    logger?.error(`Error in processVideo: ${error}`);
    throw error;
  }
}

export type IntermediaryAudio = {
  MP3?: string;
  WAV?: string;
};
export const generateDownloadableTimeline = async (
  data: Omit<IVideoAIData, 'transcriptionJob'>,
  highlightSegments: HighlightSegment[],
  userId: string,
  timeOffset: number = 0,
  timeOffsetEnd: number = Number.MAX_SAFE_INTEGER,
  nextChoice: number = 0
): Promise<{ downloadedVideos: IntermediaryVideo[]; downloadedSource: string }> => {
  if (!data.source) {
    throw new Error('Source is required to generate downloadable timeline.');
  }
  let segments = data.segments.filter(segment => segment.alternatives.length > 0);
  if (highlightSegments.length > 0) {
    segments = calculatePreviewTimeline(segments, highlightSegments);
  }
  const reducedSegments = segments.reduce((acc, segment) => {
    let focusedVideo = segment.alternatives?.find(alt => alt.isFocused) ?? segment.alternatives?.[0];

    if (focusedVideo?.isVisible) {
      const index = segment.alternatives.indexOf(focusedVideo);
      if (nextChoice) {
        if (segment.alternatives.length > nextChoice) {
          const nextIndex = (index + nextChoice) % segment.alternatives.length;
          focusedVideo = segment.alternatives[nextIndex];
        } else {
          return acc;
        }
      }
      let timeStart = Math.floor((segment.timeStart - timeOffset) * 1000) / 1000;
      let timeEnd = Math.floor((segment.timeEnd - timeOffset) * 1000) / 1000;
      const timeOffsetEndAdjusted = timeOffsetEnd - timeOffset;
      if (timeStart >= timeOffsetEndAdjusted) {
        return acc;
      }
      if (timeEnd < 0) {
        return acc;
      } else if (timeEnd > timeOffsetEndAdjusted) {
        timeEnd = timeOffsetEndAdjusted;
      } else if (timeStart < 0) {
        timeStart = 0;
      }
      acc.push({
        timeStart,
        timeEnd,
        videoId: focusedVideo.id,
        duration: focusedVideo.duration ?? timeEnd - timeStart,
        type: focusedVideo.type,
        downloadLink: toInternalMediaUrl(focusedVideo.link),
        offsetStart: focusedVideo.offsetStart ?? 0,
        leftPosition: focusedVideo.leftPosition,
        topPosition: focusedVideo.topPosition,
        brollType: focusedVideo.brollType
      });
    }

    return acc;
  }, [] as IntermediaryVideo[]);

  const downloadedVideos: IntermediaryVideo[] = await Promise.all(
    reducedSegments.map(async segment => {
      return {
        ...segment
      };
    })
  );

  return { downloadedVideos, downloadedSource: data.source.url };
};

const addAudioToVideo = async (
  videoPath: string,
  audioPath: string,
  audioVolume: number,
  sourceDuration: number,
  onProgress: (percent: number) => void
): Promise<[string, string]> => {
  return new Promise((resolve, reject) => {
    const filename = `${Date.now()}.mp4`;
    const finalOutput = `./data/${filename}`;
    let complexFilters: any[] = [];
    let finalAudioStream = '0:a';
    getVideoResolution(videoPath, (err, resolution) => {
      if (!resolution?.duration) {
        return reject('No appropriate metadata on source video.');
      }
      const fadeOutStart = resolution!.duration - 3;
      if (audioPath) {
        // Normalize the audio before processing
        complexFilters.push({
          filter: 'loudnorm',
          options: {
            I: -16, // Integrated loudness target
            TP: -1.5, // True peak
            LRA: 11 // Loudness range
          },
          inputs: '1:a',
          outputs: 'normalized'
        });
        // Ensure background audio is looped to cover the video duration
        complexFilters.push(
          {
            filter: 'aloop',
            options: {
              loop: -1, // infinite loop
              size: 2e9 // maximum possible size
            },
            inputs: 'normalized', // Use normalized audio instead of direct input
            outputs: 'looped'
          },
          // Adjust the volume of the background audio to 10%
          {
            filter: 'volume',
            options: `${audioVolume}`, // Volume at 10% (0.1)
            inputs: 'looped',
            outputs: 'quietLooped'
          }
        );
        // Apply a fade out to the background audio over the last 3 seconds
        complexFilters.push({
          filter: 'afade',
          options: {
            type: 'out', // Fade out (can be 'in' for fade in)
            start_time: Math.max(0, fadeOutStart), // Start the fade out 3 seconds before the end
            duration: Math.min(3, sourceDuration / 2) // Duration of the fade out
          },
          inputs: 'quietLooped', // Apply fade to the quiet looped audio
          outputs: 'faded'
        });

        // Mix the original audio with the background audio
        complexFilters.push({
          filter: 'amix',
          options: {
            inputs: 2, // number of audio sources to mix (original and background)
            duration: 'first', // mix audio until the first input ends
            dropout_transition: `${Math.min(3, sourceDuration / 2)}` // duration in seconds for the dropout transition
          },
          inputs: ['0:a', 'faded'],
          outputs: 'mixed'
        });
        finalAudioStream = '[mixed]';
      }
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .complexFilter(complexFilters)
        .outputOptions([
          '-c:a aac', // Audio codec
          '-ar 48000', // Audio sample rate (48kHz max)
          '-b:a 192k', // Audio bitrate (192kbps - increased for better audio quality)
          '-pix_fmt yuv420p', // 4:2:0 chroma subsampling
          '-profile:v high', // H.264 profile
          '-flags +cgop', // Closed GOP
          '-sc_threshold 0', // Force closed GOP
          '-g 30', // GOP size
          '-crf 18', // Constant Rate Factor (lower = better quality/larger files)
          '-maxrate 12M', // Maximum bitrate (12 Mbps - safety limit)
          '-bufsize 16M', // Buffer size for VBR (increased for better quality)
          `-map 0:v`, // Map the video from last overlay
          `-map ${finalAudioStream}`,
          '-movflags faststart' // Move moov atom to beginning for better streaming
        ])
        .output(finalOutput)
        .on('end', () => {
          resolve([filename, finalOutput]);
        })
        .on('error', err => {
          logger.error(`An error occurred during processing: ${err.message}`);
          reject(err);
        })
        .on('progress', function (progress) {
          onProgress?.(progress.percent ?? 0);
        })
        .run();
    });
  });
};
export async function exportVideo(
  userId: string,
  data: Omit<IVideoAIData, 'transcriptionJob'>,
  highlightSegments: HighlightSegment[],
  inputPath: string,
  onProgress: (percent: number) => void
) {
  const resolution = await getVideoResolutionPromise(inputPath);
  // split original into chunks
  if (!resolution) {
    throw new Error('No appropriate metadata on source video.');
  }
  if (resolution.duration && resolution.duration > 5 * 60) {
    const TIME_OFFSET = 3 * 60;
    // const fileDir = await chunkVideo(inputPath, '/tmp/data', TIME_OFFSET);

    // const chunkedFiles = await readFilesInDirectory(path.join('/tmp/data', fileDir));
    let timeOffset = 0;
    let currentPercent = 0;
    let output: { sourcePartPath: string; filename: string; path: string }[] = [];
    const chunkedFileCount = Math.ceil(resolution.duration / TIME_OFFSET);
    const perChunkPercent = 70 / chunkedFileCount;

    for (let i = 0; i < chunkedFileCount; i++) {
      const outputPath = `./data/${Date.now()}_${i}.mp4`;

      // Find the closest segment end time within 60 seconds of the next 3 minute mark
      const nextViideoCutoffMark = Math.min(resolution.duration ?? 0, timeOffset + TIME_OFFSET);
      const segmentsInRange = data.segments.filter(
        segment => segment.timeEnd > timeOffset && segment.timeEnd <= nextViideoCutoffMark
      );

      // If we have segments in this range, find the closest to the cutoff mark
      // Otherwise, just use the cutoff mark (don't fall back to full duration!)
      const nextSegmentEnd =
        segmentsInRange.length > 0
          ? segmentsInRange.reduce((closest, segment) => {
            const distanceToTimeOffset = Math.abs(segment.timeEnd - nextViideoCutoffMark);
            const distanceToClosest = Math.abs(closest - nextViideoCutoffMark);
            return distanceToTimeOffset < distanceToClosest ? segment.timeEnd : closest;
          }, segmentsInRange[0].timeEnd) // Use first segment as initial value, not full duration!
          : nextViideoCutoffMark; // No segments? Just use the cutoff mark
      logger.debug('Cutting video chunk', i, 'from', timeOffset, 'to', nextSegmentEnd);
      await cutVideoWithReencoding(inputPath, outputPath, timeOffset, nextSegmentEnd);

      logger.debug('Generating downloadable timeline for chunk', i);
      // Update timeOffset to the closest segment end time
      const { downloadedVideos } = await generateDownloadableTimeline(
        data,
        highlightSegments,
        userId,
        timeOffset,
        nextSegmentEnd
      );
      logger.debug('Processing video chunk', i);
      const [partFilename, partPath] = await processVideo(outputPath, downloadedVideos, percent => {
        const progress = Math.min(100, currentPercent + (percent * perChunkPercent) / 100);
        onProgress(progress);
      });
      output.push({
        sourcePartPath: outputPath,
        filename: partFilename,
        path: partPath
      });
      logger.debug('Done processing video chunk', i);
      timeOffset = nextSegmentEnd;
      currentPercent += perChunkPercent;
    }
    let filename = `${Date.now()}.mp4`;
    let filepath = `./data/${filename}`;
    await concatenateSegmentsWithReencoding(
      output.map(part => part.path),
      filepath,
      percent => {
        const progress = Math.min(100, currentPercent + (percent * 20) / 100);
        onProgress(progress);
      }
    );
    currentPercent += 20; // Update after concatenation
    for (const part of output) {
      safelyDelete(part.path);
      safelyDelete(part.sourcePartPath);
    }
    if (data.audioEnabled && data.audio?.[data.audioIndex]?.preview) {
      const [filename1, filepath1] = await addAudioToVideo(
        filepath,
        data.audio?.[data.audioIndex]?.preview,
        data.audioVolume ?? 0.1,
        resolution.duration,
        percent => {
          const progress = Math.min(100, currentPercent + (percent * 10) / 100);
          onProgress(progress);
        }
      );
      onProgress(100); // Ensure we end at exactly 100%
      return [filename1, filepath1];
    } else {
      onProgress(100); // Ensure we end at exactly 100%
      return [filename, filepath];
    }
  } else {
    const { downloadedVideos } = await generateDownloadableTimeline(data, highlightSegments, userId);

    const [filename, filepath] = await processVideo(inputPath, downloadedVideos, percent => {
      const progress = Math.min(100, (percent * 90) / 100);
      onProgress(progress);
    });
    if (data.audioEnabled && data.audio?.[data.audioIndex]?.preview) {
      const [filename1, filepath1] = await addAudioToVideo(
        filepath,
        data.audio?.[data.audioIndex]?.preview,
        data.audioVolume ?? 0.1,
        resolution.duration ?? 3,
        percent => {
          const progress = Math.min(100, 90 + (percent * 10) / 100);
          onProgress(progress);
        }
      );
      onProgress(100); // Ensure we end at exactly 100%
      return [filename1, filepath1];
    } else {
      onProgress(100); // Ensure we end at exactly 100%
      return [filename, filepath];
    }
  }
}

export function exportGrayVideo(
  duration: number,
  dimensions: { width: number; height: number },
  onProgress: (percent: number) => void
): Promise<[string, string]> {
  return new Promise((resolve, reject) => {
    const filename = `${Date.now()}.mp4`;
    const finalOutput = `./data/${filename}`;
    ffmpeg()
      .input(`color=color=0xb3a9ac:size=${dimensions.width}x${dimensions.height}`) // Set to a solid color background
      .inputFormat('lavfi') // Using libavfilter virtual input
      .input('anullsrc')
      .inputFormat('lavfi') // Using libavfilter virtual input
      // The input is still a synthetic input, you can adjust the color as needed.
      .addOptions([
        '-c:v libx264', // Use the H.264 codec for video encoding
        '-t ' + duration, // Duration of the video in seconds
        '-pix_fmt yuv420p', // Pixel format widely supported and does not include alpha (standard for non-transparent videos)
        '-preset veryfast', // Encoder preset (trade-off between encoding speed and output quality/file size)
        '-crf 18', // Constant Rate Factor (lower = better quality/larger files)
        '-maxrate 12M', // Maximum bitrate (12 Mbps - safety limit)
        '-bufsize 16M', // Buffer size for VBR
        '-shortest'
      ])
      .on('end', () => {
        resolve([filename, finalOutput]);
      })
      .on('error', err => {
        logger.error(`An error occurred during processing exportGrayVideo: ${err.message}`);
        reject(err);
      })
      .on('progress', function (progress) {
        onProgress?.(progress.percent ?? 0);
      })
      .save(finalOutput);
  });
}
function splitArrayIntoChunks<T>(array: T[], chunkSize: number): T[][] {
  let result: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    let chunk = array.slice(i, i + chunkSize);
    result.push(chunk);
  }
  return result;
}
export async function recropVerticalVideo(
  recroppedVideoFrames: RecroppedVideoFrame[],
  inputPath: string,
  onProgress: (msg: string) => void
): Promise<[string, string]> {
  return new Promise(async (resolve, reject) => {
    const chunks = splitArrayIntoChunks(recroppedVideoFrames, 250);
    const outputFilePaths: string[] = [];
    let i = 0;
    onProgress?.(`Our editor is cutting up the frames and turning them upside down. Turning ${chunks.length} chunks.`);
    for (const chunk of chunks) {
      i++;
      const [filename, filepath] = await recropVerticalVideoPart(chunk, inputPath, percent =>
        onProgress?.(`Scissors are dull, so it takes time for chink ${i}.`)
      );
      onProgress?.(`Done cropping chunk ${i}.`);
      outputFilePaths.push(filename);
    }

    const filename = `${Date.now()}.mp4`;
    const finalOutput = `./data/${filename}`;
    const listFileName = `./data/list-${Date.now()}.txt`;
    let fileNames = '';

    // ffmpeg -f concat -i mylist.txt -c copy output
    outputFilePaths.forEach(function (fileName, index) {
      fileNames = fileNames + 'file ' + "'" + fileName + "'\n";
    });

    fs.writeFileSync(listFileName, fileNames, { encoding: 'utf8' });
    const merge = ffmpeg();
    merge
      .input(listFileName)
      .inputOptions(['-f concat', '-safe 0'])
      // Re-encode to ensure proper timing and prevent subtitle misalignment
      .videoCodec('libx264')
      .outputOptions([
        '-avoid_negative_ts make_zero', // Ensure timestamps start at 0
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
        '-movflags faststart'
      ])
      .on('start', function (cmd) {
        // logger.info(cmd);
      })
      .save(finalOutput)
      .on('progress', function (progress) {
        onProgress(`Ok, now let's glue some video tape together. Progress: ${progress.percent}%...`);
      })
      .on('error', function (err) {
        outputFilePaths.forEach(path => safelyDelete(path));
        safelyDelete(listFileName);
      })
      .on('end', function () {
        outputFilePaths.forEach(path => safelyDelete(path));
        safelyDelete(listFileName);
        resolve([filename, finalOutput]);
      });
  });
}

export async function recropVerticalVideoPart(
  recroppedVideoFrames: RecroppedVideoFrame[],
  inputPath: string,
  onProgress: (percent: number) => void
): Promise<[string, string]> {
  return new Promise((resolve, reject) => {
    const filename = `${Date.now()}.mp4`;
    const finalOutput = `./data/${filename}`;
    let filterComplex = '';

    recroppedVideoFrames.forEach((frame, index) => {
      const width = frame.x2 - frame.x1;
      const height = frame.y2 - frame.y1;
      filterComplex += `[0:v]trim=start=${frame.timeStart}:end=${frame.timeEnd},setpts=PTS-STARTPTS,crop=${width}:${height}:${frame.x1}:${frame.y1},scale=1080:1920,setsar=1:1[o${index}]; [0:a]atrim=start=${frame.timeStart}:end=${frame.timeEnd},asetpts=PTS-STARTPTS[a${index}]; `;
    });

    const concatFilter = recroppedVideoFrames.map((frame, index) => `[o${index}][a${index}]`).join('');
    filterComplex += `${concatFilter}concat=n=${recroppedVideoFrames.length}:v=1:a=1[outv][outa]`;

    ffmpeg()
      .input(inputPath)
      .complexFilter(filterComplex)
      .outputOptions([
        `-map [outv]`,
        '-map [outa]',
        '-c:a aac', // Audio codec
        '-ar 48000', // Audio sample rate (48kHz max)
        '-b:a 192k', // Audio bitrate (192kbps - increased for better audio quality)
        '-c:v libx264', // Video codec
        '-pix_fmt yuv420p', // 4:2:0 chroma subsampling
        '-profile:v high', // H.264 profile
        '-flags +cgop', // Closed GOP
        '-sc_threshold 0', // Force closed GOP
        '-g 30', // GOP size
        '-crf 18', // Constant Rate Factor (lower = better quality/larger files)
        '-maxrate 12M', // Maximum bitrate (12 Mbps - safety limit)
        '-bufsize 16M', // Buffer size for VBR (increased for better quality)
        '-movflags faststart'
      ])
      .output(finalOutput)
      .on('end', () => {
        resolve([filename, finalOutput]);
      })
      .on('error', err => {
        logger.error(`An error occurred during processing recropVerticalVideoPart: ${err.message}`);
        reject(err);
      })
      .on('progress', function (progress) {
        onProgress?.(progress.percent ?? 0);
      })
      .run();
  });
}

function calculatePreviewTimeline(videos: Segment[], highlights: HighlightSegment[]): Segment[] {
  // Sort videos and highlights by start time
  const sortedVideos = [...videos].sort((a, b) => a.timeStart - b.timeStart);
  const sortedHighlights = [...highlights].sort((a, b) => a.start - b.start);

  const previewedVideos: Segment[] = [];
  let currentPreviewTime = 0;

  for (const highlight of sortedHighlights) {
    // Find videos that overlap with this highlight segment
    const overlappingVideos = sortedVideos.filter(
      video => !(video.timeEnd <= highlight.start || video.timeStart >= highlight.end)
    );

    for (const video of overlappingVideos) {
      // Check if this video was already added
      const existingVideo = previewedVideos.find(v => v._id === video._id);

      if (existingVideo) {
        // Extend the existing video's end time if needed
        const newEndTime = currentPreviewTime + Math.min(video.timeEnd, highlight.end) - highlight.start;
        existingVideo.timeEnd = newEndTime;
      } else {
        // Calculate the video's position in the preview timeline
        const videoStartInPreview = Math.max(video.timeStart, highlight.start);
        const videoEndInPreview = Math.min(video.timeEnd, highlight.end);

        const previewStartTime = currentPreviewTime + (videoStartInPreview - highlight.start);
        const previewEndTime = currentPreviewTime + (videoEndInPreview - highlight.start);

        const previewedVideo: Segment = {
          ...video,
          timeStart: previewStartTime,
          timeEnd: previewEndTime
        };

        previewedVideos.push(previewedVideo);
      }
    }

    currentPreviewTime += highlight.end - highlight.start;
  }

  return previewedVideos;
}
