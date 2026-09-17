import api from './axiosInstance';

const base = '/examcontroller';

export const examControllerApi = {
  getAllSubjects: (params) => api.get(`${base}/subjects`, { params }).then((r) => r.data),
  getAllBranches: () => api.get(`${base}/branches`).then((r) => r.data),

  getFinalResultConfigs: (params) => api.get(`${base}/final-results/configs`, { params }).then((r) => r.data),
  getFinalResultDepartments: () => api.get(`${base}/final-results/departments`).then((r) => r.data),
  getFinalResultBranches: (params) => api.get(`${base}/final-results/branches`, { params }).then((r) => r.data),
  getFinalResultStudents: (params) => api.get(`${base}/final-results/students`, { params }).then((r) => r.data),
  submitFinalResults: (data) => api.post(`${base}/final-results/submit`, data).then((r) => r.data),
  publishFinalResults: (data) => api.post(`${base}/final-results/publish`, data).then((r) => r.data),
  unpublishFinalResults: (data) => api.post(`${base}/final-results/unpublish`, data).then((r) => r.data),
};