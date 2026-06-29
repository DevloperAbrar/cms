import api from './axiosInstance';

const base = '/faculty';

export const facultyApi = {
  getMyStudents: (params) => api.get(`${base}/students`, { params }).then((r) => r.data),
  getMySubjects: () => api.get(`${base}/subjects`).then((r) => r.data),

  getSubFieldConfig: (params) =>
    api.get(`${base}/sub-field-config`, { params }).then((r) => r.data),
  saveSubFieldConfig: (data) =>
    api.post(`${base}/sub-field-config`, data).then((r) => r.data),

  getMarksEntries: (params) =>
    api.get(`${base}/marks/entries`, { params }).then((r) => r.data),
  submitMarks: (data) => api.post(`${base}/marks/submit`, data).then((r) => r.data),
  downloadMarksTemplate: (params) =>
    api.get(`${base}/marks/template`, { params, responseType: 'blob' }),
  uploadMarksCSV: (formData) =>
    api.post(`${base}/marks/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getMyQuizzes: () => api.get(`${base}/quizzes`).then((r) => r.data),
  createQuiz: (data) => api.post(`${base}/quizzes`, data).then((r) => r.data),
  updateQuiz: (id, data) => api.put(`${base}/quizzes/${id}`, data).then((r) => r.data),
  publishQuiz: (id) => api.patch(`${base}/quizzes/${id}/publish`).then((r) => r.data),
  deleteQuiz: (id) => api.delete(`${base}/quizzes/${id}`),
  uploadQuizImage: (questionId, formData) =>
    api.post(`${base}/quizzes/image/${questionId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
  getQuizResults: (id) => api.get(`${base}/quizzes/${id}/results`).then((r) => r.data),
  getQuizResults: (id) => api.get(`${base}/quizzes/${id}/results`).then((r) => r.data),
  publishResults: (id, mode) => api.patch(`${base}/quizzes/${id}/publish-results`, { mode }).then((r) => r.data),

  getNotices: () => api.get(`${base}/notices`).then((r) => r.data),
  postNotice: (data) => api.post(`${base}/notices`, data).then((r) => r.data),

  getMessages: () => api.get(`${base}/messages`).then((r) => r.data),
  sendMessage: (data) => api.post(`${base}/messages`, data).then((r) => r.data),

  getAttendanceByDate: (params) => api.get('/faculty/attendance', { params }).then((r) => r.data),
  submitAttendance: (data) => api.post('/faculty/attendance', data).then((r) => r.data),
  getAttendanceSummary: (params) => api.get('/faculty/attendance/summary', { params }).then((r) => r.data),

  getExamPattern: (params) => api.get(`/faculty/exam-pattern`, { params }).then((r) => r.data),

  getMarksLockStatus: (params) => api.get(`${base}/marks/lock-status`, { params }).then((r) => r.data),

  getFinalResultConfigs: (params) => api.get('/faculty/final-results/configs', { params }).then((r) => r.data),
  getFinalResultRankings: (params) => api.get('/faculty/final-results/rankings', { params }).then((r) => r.data),
  getFinalResultBranches: () => api.get(`/faculty/final-results/branches`).then((r) => r.data),

  exportAttendanceSummary: (params) =>
    api.get(`${base}/attendance/summary/export`, { params, responseType: 'blob' }),
};