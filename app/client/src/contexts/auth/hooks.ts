import { useContext } from 'react';
import { AuthContext } from './context';

export const useAuthUser = () => {
  const ctx = useContext(AuthContext);
  return ctx.user;
};

export const useAuthToken = () => {
  const ctx = useContext(AuthContext);
  return ctx.token;
};

export const useIsAuthInitializing = () => {
  const ctx = useContext(AuthContext);
  return ctx.initializing;
};

export const useAuthService = () => {
  const ctx = useContext(AuthContext);
  return {
    login: ctx.login,
    register: ctx.register,
    logout: ctx.logout
  };
};

// Aliases for backward compatibility with existing code that imports from firebase/hooks
export const useUserId = () => {
  const user = useAuthUser();
  return user?.id ?? '';
};

export const useAuth = () => undefined;
