import { useQuery } from 'react-query';
import { useApiService } from './useApiService';
import { useUserId } from '../contexts/firebase/hooks';

export interface UserStats {
  libraries: number;
  videos: number;
  exports: number;
  automations: number;
}

export const useUserStats = () => {
  const apiService = useApiService();
  const userId = useUserId();

  return useQuery<UserStats>({
    queryKey: ['userStats', userId],
    enabled: !!userId,
    queryFn: async () => {
      return await apiService.get<UserStats>('/api/user-stats');
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false
  });
};
