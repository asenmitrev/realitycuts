import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { logger } from '../../../services/logging';

const getImageDimensions = (imagePath: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(imagePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
      if (!videoStream?.width || !videoStream?.height) {
        reject(new Error('Could not determine image dimensions'));
        return;
      }
      // Ensure dimensions are even
      const width = videoStream.width % 2 === 0 ? videoStream.width : videoStream.width + 1;
      const height = videoStream.height % 2 === 0 ? videoStream.height : videoStream.height + 1;
      resolve({
        width,
        height
      });
    });
  });
};

export const zoomIn = async (
  imagePath: string,
  outputPath: string,
  duration: number = 3.5,
  fps: number = 30, // Reduced from 60
  zoomRate: number = 0.002 // Increased for same effect with fewer frames
): Promise<string> => {
  const dimensions = await getImageDimensions(imagePath);

  // Calculate optimal scale based on output dimensions
  const maxDimension = Math.max(dimensions.width, dimensions.height);
  const scale = maxDimension < 2000 ? 2000 : Math.min(maxDimension * 1.5, 4000);

  return new Promise((resolve, reject) => {
    const process = ffmpeg();

    process
      .input(imagePath)
      .inputOptions(['-loop 1', `-framerate ${fps}`]) // Better for static images
      .videoFilters([
        `scale=${scale}:-1`, // Much smaller scale
        `zoompan=z='zoom+${zoomRate}':x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):d=${duration * fps}:s=${dimensions.width}x${
          dimensions.height
        }:fps=${fps}`
      ])
      .duration(duration)
      .outputOptions([
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-preset ultrafast', // Fastest preset
        '-crf 28' // Slightly lower quality for speed
      ])
      .on('start', cmd => {
        logger.debug('FFmpeg command', { cmd });
      })
      .on('stderr', output => {
        if (output.includes('Invalid data found when processing input')) {
          process.kill('SIGKILL');
          reject(new Error('Invalid data found when processing input'));
        }
      })
      .on('end', () => {
        logger.info('Zoom effect complete');
        resolve(outputPath);
      })
      .on('error', err => {
        logger.error('Error applying zoom effect:', err);
        reject(err);
      })
      .output(outputPath)
      .run();
  });
};

export const zoomOut = async (
  imagePath: string,
  outputPath: string,
  duration: number = 5,
  fps: number = 60,
  initialZoom: number = 1.5,
  zoomRate: number = 0.0015
): Promise<string> => {
  const dimensions = await getImageDimensions(imagePath);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(imagePath)
      .inputOptions(['-loop 1', `-framerate ${fps}`])
      .videoFilters([
        'scale=8000:-1',
        `zoompan=z='if(lte(zoom,1.0),${initialZoom},max(1.001,zoom-${zoomRate}))':x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):d=${
          duration * fps
        }:s=${dimensions.width}x${dimensions.height}:fps=${fps}`
      ])
      .duration(duration)
      .outputOptions(['-c:v libx264', '-pix_fmt yuv420p', '-preset veryfast'])
      .on('end', () => {
        logger.info('Zoom out effect complete');
        resolve(outputPath);
      })
      .on('error', err => {
        logger.error('Error applying zoom out effect:', err);
        reject(err);
      })
      .output(outputPath)
      .run();
  });
};

export const generateThumbnails = async (
  videoPath: string,
  outputDir: string,
  timestamps: string[] = ['33%', '66%'],
  size: string = '640x-1'
): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const ffmpegPath = path.join(__dirname, './bin/ffmpeg');
    ffmpeg.setFfmpegPath(ffmpegPath);

    ffmpeg(videoPath)
      .screenshots({
        timestamps,
        filename: 'thumbnail%d.jpg',
        folder: outputDir,
        size
      })
      .on('end', () => {
        logger.info('Thumbnails generated successfully');
        // Return array of paths to generated thumbnails
        const thumbnailPaths = timestamps.map((_, index) => path.join(outputDir, `thumbnail${index + 1}.jpg`));
        resolve(thumbnailPaths);
      })
      .on('error', err => {
        logger.error('Error generating thumbnails:', err);
        reject(err);
      });
  });
};

export const reencodeVideo = async (inputPath: string, outputPath: string, crf: number = 23): Promise<string> => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions(['-c:v libx264', '-preset veryfast', `-crf ${crf}`, '-c:a aac', '-b:a 128k'])
      .on('start', cmd => {
        logger.info('Starting video reencoding:', cmd);
      })
      .on('end', () => {
        logger.info('Video reencoding complete');
        resolve(outputPath);
      })
      .on('error', err => {
        logger.error('Error reencoding video:', err);
        reject(err);
      })
      .output(outputPath)
      .run();
  });
};
