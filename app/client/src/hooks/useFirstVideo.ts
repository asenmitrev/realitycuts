import { useQuery } from 'react-query';
import { useApiService } from './useApiService';
import { useUserId } from '../contexts/firebase/hooks';

export interface VideoData {
  _id: string;
  title?: string;
  videoAIData: { _id: string }[];
  // Add other video properties as needed
}

export const useFirstVideo = (enabled: boolean = false) => {
  const apiService = useApiService();
  const userId = useUserId();

  return useQuery<VideoData>({
    queryKey: ['firstVideo', userId],
    enabled: !!userId && enabled,
    queryFn: async () => {
      const response = await apiService.get<{ videos: VideoData[]; total: number }>('/api/videos?limit=1');
      if (response.videos.length === 0) {
        throw new Error('No videos found');
      }
      return response.videos[0];
    },
    staleTime: 60000, // Consider data fresh for 1 minute
    cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false
  });
};
