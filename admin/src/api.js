import axios from 'axios';

// Create axios instance with base URL
const api = axios.create({
  baseURL: '/booking/api'
});

// Add auth token to requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  response => response,
  error => {
    const isLoginRequest = error.config?.url?.includes('/auth/login');

    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('token');
      window.location.href = '/booking/admin-dist/login';
    }
    return Promise.reject(error);
  }
);

export default api;
