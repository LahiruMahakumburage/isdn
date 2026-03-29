import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

api.interceptors.request.use(config => {
  try {
    const stored = localStorage.getItem('isdn-auth');
    if (stored) {
      const token = JSON.parse(stored)?.state?.token;
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('isdn-auth');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
