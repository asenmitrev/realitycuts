import { createContext } from 'react';
import { UserStats } from '../../hooks/useUserStats';

export interface UserStatsContextType {
  userStats: UserStats | undefined;
  isLoading: boolean;
  error: unknown;
  refetchStats: () => Promise<unknown>;
}

export const UserStatsContext = createContext<UserStatsContextType | undefined>(undefined);
