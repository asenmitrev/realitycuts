import { useQuery } from 'react-query';
import { useApiService } from './useApiService';
import { useUserId } from '../contexts/firebase/hooks';
import { AutomationLimitsResponse } from '../utils/automation';

export const useAutomationLimits = () => {
  const apiService = useApiService();
  const userId = useUserId();

  return useQuery<AutomationLimitsResponse>({
    queryKey: ['automationLimits', userId],
    enabled: !!userId,
    queryFn: async () => {
      return await apiService.get<AutomationLimitsResponse>('/api/automation-config/user/limits');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000 // 10 minutes
  });
};
