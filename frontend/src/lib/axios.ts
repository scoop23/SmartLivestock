import axios, { InternalAxiosRequestConfig } from 'axios';

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _retry?: boolean;
    _fallbackRetried?: boolean;
  }
}

export const LOCAL_API_URL =
  process.env.NEXT_PUBLIC_LOCAL_API_URL || 'http://localhost:8000';
export const RENDER_API_URL = 'https://smartlivestock-xkx4.onrender.com';

// Primary backend (local Django by default, or Render in production)
export const PRIMARY_API_URL =
  process.env.NEXT_PUBLIC_API_URL || LOCAL_API_URL;

// Dynamic fallback backend: if primary is Render, fallback to local; if primary is local, fallback to Render
export const FALLBACK_API_URL =
  process.env.NEXT_PUBLIC_FALLBACK_API_URL ||
  (PRIMARY_API_URL.includes('onrender.com') ? LOCAL_API_URL : RENDER_API_URL);

export const LOCAL_FALLBACK_URL = LOCAL_API_URL;

// Check if fallback URL is allowed (safe against browser mixed-content restrictions)
const canFallbackTo = (url: string): boolean => {
  if (typeof window === 'undefined') return true;
  if (url.startsWith('https://')) return true;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
};

const canFallbackToLocal = (): boolean => canFallbackTo(LOCAL_API_URL);

// Axios instance pre-configured to talk to the Django backend.
const api = axios.create({
  baseURL: PRIMARY_API_URL,
  timeout: 15000, // 15-second timeout to handle Render cold-starts or dead connections
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getActiveApiUrl = (): string => {
  return api.defaults.baseURL || PRIMARY_API_URL;
};

// Request interceptor: attaches the JWT access token from localStorage
// to every outgoing request as a Bearer token header.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("access");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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
// 1. Failover if the current backend is down / unreachable / timing out.
// 2. Refresh expired access tokens on 401.
api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // --- Automatic Failover if Backend is Down ---
    const isNetworkOrServerError =
      !error.response ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      [502, 503, 504].includes(error.response?.status);

    const currentBaseUrl = api.defaults.baseURL || PRIMARY_API_URL;
    // Target the opposite backend: Render -> Local, or Local -> Render
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
      console.warn(
        `[SmartLivestock API] Backend unreachable (${error.code || error.response?.status || 'Network Error'}). Failing over from ${currentBaseUrl} to ${targetFallbackUrl}`
      );

      // Permanently switch defaults for this tab session so upcoming calls don't lag
      api.defaults.baseURL = targetFallbackUrl;
      originalRequest.baseURL = targetFallbackUrl;

      if (originalRequest.url && originalRequest.url.startsWith(currentBaseUrl)) {
        originalRequest.url = originalRequest.url.replace(currentBaseUrl, targetFallbackUrl);
      }

      // Retry request on the fallback backend
      try {
        return await api(originalRequest);
      } catch (fallbackErr) {
        return Promise.reject(fallbackErr);
      }
    }

    // --- 401 Token Refresh Handler ---
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/api/token/")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
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
        typeof window !== "undefined" ? localStorage.getItem("refresh") : null;

      if (!refreshToken) {
        isRefreshing = false;
        if (typeof window !== "undefined") {
          localStorage.removeItem("access");
          localStorage.removeItem("refresh");
        }
        return Promise.reject(error);
      }

      try {
        const refreshUrl = `${api.defaults.baseURL || PRIMARY_API_URL}/api/token/refresh/`;
        const response = await axios.post(refreshUrl, { refresh: refreshToken });

        const newAccessToken = response.data.access;
        const newRefreshToken = response.data.refresh;

        if (typeof window !== "undefined") {
          localStorage.setItem("access", newAccessToken);
          if (newRefreshToken) {
            localStorage.setItem("refresh", newRefreshToken);
          }
        }

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        processQueue(null, newAccessToken);
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("access");
          localStorage.removeItem("refresh");
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
