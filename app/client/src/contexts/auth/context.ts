import { createContext } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  role?: string;
  firstName?: string;
  lastName?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<{ user: AuthUser; token: string }>;
  register: (email: string, password: string, firstName?: string, lastName?: string) => Promise<{ user: AuthUser; token: string }>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  initializing: true,
  login: async () => { throw new Error('not initialized'); },
  register: async () => { throw new Error('not initialized'); },
  logout: () => {}
});
