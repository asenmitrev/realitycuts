import { useCallback } from 'react';
import { useAuthService, useAuth, useUserId, useIsAuthInitializing, useAuthUser, useAuthToken } from '../auth/hooks';

// Re-export from new auth context for backward compatibility
export { useAuth, useUserId, useIsAuthInitializing as useIsFirebaseInitializing };
export { useAuthUser, useAuthToken, useAuthService };

// Stub exports for code that still references these names
export const useIdTokenResult = () => null;
export const useRefetchToken = () => async (_force?: boolean) => {
  return localStorage.getItem('auth_token') ?? false;
};

// Shape expected by callers that still reference Firebase user properties
interface FirebaseLikeUser {
  uid: string;
  email?: string;
  displayName?: string;
}

export const useFirebaseAuthenticationService = () => {
  const { login, register, logout } = useAuthService();

  const loginWithEmailAndPassword = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      const result = await login(email, password);
      return { uid: result.user.id, email: result.user.email, displayName: result.user.firstName } as FirebaseLikeUser;
    },
    [login]
  );

  const registerWithEmailAndPassword = useCallback(
    async ({ email, password, firstName, lastName }: { email: string; password: string; firstName?: string; lastName?: string }) => {
      const result = await register(email, password, firstName, lastName);
      return {
        user: { uid: result.user.id, email: result.user.email, displayName: result.user.firstName } as FirebaseLikeUser,
        wasAnonymousLink: false
      };
    },
    [register]
  );

  return {
    loginWithEmailAndPassword,
    registerWithEmailAndPassword,
    logout,
    sendSignInLink: async () => false,
    completeSignInWithEmailLink: async () => null,
    checkSignInLink: () => false,
    loginWithGoogle: async () => null
  };
};
