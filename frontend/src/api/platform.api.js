import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/platform`
    : 'http://localhost:5000/api/platform',
  withCredentials: true,
});

// Attach platform token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('platform_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────────
// Returns raw axios response so caller gets res.data.data.token
export const platformLogin = (data) => api.post('/auth/login', data);

// ── Colleges ──────────────────────────────────────────────────────────────────
// These unwrap to res.data directly (the { success, data } envelope)
const d = (res) => res?.data ?? res;

export const listColleges       = ()           => api.get('/colleges').then(d);
export const createCollege      = (data)       => api.post('/colleges', data).then(d);
export const renewCollege       = (id, data)   => api.patch(`/colleges/${id}/renew`, data).then(d);
export const suspendCollege     = (id, data)   => api.patch(`/colleges/${id}/suspend`, data).then(d);
export const softDeleteCollege  = (id)         => api.delete(`/colleges/${id}`).then(d);
export const reactivateCollege  = (id)         => api.patch(`/colleges/${id}/reactivate`).then(d);
export const purgeCollege       = (id, code)   => api.post(`/colleges/${id}/purge`, { confirmCode: code }).then(d);

export default api;