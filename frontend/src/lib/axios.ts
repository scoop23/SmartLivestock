import axios, { InternalAxiosRequestConfig, AxiosError } from 'axios';

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _retry?: boolean;
    _fallbackRetried?: boolean;
    _startTime?: number;
  }
}

export const LOCAL_API_URL =
  process.env.NEXT_PUBLIC_LOCAL_API_URL || 'http://localhost:8000';
export const RENDER_API_URL =
  process.env.NEXT_PUBLIC_RENDER_API_URL || 'https://smartlivestock-xkx4.onrender.com';

// Primary backend (local Django by default, or Render in production)
export const PRIMARY_API_URL =
  process.env.NEXT_PUBLIC_API_URL || LOCAL_API_URL;

// Dynamic fallback backend
export const FALLBACK_API_URL =
  process.env.NEXT_PUBLIC_FALLBACK_API_URL ||
  (PRIMARY_API_URL.includes('onrender.com') ? LOCAL_API_URL : RENDER_API_URL);

// Check if fallback URL is allowed safely
const isLocalhost = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '127.0.0.1';

const canFallbackTo = (targetUrl: string): boolean => {
  if (typeof window === 'undefined') return true;
  const currentHost = window.location.hostname;
  
  // In local development against local backend, avoid accidental cloud failover
  // unless explicitly allowed by environment config
  if (isLocalhost(currentHost) && PRIMARY_API_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_ENABLE_CLOUD_FALLBACK === 'true';
  }

  if (targetUrl.startsWith('https://')) return true;
  return isLocalhost(currentHost);
};

// Axios instance pre-configured to talk to the Django backend.
const api = axios.create({
  baseURL: PRIMARY_API_URL,
  timeout: 30000, // 30-second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getActiveApiUrl = (): string => {
  return api.defaults.baseURL || PRIMARY_API_URL;
};

// Request interceptor: attaches the JWT access token from localStorage
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config._startTime = Date.now();
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  // Allow browser to automatically set multipart/form-data boundary for FormData
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Intercept responses:
// 1. Refresh expired access tokens on 401 with concurrent queueing.
// 2. Request-local failover if primary backend is unreachable without mutating global baseURL.
api.interceptors.response.use(
  (response) => {
    return response;
  },

  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig | undefined;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Do not treat intentional request cancellation as a network/server failure
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }

    // --- 1. 401 Token Refresh Handler ---
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/api/token/')
    ) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken =
        typeof window !== 'undefined' ? localStorage.getItem('refresh') : null;

      if (!refreshToken) {
        isRefreshing = false;
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access');
          localStorage.removeItem('refresh');
        }
        return Promise.reject(error);
      }

      try {
        const refreshBaseUrl = api.defaults.baseURL || PRIMARY_API_URL;
        const refreshUrl = `${refreshBaseUrl.replace(/\/+$/, '')}/api/token/refresh/`;
        const response = await axios.post<{ access: string; refresh?: string }>(
          refreshUrl,
          { refresh: refreshToken },
          { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
        );

        const newAccessToken = response.data.access;
        const newRefreshToken = response.data.refresh;

        if (typeof window !== 'undefined') {
          localStorage.setItem('access', newAccessToken);
          if (newRefreshToken) {
            localStorage.setItem('refresh', newRefreshToken);
          }
        }

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        processQueue(null, newAccessToken);
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access');
          localStorage.removeItem('refresh');
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    // --- 2. Request-Local Automatic Failover if Primary is Unreachable ---
    const isNetworkOrServerError =
      !error.response ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      [502, 503, 504].includes(error.response?.status);

    const currentBaseUrl = originalRequest.baseURL || api.defaults.baseURL || PRIMARY_API_URL;
    const targetFallbackUrl = currentBaseUrl.includes('onrender.com')
      ? LOCAL_API_URL
      : RENDER_API_URL;

    const canAttemptFallback =
      isNetworkOrServerError &&
      !originalRequest._fallbackRetried &&
      targetFallbackUrl !== currentBaseUrl &&
      canFallbackTo(targetFallbackUrl);

    if (canAttemptFallback) {
      originalRequest._fallbackRetried = true;
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[SmartLivestock API] Endpoint ${originalRequest.url} unreachable on ${currentBaseUrl}. Retrying on fallback: ${targetFallbackUrl}`
        );
      }

      // Request-local retry without mutating global api.defaults.baseURL
      const retryConfig: InternalAxiosRequestConfig = {
        ...originalRequest,
        baseURL: targetFallbackUrl,
      };

      if (retryConfig.url && retryConfig.url.startsWith(currentBaseUrl)) {
        retryConfig.url = retryConfig.url.replace(currentBaseUrl, targetFallbackUrl);
      }

      try {
        return await axios(retryConfig);
      } catch (fallbackErr) {
        return Promise.reject(fallbackErr);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
