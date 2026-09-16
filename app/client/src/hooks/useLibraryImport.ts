import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@chakra-ui/react';
import { useApiService } from './useApiService';
import {
  LIBRARY_EXPORT_FORMAT,
  LIBRARY_EXPORT_PART_FILENAME_REGEX,
  LIBRARY_EXPORT_LEGACY_PART_FILENAME_REGEX,
  LibraryExportManifest,
  LibraryImportInitResponse,
  LibraryTransferJobData
} from 'shared/types/library-export';

const TRANSFER_JOB_POLL_INTERVAL_MS = 3000;

/**
 * Match a locally-selected backup file's name against the current (0-based,
 * part-{n}.zip) and legacy (1-based, <name>-export-part{n}.zip) part filename
 * conventions, returning the part's 0-based index, or null if the name matches neither.
 */
function matchPartIndex(fileName: string): number | null {
  const current = LIBRARY_EXPORT_PART_FILENAME_REGEX.exec(fileName);
  if (current) return parseInt(current[1], 10);

  const legacy = LIBRARY_EXPORT_LEGACY_PART_FILENAME_REGEX.exec(fileName);
  if (legacy) return parseInt(legacy[1], 10) - 1;

  return null;
}

function uploadPartWithProgress(url: string, file: File, onProgress: (percentage: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', event => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Upload failed due to a network error')));
    xhr.addEventListener('abort', () => reject(new Error('Upload was aborted')));

    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'application/zip');
    // Large parts on a slow connection can take a while.
    xhr.timeout = 6 * 60 * 60 * 1000;
    xhr.send(file);
  });
}

export const useLibraryImport = () => {
  const apiService = useApiService();
  const navigate = useNavigate();
  const toast = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pollTransferJob = useCallback(
    (jobId: string): Promise<LibraryTransferJobData> => {
      return new Promise((resolve, reject) => {
        const poll = async () => {
          try {
            const job = await apiService.get<LibraryTransferJobData>(`/api/library/transfer-jobs/${jobId}`);
            if (job.status === 'COMPLETED') {
              resolve(job);
            } else if (job.status === 'FAILED') {
              reject(new Error(job.error || 'Library import failed.'));
            } else {
              setTimeout(poll, TRANSFER_JOB_POLL_INTERVAL_MS);
            }
          } catch (error) {
            reject(error);
          }
        };
        poll();
      });
    },
    [apiService]
  );

  const importFiles = useCallback(
    async (files: File[]) => {
      try {
        setIsImporting(true);
        setImportProgress('Reading manifest…');

        const manifestFile = files.find(file => file.name.toLowerCase().endsWith('.json'));
        if (!manifestFile) {
          throw new Error('Select the backup’s manifest.json together with its part-*.zip files.');
        }

        let manifest: LibraryExportManifest;
        try {
          manifest = JSON.parse(await manifestFile.text());
        } catch {
          throw new Error('This is not a valid library export manifest.');
        }
        if (manifest.format !== LIBRARY_EXPORT_FORMAT) {
          throw new Error('This is not a valid library export manifest.');
        }

        const partFileByIndex = new Map<number, File>();
        for (const file of files) {
          if (file === manifestFile) continue;
          const index = matchPartIndex(file.name);
          if (index !== null) partFileByIndex.set(index, file);
          // Anything that matches neither the manifest nor a part filename convention is
          // a stray selection — it's simply left out and never uploaded.
        }

        const totalParts = manifest.stats?.totalParts ?? 0;
        const missingParts: number[] = [];
        for (let index = 0; index < totalParts; index++) {
          if (!partFileByIndex.has(index)) missingParts.push(index + 1);
        }
        if (missingParts.length > 0) {
          throw new Error(`Missing backup part${missingParts.length > 1 ? 's' : ''}: ${missingParts.join(', ')}`);
        }

        // The manifest goes first, on its own — the server hands back one presigned URL
        // per part. The part ZIPs themselves are then PUT straight to storage, one at a
        // time, and never pass through our own server (no local disk, no buffering a
        // multi-gigabyte request), which is what used to overload local disk on import.
        const { jobId, partUploadUrls } = await apiService.post<
          LibraryImportInitResponse,
          { manifest: LibraryExportManifest }
        >('/api/library/import/init', { manifest });

        for (let index = 0; index < totalParts; index++) {
          const file = partFileByIndex.get(index)!;
          setImportProgress(`Uploading part ${index + 1} of ${totalParts}…`);
          await uploadPartWithProgress(partUploadUrls[index], file, percentage =>
            setImportProgress(`Uploading part ${index + 1} of ${totalParts} (${percentage}%)`)
          );
        }

        setImportProgress('Finalizing…');
        const job = await apiService.post<LibraryTransferJobData>(`/api/library/import/${jobId}/finalize`);

        setImportProgress('Processing…');
        const finishedJob = await pollTransferJob(job._id);
        toast({
          status: 'success',
          title: 'Import Complete',
          description: 'Your library was imported successfully.',
          duration: 5000
        });
        if (finishedJob.newLibraryId) {
          navigate(`/libraries/${finishedJob.newLibraryId}`);
        }
      } catch (error) {
        console.error('Error importing library:', error);
        toast({
          status: 'error',
          title: 'Import Failed',
          description: error instanceof Error ? error.message : 'Failed to import library. Please try again.',
          duration: 5000
        });
      } finally {
        setIsImporting(false);
        setImportProgress(null);
      }
    },
    [apiService, navigate, pollTransferJob, toast]
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      // Reset so selecting the same files again still fires onChange
      event.target.value = '';
      if (files.length === 0) return;

      const hasManifest = files.some(file => file.name.toLowerCase().endsWith('.json'));
      const hasPart = files.some(file => file.name.toLowerCase().endsWith('.zip'));
      if (!hasManifest || !hasPart) {
        toast({
          status: 'error',
          title: 'Invalid Selection',
          description: 'Select the backup’s manifest.json together with its part-*.zip files.',
          duration: 5000
        });
        return;
      }
      importFiles(files);
    },
    [importFiles, toast]
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    isImporting,
    importProgress,
    fileInputRef,
    openFilePicker,
    handleFileChange
  };
};
