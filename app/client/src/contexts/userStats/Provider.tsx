import { FC, PropsWithChildren } from 'react';
import { UserStatsContext } from './context';
import { useUserStats } from '../../hooks/useUserStats';

export const UserStatsProvider: FC<PropsWithChildren> = ({ children }) => {
  const { data: userStats, isLoading, error, refetch } = useUserStats();

  return (
    <UserStatsContext.Provider
      value={{
        userStats,
        isLoading,
        error,
        refetchStats: refetch
      }}
    >
      {children}
    </UserStatsContext.Provider>
  );
};
