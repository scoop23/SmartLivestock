import axios, { InternalAxiosRequestConfig } from 'axios';

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _retry?: boolean;
    _fallbackRetried?: boolean;
  }
}

// Primary backend (Render production) and local fallback backend (Django local dev)
export const PRIMARY_API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://smartlivestock-xkx4.onrender.com';
export const LOCAL_FALLBACK_URL =
  process.env.NEXT_PUBLIC_FALLBACK_API_URL || 'http://localhost:8000';

// Check if fallback to local is allowed (safe against browser mixed-content restrictions)
const canFallbackToLocal = (): boolean => {
  if (typeof window === 'undefined') return true;
  if (LOCAL_FALLBACK_URL.startsWith('https://')) return true;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
};

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
// 1. Failover to local backend if Render is down / unreachable / timing out.
// 2. Refresh expired access tokens on 401.
api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // --- Automatic Failover to Local if Render is Down ---
    const isNetworkOrServerError =
      !error.response ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      [502, 503, 504].includes(error.response?.status);

    const isCurrentTargetRender =
      (api.defaults.baseURL || '').includes('onrender.com') ||
      (originalRequest.baseURL || '').includes('onrender.com') ||
      (originalRequest.url || '').includes('onrender.com');

    if (
      isNetworkOrServerError &&
      !originalRequest._fallbackRetried &&
      isCurrentTargetRender &&
      canFallbackToLocal()
    ) {
      originalRequest._fallbackRetried = true;
      console.warn(
        `[SmartLivestock API] Render backend unreachable (${error.code || error.response?.status || 'Network Error'}). Failing over to local backend: ${LOCAL_FALLBACK_URL}`
      );

      // Permanently switch defaults for this tab session so upcoming calls don't lag
      api.defaults.baseURL = LOCAL_FALLBACK_URL;
      originalRequest.baseURL = LOCAL_FALLBACK_URL;

      if (originalRequest.url && originalRequest.url.startsWith(PRIMARY_API_URL)) {
        originalRequest.url = originalRequest.url.replace(PRIMARY_API_URL, LOCAL_FALLBACK_URL);
      }

      // Retry request on the local backend
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
        const refreshUrl = `${api.defaults.baseURL || LOCAL_FALLBACK_URL}/api/token/refresh/`;
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
