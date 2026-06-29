import api from './axiosInstance';

const base = '/coordinator';

export const coordinatorApi = {
  // Faculty context
  getMySubjects: () => api.get(`${base}/subjects/mine`).then((r) => r.data),
  getSubjectStudents: (params) =>
    api.get(`${base}/students/subject`, { params }).then((r) => r.data),

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

  // Quiz
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

  // Branch (coordinator) context
  getBranchStudents: (params) =>
    api.get(`${base}/branch/students`, { params }).then((r) => r.data),
  getBranchAttendance: (params) =>
    api.get(`${base}/branch/attendance`, { params }).then((r) => r.data),
  getBranchAnalytics: (params) =>
    api.get(`${base}/branch/analytics`, { params }).then((r) => r.data),

  submitEndSemMarks: (data) =>
    api.post(`${base}/branch/endsem-marks`, data).then((r) => r.data),
  downloadEndSemTemplate: (params) =>
    api.get(`${base}/branch/endsem-marks/template`, { params, responseType: 'blob' }),
  uploadEndSemCSV: (formData) =>
    api.post(`${base}/branch/endsem-marks/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  generateParentURL: (data) =>
    api.post(`${base}/parent-url/generate`, data).then((r) => r.data),
  revokeParentURL: (data) =>
    api.post(`${base}/parent-url/revoke`, data).then((r) => r.data),

  getNotices: () => api.get(`${base}/notices`).then((r) => r.data),
  postNotice: (data) => api.post(`${base}/notices`, data).then((r) => r.data),

  getMessages: () => api.get(`${base}/messages`).then((r) => r.data),
  sendMessage: (data) => api.post(`${base}/messages`, data).then((r) => r.data),

  getAttendanceByDate: (params) => api.get(`${base}/attendance/mark`, { params }).then((r) => r.data),
  submitAttendance: (data) => api.post(`${base}/attendance/mark`, data).then((r) => r.data),
  getAttendanceSummary: (params) => api.get(`${base}/attendance/summary`, { params }).then((r) => r.data),
  getBranchSubjects: (params) => api.get(`${base}/branch/subjects`, { params }).then((r) => r.data),

  getExamPattern: (params) => api.get(`${base}/exam-pattern`, { params }).then((r) => r.data),

  getMarksLockStatus: (params) => api.get(`${base}/marks/lock-status`, { params }).then((r) => r.data),

  getFinalResultConfigs: () => api.get(`${base}/final-results/configs`).then((r) => r.data),
  getFinalResultStudents: (params) => api.get(`${base}/final-results/students`, { params }).then((r) => r.data),
  submitFinalResults: (data) => api.post(`${base}/final-results/submit`, data).then((r) => r.data),
  publishFinalResults: (data) => api.post(`${base}/final-results/publish`, data).then((r) => r.data),
  unpublishFinalResults: (data) => api.post(`${base}/final-results/unpublish`, data).then((r) => r.data),
  getFinalResultRankings: (params) => api.get(`${base}/final-results/rankings`, { params }).then((r) => r.data),
  getFinalResultBranches: () => api.get(`${base}/final-results/branches`).then((r) => r.data),

  updateQuiz: (id, data) => api.put(`${base}/quizzes/${id}`, data).then((r) => r.data),
  
};