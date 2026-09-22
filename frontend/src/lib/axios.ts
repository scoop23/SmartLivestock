import axios, { InternalAxiosRequestConfig } from 'axios';

// Axios instance pre-configured to talk to the Django backend.
// baseURL defaults to localhost:8000/api (Django dev server).
// Override with NEXT_PUBLIC_API_URL env var for production.
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://smartlivestock-xkx4.onrender.com',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attaches the JWT access token from localStorage
// to every outgoing request as a Bearer token header.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("access");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config;
})

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

// Intercept failed responses.
// If the access token has expired, refresh it once using a queue and retry queued requests.
api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 and request hasn't been retried yet
    if (
      error.response?.status === 401 &&
      originalRequest &&
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
        const refreshUrl = `${api.defaults.baseURL || "https://smartlivestock-xkx4.onrender.com"}/api/token/refresh/`;
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

