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

export default api;

