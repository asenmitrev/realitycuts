import { FC, PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext, AuthUser } from './context';
import axios from 'axios';
import { GlobalSpinner } from '../../components/common/GlobalSpinner';

const API_URL = import.meta.env.VITE_API_URL;

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// Enable credentials (cookies) on all axios requests
axios.defaults.withCredentials = true;

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function setUser(user: AuthUser | null) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

function clearAuth(): void {
  setToken(null);
  setUser(null);
}
/**
 * Refresh the access token using the httpOnly refresh token cookie.
 * Returns the new access token, or null if refresh failed.
 */
async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await axios.post(`${API_URL}/api/auth/refresh`, {}, {
      withCredentials: true,
    });
    return res.data.accessToken ?? null;
  } catch {
    return null;
  }
}

export const AuthProvider: FC<PropsWithChildren> = ({ children }) => {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Use refs to avoid stale closures in the axios interceptor
  const setTokenStateRef = useRef(setTokenState);
  const setUserStateRef = useRef(setUserState);

  setTokenStateRef.current = setTokenState;
  setUserStateRef.current = setUserState;

  // Track whether a refresh is in progress to avoid duplicate refresh calls
  const refreshingRef = useRef(false);
  // Queue of failed requests waiting for a refresh to complete
  const failedQueueRef = useRef<Array<{ resolve: (newToken: string) => void; reject: (err: unknown) => void }>>([]);

  useEffect(() => {
    // Restore session from localStorage
    const savedToken = getToken();
    const savedUser = getUser();
    if (savedToken && savedUser) {
      setTokenState(savedToken);
      setUserState(savedUser);
    }
    setInitializing(false);
  }, []);

  // Set up axios interceptors
  useEffect(() => {
    // Request interceptor — attach Bearer token
    const reqInterceptor = axios.interceptors.request.use((config) => {
      const currentToken = getToken();
      if (currentToken) {
        config.headers.Authorization = `Bearer ${currentToken}`;
      }
      return config;
    });

    // Response interceptor — auto-refresh on 401
    const resInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Only attempt refresh on 401, and only once per request (avoid loops)
        // Skip /refresh itself to avoid infinite retry loops
        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          !originalRequest.url?.endsWith('/api/auth/refresh')
        ) {
          originalRequest._retry = true;

          if (refreshingRef.current) {
            // Another request is already refreshing — queue this one
            return new Promise<string>((resolve, reject) => {
              failedQueueRef.current.push({ resolve, reject });
            })
              .then((newToken) => {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return axios(originalRequest);
              })
              .catch((err) => Promise.reject(err));
          }

          refreshingRef.current = true;

          try {
            const newToken = await refreshAccessToken();
            if (newToken) {
              // Refresh succeeded — update state and retry
              setToken(newToken);
              setTokenStateRef.current(newToken);
              originalRequest.headers.Authorization = `Bearer ${newToken}`;

              // Process all queued requests
              failedQueueRef.current.forEach((item) => item.resolve(newToken));
              failedQueueRef.current = [];

              return axios(originalRequest);
            } else {
              // Refresh failed — force logout
              throw new Error('Refresh token invalid');
            }
          } catch {
            // Refresh token is invalid/expired — clear auth and redirect
            clearAuth();
            setTokenStateRef.current(null);
            setUserStateRef.current(null);

            // Reject all queued requests
            failedQueueRef.current.forEach((item) => item.reject(new Error('Session expired')));
            failedQueueRef.current = [];

            // Hard redirect — AuthProvider is outside RouterProvider
            window.location.replace('/login');
            return Promise.reject(new Error('Session expired'));
          } finally {
            refreshingRef.current = false;
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(reqInterceptor);
      axios.interceptors.response.eject(resInterceptor);
    };
  }, []);

  const doLogin = useCallback(async (email: string, password: string) => {
    const res = await axios.post(`${API_URL}/api/auth/login`, { email, password }, {
      withCredentials: true,
    });
    const data = res.data as { user: AuthUser; accessToken: string };
    setTokenState(data.accessToken);
    setUserState(data.user);
    setToken(data.accessToken);
    setUser(data.user);
    return { user: data.user, token: data.accessToken };
  }, []);

  const doRegister = useCallback(async (email: string, password: string, firstName?: string, lastName?: string) => {
    const res = await axios.post(`${API_URL}/api/auth/register`, { email, password, firstName, lastName }, {
      withCredentials: true,
    });
    const data = res.data as { user: AuthUser; accessToken: string };
    setTokenState(data.accessToken);
    setUserState(data.user);
    setToken(data.accessToken);
    setUser(data.user);
    return { user: data.user, token: data.accessToken };
  }, []);

  const doLogout = useCallback(async () => {
    // Call server to clear the httpOnly refresh token cookie
    try {
      await axios.post(`${API_URL}/api/auth/logout`, {}, {
        withCredentials: true,
      });
    } catch {
      // Ignore errors — still clear local state
    }
    clearAuth();
    setTokenState(null);
    setUserState(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      initializing,
      login: doLogin,
      register: doRegister,
      logout: doLogout
    }),
    [user, token, initializing, doLogin, doRegister, doLogout]
  );

  if (initializing) {
    return <GlobalSpinner />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
