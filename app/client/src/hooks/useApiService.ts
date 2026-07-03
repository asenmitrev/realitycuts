import { useCallback, useMemo } from 'react';
import { useAuthToken } from '../contexts/auth/hooks';
import { ApiError, apiService } from '../service/apiService';
import type { Config } from '../service/apiService';
import { useToast } from '@chakra-ui/react';

export type ApiErrorToastSuppression =
  | boolean
  | {
      statusCodes?: number[];
      if?: (e: ApiError) => boolean;
    };

function shouldSuppressToast(e: ApiError, suppression?: ApiErrorToastSuppression) {
  if (!suppression) return false;
  if (suppression === true) return true;
  if (suppression.statusCodes?.includes(e.statusCode)) return true;
  if (suppression.if?.(e) === true) return true;
  return false;
}

export const useApiService = () => {
  const token = useAuthToken();
  const toast = useToast();

  const config = useMemo(() => {
    const out = {} as Config;
    if (token) {
      out.token = token;
    }
    return out;
  }, [token]);

  // Note: Authorization header and 401 auto-refresh are handled globally by AuthProvider's
  // axios interceptors. This hook only needs to pass the token for apiService methods
  // that set headers manually (post/patch) and handle non-401 error toasts.

  const errorCallback = useCallback(
    async (e: unknown, opts?: { suppressToast?: ApiErrorToastSuppression }) => {
      if (e instanceof ApiError) {
        // 401s are handled by AuthProvider's global interceptor (auto-refresh or redirect)
        if (!shouldSuppressToast(e, opts?.suppressToast)) {
          toast({ status: 'error', title: e.message });
        }
      }
      throw e;
    },
    [toast]
  );

  const get = useCallback(
    <T>(url: string, opts?: { suppressToast?: ApiErrorToastSuppression }) => {
      return apiService.get<T>(url).catch((e) => errorCallback(e, opts));
    },
    [errorCallback]
  );

  const deleteRequest = useCallback(
    (url: string) => {
      return apiService.delete(url).catch((e) => errorCallback(e));
    },
    [errorCallback]
  );

  const put = useCallback(
    <TResponse, TRequest>(url: string, data: TRequest) => {
      return apiService.put<TResponse, TRequest>(url, data).catch((e) => errorCallback(e));
    },
    [errorCallback]
  );

  const post = useCallback(
    <TResponse, TRequest = void>(url: string, data?: TRequest, cfg?: Partial<Config>) => {
      return apiService.post<TResponse, TRequest>(url, data, { ...config, ...cfg }).catch((e) => errorCallback(e));
    },
    [config, errorCallback]
  );

  const patch = useCallback(
    <TResponse, TRequest = void>(url: string, data?: TRequest, cfg?: Partial<Config>) => {
      return apiService.patch<TResponse, TRequest>(url, data, { ...config, ...cfg }).catch((e) => errorCallback(e));
    },
    [config, errorCallback]
  );

  return useMemo(
    () => ({
      get,
      put,
      post,
      patch,
      delete: deleteRequest
    }),
    [get, put, deleteRequest, post, patch]
  );
};
