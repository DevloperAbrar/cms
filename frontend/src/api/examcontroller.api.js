import api from './axiosInstance';

const base = '/examcontroller';

export const examControllerApi = {
  getAllSubjects: (params) => api.get(`${base}/subjects`, { params }).then((r) => r.data),
  getAllBranches: () => api.get(`${base}/branches`).then((r) => r.data),
  getStudents: (params) => api.get(`${base}/students`, { params }).then((r) => r.data),
  getExamPattern: (params) => api.get(`${base}/exam-pattern`, { params }).then((r) => r.data),

  getMarksEntries: (params) => api.get(`${base}/marks`, { params }).then((r) => r.data),
  submitEndSemMarks: (data) => api.post(`${base}/marks`, data).then((r) => r.data),
  downloadMarksTemplate: (params) =>
    api.get(`${base}/marks/template`, { params, responseType: 'blob' }),
  uploadMarksCSV: (formData) =>
    api.post(`${base}/marks/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getFinalResultConfigs: (params) => api.get(`${base}/final-results/configs`, { params }).then((r) => r.data),
  getFinalResultStreams: () => api.get(`${base}/final-results/streams`).then((r) => r.data),
  getFinalResultDepartments: (params) => api.get(`${base}/final-results/departments`, { params }).then((r) => r.data),
  getFinalResultBranches: (params) => api.get(`${base}/final-results/branches`, { params }).then((r) => r.data),
  getFinalResultStudents: (params) => api.get(`${base}/final-results/students`, { params }).then((r) => r.data),
  submitFinalResults: (data) => api.post(`${base}/final-results/submit`, data).then((r) => r.data),
  publishFinalResults: (data) => api.post(`${base}/final-results/publish`, data).then((r) => r.data),
  unpublishFinalResults: (data) => api.post(`${base}/final-results/unpublish`, data).then((r) => r.data),
};