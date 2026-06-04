import axios from 'axios';

// In production (Vercel): VITE_API_URL = https://your-render-service.onrender.com
// In development: proxied by vite.config.ts to localhost:4000
const BASE_URL = (import.meta as any).env?.VITE_API_URL
  ? `${(import.meta as any).env.VITE_API_URL}/api/v1`
  : '/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// Attach access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
let refreshing = false;
let refreshQueue: Array<() => void> = [];

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/')) {
      if (refreshing) {
        return new Promise((resolve) => {
          refreshQueue.push(() => resolve(api(original)));
        });
      }
      refreshing = true;
      original._retry = true;
      try {
        const { data } = await api.post('/auth/refresh');
        localStorage.setItem('access_token', data.accessToken);
        refreshQueue.forEach(fn => fn());
        refreshQueue = [];
        return api(original);
      } catch {
        localStorage.removeItem('access_token');
        window.location.href = '/login';
      } finally {
        refreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export default api;
