import api from './axiosInstance';

const base = '/superadmin';

const d = (res) => res?.data ?? res;

// Unified login — replaces the old /superadmin/login call
export const loginUser = (email, password) =>
  api.post('/auth/login', { email, password }).then(d);

export const superadminApi = {
  // Streams
  getStreams: () => api.get(`${base}/streams`).then(d),
  createStream: (data) => api.post(`${base}/streams`, data).then(d),
  updateStream: (id, data) => api.put(`${base}/streams/${id}`, data).then(d),
  deleteStream: (id) => api.delete(`${base}/streams/${id}`).then(d),

  // Departments
  getDepartments: (params) => api.get(`${base}/departments`, { params }).then(d),
  createDepartment: (data) => api.post(`${base}/departments`, data).then(d),
  updateDepartment: (id, data) => api.put(`${base}/departments/${id}`, data).then(d),
  deleteDepartment: (id) => api.delete(`${base}/departments/${id}`).then(d),

  // Branches
  getBranches: (params) => api.get(`${base}/branches`, { params }).then(d),
  createBranch: (data) => api.post(`${base}/branches`, data).then(d),
  updateBranch: (id, data) => api.put(`${base}/branches/${id}`, data).then(d),
  deleteBranch: (id) => api.delete(`${base}/branches/${id}`).then(d),

  // Subjects
  getSubjects: (params) => api.get(`${base}/subjects`, { params }).then(d),
  createSubject: (data) => api.post(`${base}/subjects`, data).then(d),
  updateSubject: (id, data) => api.put(`${base}/subjects/${id}`, data).then(d),
  deleteSubject: (id) => api.delete(`${base}/subjects/${id}`).then(d),

  // Users
  getUsers: (params) => api.get(`${base}/users`, { params }).then(d),
  createUser: (data) => api.post(`${base}/users`, data).then(d),
  updateUser: (id, data) => api.put(`${base}/users/${id}`, data).then(d),
  deactivateUser: (id) => api.patch(`${base}/users/${id}/deactivate`).then(d),
  deleteUser: (id) => api.delete(`${base}/users/${id}`).then(d),

  // Students CSV
  uploadStudentsCSV: (formData) =>
    api.post(`${base}/students/csv-upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(d),

  downloadStudentTemplate: () =>
    api.get(`${base}/students/csv-template`, {
      responseType: 'blob',
      transformResponse: [(data) => data],
    }),

  // Exam Pattern
  getExamPattern: (params) => api.get(`${base}/exam-pattern`, { params }).then(d),
  upsertExamPattern: (data) => api.post(`${base}/exam-pattern`, data).then(d),
  forceUnlockPattern: (id) =>
    api.patch(`${base}/exam-pattern/${id}/force-unlock`).then(d),

  // Audit Logs
  getAuditLogs: (params) => api.get(`${base}/audit-logs`, { params }).then(d),
  exportAuditLogs: (params) =>
    api.get(`${base}/audit-logs/export`, {
      params,
      responseType: 'blob',
      transformResponse: [(data) => data],
    }),

  // Notices
  getNotices: (params) => api.get(`${base}/notices`, { params }).then(d),
  createNotice: (data) => api.post(`${base}/notices`, data).then(d),
  updateNotice: (id, data) => api.put(`${base}/notices/${id}`, data).then(d),
  deleteNotice: (id) => api.delete(`${base}/notices/${id}`).then(d),

  // Final Results
  getFinalResultConfigs: (params) =>
    api.get(`${base}/final-results/configs`, { params }).then(d),
  createFinalResultConfig: (data) =>
    api.post(`${base}/final-results/configs`, data).then(d),
  updateFinalResultConfig: (id, data) =>
    api.put(`${base}/final-results/configs/${id}`, data).then(d),
  deleteFinalResultConfig: (id) =>
    api.delete(`${base}/final-results/configs/${id}`).then(d),
  getFinalResultsAdmin: (params) =>
    api.get(`${base}/final-results`, { params }).then(d),
};