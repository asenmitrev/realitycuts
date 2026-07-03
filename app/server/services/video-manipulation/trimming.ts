import ffmpeg from 'fluent-ffmpeg';
import { HighlightSegment } from '../../types';

export const trimAndRemoveWords = (
  segments: HighlightSegment[],
  inputVideoPath: string,
  onProgress?: (progress: number) => void
): Promise<[string, string]> => {
  return new Promise((resolve, reject) => {
    // Output video path
    const filename = `${Date.now()}.mp4`;
    const outputVideoPath = `./data/${filename}`;

    // Calculate durations of each segment to keep
    const segmentsWithDuration = segments.map(segment => ({
      start: segment.start,
      end: segment.end,
      duration: segment.end - segment.start
    }));

    const filters: any = [];

    segmentsWithDuration.forEach((segment, index) => {
      filters.push(
        {
          filter: 'trim',
          options: { start: segment.start, end: segment.end },
          inputs: `0:v`,
          outputs: `[v${index}-trim]`
        },
        {
          filter: 'setpts',
          options: 'PTS-STARTPTS',
          inputs: `[v${index}-trim]`,
          outputs: `[v${index}]`
        },
        {
          filter: 'atrim',
          options: { start: segment.start, end: segment.end },
          inputs: `0:a`,
          outputs: `[a${index}-trim]`
        },
        {
          filter: 'afade',
          options: {
            type: 'in', // Fade out (can be 'in' for fade in)
            start_time: segment.start, // Start the fade out 3 seconds before the end
            duration: 0.05 // Duration of the fade out
          },
          inputs: `[a${index}-trim]`,
          outputs: `[a${index}-fade-in]`
        },
        {
          filter: 'afade',
          options: {
            type: 'out', // Fade out (can be 'in' for fade in)
            start_time: segment.end - 0.05, // Start the fade out 3 seconds before the end
            duration: 0.05 // Duration of the fade out
          },
          inputs: `[a${index}-fade-in]`,
          outputs: `[a${index}-fade]`
        },
        {
          filter: 'asetpts',
          options: 'PTS-STARTPTS',
          inputs: `[a${index}-fade]`,
          outputs: `[a${index}]`
        }
      );
    });

    filters.push({
      filter: 'concat',
      options: {
        v: 1,
        a: 1,
        n: segmentsWithDuration.length
      },
      inputs: segmentsWithDuration.map((_, index) => `[v${index}][a${index}]`),
      outputs: ['outv', 'outa']
    });

    // Execute FFmpeg command
    ffmpeg(inputVideoPath)
      .complexFilter(filters)
      .outputOptions(
        '-map',
        '[outv]',
        '-map',
        '[outa]',
        '-c:a',
        'aac', // Audio codec
        '-ar',
        '48000', // Audio sample rate (48kHz max)
        '-b:a',
        '192k', // Audio bitrate (192kbps - increased for better audio quality)
        '-c:v',
        'libx264', // Video codec
        '-pix_fmt',
        'yuv420p', // 4:2:0 chroma subsampling
        '-profile:v',
        'high', // H.264 profile
        '-flags',
        '+cgop', // Closed GOP
        '-sc_threshold',
        '0', // Force closed GOP
        '-g',
        '30', // GOP size
        '-crf',
        '18', // Constant Rate Factor (lower = better quality/larger files)
        '-maxrate',
        '12M', // Maximum bitrate (12 Mbps - safety limit)
        '-bufsize',
        '16M', // Buffer size for VBR (increased for better quality)
        '-movflags',
        'faststart'
      ) // Move moov atom to beginning
      .output(outputVideoPath)
      .on('end', function () {
        resolve([filename, outputVideoPath]);
      })
      .on('error', function (err: { message: string }) {
        reject('An error occurred: ' + err.message);
      })
      .on('progress', function (progress) {
        onProgress?.(progress.percent ?? 0);
      })
      .run();
  });
};
