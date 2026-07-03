import { FC, PropsWithChildren, useMemo } from 'react';

import { ProfileContext } from './context';
import { IUserProfile } from '../../types';
import { useApiService } from '../../hooks/useApiService';
import { useUserId } from '../../contexts/auth/hooks';
import { GlobalSpinner } from '../../components/common/GlobalSpinner';
import { useQuery } from 'react-query';

export const ProfileProvider: FC<PropsWithChildren> = ({ children }) => {
  const userId = useUserId(); // Add this line to get the user ID
  const apiService = useApiService();

  const { refetch: refetchProfile, data: profile } = useQuery({
    queryKey: ['userProfile', userId],
    enabled: !!userId,
    refetchOnMount: 'always',
    refetchInterval: 1000 * 5,
    retry: 3,
    retryDelay: 500,
    queryFn: async () => {
      return await apiService.get<IUserProfile>(`/api/profile/${userId}`);
    }
  });
  const role = useMemo(() => profile?.role, [profile]);

  if (!profile || !role) {
    return <GlobalSpinner />;
  }
  return <ProfileContext.Provider value={{ profile, role, refetchProfile }}>{children}</ProfileContext.Provider>;
};
