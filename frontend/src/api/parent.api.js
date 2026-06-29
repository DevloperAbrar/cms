import api from './axiosInstance';

export const parentApi = {
  getParentView: (token) => api.get(`/parent/${token}`).then((r) => r.data),
};