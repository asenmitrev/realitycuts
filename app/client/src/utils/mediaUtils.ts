/**
 * Utility functions for extracting metadata from media files
 */

export interface MediaMetadata {
  duration: number;
  width?: number;
  height?: number;
}

/**
 * Extracts duration from audio files using the Audio API
 * @param file Audio file
 * @returns Promise<number> Duration in seconds
 */
export const getAudioDuration = (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    let blobUrl: string | null = null;

    const cleanup = () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        blobUrl = null;
      }
    };

    audio.onloadedmetadata = () => {
      const duration = audio.duration;

      function getDuration() {
        audio.currentTime = 0;
        audio.removeEventListener('timeupdate', getDuration);
        resolve(audio.duration ?? 60);
      }
      if (audio.duration === Infinity || isNaN(Number(audio.duration))) {
        audio.currentTime = 1e101;
        audio.addEventListener('timeupdate', getDuration);
      } else {
        cleanup();
        resolve(duration);
      }
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error('Failed to load audio file'));
    };

    // Create blob URL and track it for cleanup
    blobUrl = URL.createObjectURL(file);
    audio.src = blobUrl;
  });
};

/**
 * Extracts duration and dimensions from video files using the Video API
 * @param file Video file
 * @returns Promise<MediaMetadata> Duration in seconds and video dimensions
 */
export const getVideoMetadata = (file: File): Promise<MediaMetadata> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    let blobUrl: string | null = null;

    const cleanup = () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        blobUrl = null;
      }
    };

    video.onloadedmetadata = () => {
      const metadata: MediaMetadata = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight
      };
      cleanup();
      resolve(metadata);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to load video file'));
    };

    // Set preload to metadata only to avoid downloading the entire file
    video.preload = 'metadata';

    // Create blob URL and track it for cleanup
    blobUrl = URL.createObjectURL(file);
    video.src = blobUrl;
  });
};

/**
 * Extracts duration from any media file (audio or video)
 * @param file Media file
 * @returns Promise<number> Duration in seconds
 */
export const getMediaDuration = async (file: File): Promise<number> => {
  const mimeType = file.type.toLowerCase();

  if (mimeType.startsWith('video/')) {
    const metadata = await getVideoMetadata(file);
    return metadata.duration;
  } else if (mimeType.startsWith('audio/')) {
    return await getAudioDuration(file);
  } else if (mimeType.startsWith('image/')) {
    // Images get a default duration (will be used for slideshows)
    return 5; // 5 seconds default
  } else {
    throw new Error(`Unsupported media type: ${mimeType}`);
  }
};

/**
 * Validates media duration against a maximum limit
 * @param file Media file
 * @param maxDurationMinutes Maximum duration in minutes
 * @returns Promise<{isValid: boolean, message?: string, duration?: number}>
 */
export const validateMediaDuration = async (
  file: File,
  maxDurationMinutes: number
): Promise<{ isValid: boolean; message?: string; duration?: number }> => {
  try {
    const duration = await getMediaDuration(file);
    const maxDurationSeconds = maxDurationMinutes * 60;

    if (duration > maxDurationSeconds) {
      const fileType = file.type.startsWith('video/') ? 'Video' : 'Audio';
      return {
        isValid: false,
        duration,
        message: `${fileType} file is ${Math.ceil(
          duration / 60
        )} minutes long. Please upload a file that is ${maxDurationMinutes} minutes or less.`
      };
    }

    return { isValid: true, duration };
  } catch (error) {
    return {
      isValid: false,
      message: 'Could not determine media duration. Please ensure the file is a valid media format.'
    };
  }
};
