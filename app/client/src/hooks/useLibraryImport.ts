import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@chakra-ui/react';
import { useApiService } from './useApiService';
import { LibraryTransferJobData } from 'shared/types/library-export';

const TRANSFER_JOB_POLL_INTERVAL_MS = 3000;

export const useLibraryImport = () => {
  const apiService = useApiService();
  const navigate = useNavigate();
  const toast = useToast();
  const [isImporting, setIsImporting] = useState(false);
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
        const formData = new FormData();
        files.forEach(file => formData.append('files', file));
        const job = await apiService.post<LibraryTransferJobData, FormData>('/api/library/import', formData);
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
    fileInputRef,
    openFilePicker,
    handleFileChange
  };
};
