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

let isRefreshing = false;

// Intercept failed responses.
// If the access token has expired, refresh it and retry the original request.
api.interceptors.response.use(
  (response) => response,

  async (error) => {
    if (error.response?.status === 401 && error.response?.data?.code === "token_not_valid") {
      console.log("Access token expired or invalid.");
      try {
        const refreshToken = localStorage.getItem("refresh");
        const source = error.config;

        if (!refreshToken) {
          return Promise.reject(error);
        }

        const response = await axios.post("http://localhost:8000/api/token/refresh/", { refresh: refreshToken });
        localStorage.setItem("access", response.data.access);
        source.headers.Authorization = `Bearer ${response.data.access}`;

        return api(source); // execute the request again now with the newly attached token.
      } catch (err) {
        if (axios.isAxiosError(err)) {
          console.log(err.response?.data);
        }
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
)

export default api;

