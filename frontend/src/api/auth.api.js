import api from './axiosInstance';

const d = (res) => res?.data ?? res;

export const authApi = {
  superAdminLogin: (credentials) =>
    api.post('/auth/superadmin/login', credentials).then(d),

  getMe: () => api.get('/auth/me').then(d),

  logout: () => api.post('/auth/logout'),

  googleAuthUrl: () =>
    `${import.meta.env.VITE_API_URL || '/api'}/auth/google`,
};