import { useState, useCallback } from 'react';
import { useApiService } from './useApiService';
import { getMediaDuration } from '../utils/mediaUtils';

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface PresignedUrlResponse {
  uploadId: string;
  presignedUrl: string;
  s3Key: string;
}

interface ConfirmUploadResponse {
  uploadId: string;
  duration: number;
  name: string;
  url: string;
}

export const useDirectS3Upload = () => {
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: UploadProgress }>({});
  const [isUploading, setIsUploading] = useState<{ [key: string]: boolean }>({});
  const apiService = useApiService();

  const uploadFile = useCallback(
    async (
      file: File,
      libraryId: string,
      onProgress?: (progress: UploadProgress) => void
    ): Promise<ConfirmUploadResponse> => {
      const fileKey = `${file.name}-${file.size}-${file.lastModified}`;

      try {
        setIsUploading(prev => ({ ...prev, [fileKey]: true }));

        // Step 1: Get presigned URL
        const presignedResponse = await apiService.post<
          PresignedUrlResponse,
          {
            filename: string;
            contentType: string;
            size: number;
            duration: number;
          }
        >(`/api/library/${libraryId}/upload/presigned`, {
          filename: file.name,
          contentType: file.type,
          size: file.size,
          duration: await getMediaDuration(file)
        });

        const { uploadId, presignedUrl } = presignedResponse;

        // Step 2: Upload directly to S3
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener('progress', event => {
            if (event.lengthComputable) {
              const progress = {
                loaded: event.loaded,
                total: event.total,
                percentage: Math.round((event.loaded / event.total) * 100)
              };

              setUploadProgress(prev => ({ ...prev, [fileKey]: progress }));
              onProgress?.(progress);
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`S3 upload failed with status ${xhr.status}: ${xhr.statusText}`));
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error('S3 upload failed due to network error'));
          });

          xhr.addEventListener('timeout', () => {
            reject(new Error('S3 upload timed out'));
          });

          xhr.addEventListener('abort', () => {
            reject(new Error('S3 upload was aborted'));
          });

          xhr.open('PUT', presignedUrl);
          xhr.setRequestHeader('Content-Type', file.type);
          // Set timeout to 30 minutes for large files
          xhr.timeout = 30 * 60 * 1000;
          xhr.send(file);
        });

        // Step 3: Confirm upload with our server
        const confirmResponse = await apiService.post<ConfirmUploadResponse>(
          `/api/library/${libraryId}/upload/${uploadId}/confirm`
        );

        return confirmResponse;
      } catch (error) {
        console.error('Upload failed:', error);
        throw error;
      } finally {
        setIsUploading(prev => ({ ...prev, [fileKey]: false }));
        // Clean up progress after a delay
        setTimeout(() => {
          setUploadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[fileKey];
            return newProgress;
          });
        }, 1000);
      }
    },
    [apiService]
  );

  const getFileProgress = useCallback(
    (file: File): UploadProgress | undefined => {
      const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
      return uploadProgress[fileKey];
    },
    [uploadProgress]
  );

  const isFileUploading = useCallback(
    (file: File): boolean => {
      const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
      return isUploading[fileKey] || false;
    },
    [isUploading]
  );

  return {
    uploadFile,
    getFileProgress,
    isFileUploading,
    uploadProgress
  };
};
