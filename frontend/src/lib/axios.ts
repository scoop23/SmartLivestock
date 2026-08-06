import axios, { InternalAxiosRequestConfig } from 'axios';

// Axios instance pre-configured to talk to the Django backend.
// baseURL defaults to localhost:8000/api (Django dev server).
// Override with NEXT_PUBLIC_API_URL env var for production.
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
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

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    console.log(error.response.config);
    if (error.response?.status === 401 && error.response?.data?.code === "token_not_valid") {
      console.log("Access token expired or invalid.");
      const refreshToken = localStorage.getItem("refresh");

      if (!refreshToken) {
        return Promise.reject(error);
      }

      const response = await api.post("/api/token/refresh/", { refresh: refreshToken });
      localStorage.setItem("access", response.data.access);
      console.log("Refresh token response:", response.data);
    }
    return Promise.reject(error);
  }
)

export default api;

