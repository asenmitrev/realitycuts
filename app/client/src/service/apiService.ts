import axios, { AxiosProgressEvent, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

export interface Config {
  token: string;
  forceRefresh: boolean;
  onProgress?: (progress: AxiosProgressEvent) => void;
}

export interface CustomAxiosRequestConfig extends AxiosRequestConfig {
  forceRefresh: boolean;
}

export interface CustomInternalAxiosRequestConfig extends InternalAxiosRequestConfig {
  forceRefresh?: boolean;
}

export class ApiError extends Error {
  public statusCode: number;
  public data?: unknown;
  constructor(message: string, { statusCode, data }: { statusCode: number; data?: unknown }) {
    super(message);
    this.statusCode = statusCode;
    this.data = data;
  }
}
const get = async <T>(url: string): Promise<T> => {
  try {
    const response = await axios.get<T>(`${import.meta.env.VITE_API_URL}${url}`);

    // Axios response has the actual data in the 'data' property
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // Assuming error.response?.data contains the error message
      // You might need to adjust this based on the actual error structure
      const message = error.response?.data?.message ?? 'Error in GET request.';
      const statusCode = error.response?.status ?? 500;

      throw new ApiError(message, { statusCode });
    } else {
      // Handle non-Axios errors (e.g., network issues)
      throw new Error('An unexpected error occurred.');
    }
  }
};

const deleteRequest = async (url: string) => {
  try {
    const response = await axios.delete(`${import.meta.env.VITE_API_URL}${url}`);

    // Axios response has the actual data in the 'data' property
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // Assuming error.response?.data contains the error message
      // You might need to adjust this based on the actual error structure
      const message = error.response?.data?.message ?? 'Error in DELETE request.';
      const statusCode = error.response?.status ?? 500;

      throw new ApiError(message, { statusCode });
    } else {
      // Handle non-Axios errors (e.g., network issues)
      throw new Error('An unexpected error occurred.');
    }
  }
};

const put = async <TResponse, TRequest>(url: string, data: TRequest) => {
  try {
    const response = await axios.put<TResponse>(`${import.meta.env.VITE_API_URL}${url}`, data);

    // Axios response has the actual data in the 'data' property
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // Assuming error.response?.data contains the error message
      // You might need to adjust this based on the actual error structure
      const message = error.response?.data?.message ?? 'Error in DELETE request.';
      const statusCode = error.response?.status ?? 500;

      throw new ApiError(message, { statusCode });
    } else {
      // Handle non-Axios errors (e.g., network issues)
      throw new Error('An unexpected error occurred.');
    }
  }
};

const post = async <TResponse, TRequest>(
  url: string,
  data: TRequest | undefined,
  { token, onProgress, forceRefresh }: Config
): Promise<TResponse> => {
  const headers: AxiosRequestConfig['headers'] = {};

  // Set 'Authorization' header if token is provided
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await axios.post<TResponse>(`${import.meta.env.VITE_API_URL}${url}`, data, {
      onUploadProgress: e => {
        onProgress?.(e ?? 0);
      },
      forceRefresh,
      headers: headers
    } as CustomAxiosRequestConfig);

    // Axios response has the actual data in the 'data' property
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // Assuming error.response?.data contains the error message
      // You might need to adjust this based on the actual error structure
      const message = error.response?.data?.message ?? 'Error in POST request.';
      const statusCode = error.response?.status ?? 500;

      throw new ApiError(message, { statusCode, data: error.response?.data });
    } else {
      // Handle non-Axios errors (e.g., network issues)
      throw new Error('An unexpected error occurred.');
    }
  }
};

const patch = async <TResponse, TRequest>(
  url: string,
  data: TRequest | undefined,
  { token, onProgress, forceRefresh }: Config
): Promise<TResponse> => {
  const headers: AxiosRequestConfig['headers'] = {};

  // Set 'Authorization' header if token is provided
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await axios.patch<TResponse>(`${import.meta.env.VITE_API_URL}${url}`, data, {
      onUploadProgress: e => {
        onProgress?.(e ?? 0);
      },
      forceRefresh,
      headers: headers
    } as CustomAxiosRequestConfig);

    // Axios response has the actual data in the 'data' property
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // Assuming error.response?.data contains the error message
      // You might need to adjust this based on the actual error structure
      const message = error.response?.data?.message ?? 'Error in POST request.';
      const statusCode = error.response?.status ?? 500;

      throw new ApiError(message, { statusCode, data: error.response?.data });
    } else {
      // Handle non-Axios errors (e.g., network issues)
      throw new Error('An unexpected error occurred.');
    }
  }
};

export const apiService = {
  get,
  put,
  patch,
  delete: deleteRequest,
  post
};
