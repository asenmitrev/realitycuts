import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@chakra-ui/react';
import { useApiService } from './useApiService';
import { useConfirmDialogV2 } from './useConfirmDialog';
import { VideoAlternative } from '../types';

interface MetadataFilters {
  framing: string;
  cameraAngle: string;
  perspective: string;
  depthOfField: string;
  complexity: string;
  arollBroll: string;
  focusPosition: string;
  clusterId: string;
}

export const useLibraryOperations = (id: string | undefined, refetchBroll: () => void) => {
  const apiService = useApiService();
  const navigate = useNavigate();
  const toast = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClustering, setIsClustering] = useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<VideoAlternative[]>([]);
  const [youtubeLinkDeletionStatus, setYoutubeLinkDeletionStatus] = useState<{ [key: string]: boolean }>({});

  const { dialogContent: deleteLibraryDialog, awaitConfirmation: awaitLibraryDeleteConfirmation } = useConfirmDialogV2({
    title: 'Delete Library',
    type: 'delete'
  });

  const { dialogContent: deleteBrollDialog, awaitConfirmation: awaitBrollDeleteConfirmation } = useConfirmDialogV2({
    title: 'Delete Broll',
    type: 'delete'
  });

  const deleteLibrary = useCallback(async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await awaitLibraryDeleteConfirmation();
      await apiService.delete(`/api/library/${id}`);
      navigate(`/libraries`);
    } finally {
      setIsDeleting(false);
    }
  }, [apiService, awaitLibraryDeleteConfirmation, id, navigate]);

  const deleteBroll = useCallback(
    async (itemId: string) => {
      if (!id) return;
      await awaitBrollDeleteConfirmation();
      await apiService.delete(`/api/library/${id}/broll/${itemId}`);
      refetchBroll();
      setSearchResults(prev => prev.filter(item => item._id !== itemId && item.dbId !== itemId));
    },
    [apiService, awaitBrollDeleteConfirmation, id, refetchBroll]
  );

  const handleSearch = useCallback(
    async (metadataFilters: MetadataFilters) => {
      if (!id) return;
      setIsLoadingSearch(true);
      try {
        const response = await apiService.post<
          VideoAlternative[],
          { query: string; source: string; privateLibraryIds: string[]; metadataFilters: MetadataFilters }
        >('/api/search/footage', {
          query: searchTerm,
          source: 'personal',
          privateLibraryIds: [id],
          metadataFilters
        });
        setSearchResults(response);
      } finally {
        setIsLoadingSearch(false);
      }
    },
    [apiService, id, searchTerm]
  );

  const deleteByYoutubeLink = useCallback(
    async (youtubeLink: string) => {
      if (!id) return;
      try {
        setYoutubeLinkDeletionStatus(prev => ({ ...prev, [youtubeLink]: true }));
        await awaitBrollDeleteConfirmation();
        await apiService.delete(`/api/library/${id}/broll/youtube?youtubeLink=${encodeURIComponent(youtubeLink)}`);
        refetchBroll();
        setSearchTerm('');
        setSearchResults([]);
      } finally {
        setYoutubeLinkDeletionStatus(prev => ({ ...prev, [youtubeLink]: false }));
      }
    },
    [apiService, awaitBrollDeleteConfirmation, id, refetchBroll]
  );

  const triggerClustering = useCallback(async () => {
    if (!id) return;
    setIsClustering(true);
    try {
      const response = await apiService.post<{ message: string; alreadyRunning: boolean }>(`/api/library/${id}/cluster`);
      toast({ status: response.alreadyRunning ? 'info' : 'success', title: response.message });
    } finally {
      setIsClustering(false);
    }
  }, [apiService, id, toast]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setSearchResults([]);
  }, []);

  const findSimilarVideos = useCallback(
    async (brollId: string) => {
      if (!id) return;
      setIsLoadingSearch(true);
      try {
        const response = await apiService.get<VideoAlternative[]>(
          `/api/library/${id}/broll/${brollId}/similar?limit=20`
        );
        setSearchResults(response);
        setSearchTerm(''); // Clear search term to show we're showing similarity results
      } catch (error) {
        console.error('Error finding similar videos:', error);
        toast({
          status: 'error',
          title: 'Similarity Search Failed',
          description: 'Failed to find similar videos. Please try again.',
          duration: 5000
        });
      } finally {
        setIsLoadingSearch(false);
      }
    },
    [apiService, id, toast]
  );

  return {
    isDeleting,
    isClustering,
    isLoadingSearch,
    searchTerm,
    setSearchTerm,
    searchResults,
    setSearchResults,
    youtubeLinkDeletionStatus,
    deleteLibrary,
    deleteBroll,
    handleSearch,
    deleteByYoutubeLink,
    clearSearch,
    findSimilarVideos,
    triggerClustering,
    deleteLibraryDialog,
    deleteBrollDialog
  };
};
