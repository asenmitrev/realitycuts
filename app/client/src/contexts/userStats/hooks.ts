import { useContext } from 'react';
import { UserStatsContext, UserStatsContextType } from './context';

export const useUserStatsContext = (): UserStatsContextType => {
  const context = useContext(UserStatsContext);
  if (!context) {
    throw new Error('useUserStatsContext must be used within a UserStatsProvider');
  }
  return context;
};

export const useRefetchStats = () => {
  const { refetchStats } = useUserStatsContext();
  return refetchStats;
};
