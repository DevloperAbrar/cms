import api from './axiosInstance';

const base = '/student';

export const studentApi = {
  getProfile: () => api.get(`${base}/profile`).then((r) => r.data),
  getAttendance: () => api.get(`${base}/attendance`).then((r) => r.data),

  getMarks: (params) => api.get(`${base}/marks`, { params }).then((r) => r.data),
  getSGPA: (params) => api.get(`${base}/marks/sgpa`, { params }).then((r) => r.data),
  getCGPA: () => api.get(`${base}/marks/cgpa`).then((r) => r.data),

  getTimetable: (params) => api.get(`${base}/timetable`, { params }).then((r) => r.data),

  getActiveQuizzes: () => api.get(`${base}/quizzes/active`).then((r) => r.data),
  getActiveQuizzes: () => api.get(`${base}/quizzes/active`).then((r) => r.data),
  getPastQuizzes: () => api.get(`${base}/quizzes/past`).then((r) => r.data),
  startQuiz: (quizId) => api.post(`${base}/quizzes/${quizId}/start`).then((r) => r.data),
  submitQuiz: (attemptId, data) =>
    api.post(`${base}/quizzes/attempts/${attemptId}/submit`, data).then((r) => r.data),
  getQuizResult: (quizId) => api.get(`${base}/quizzes/${quizId}/result`).then((r) => r.data),

  getNotices: () => api.get(`${base}/notices`).then((r) => r.data),
  markNoticeRead: (id) => api.patch(`${base}/notices/${id}/read`),

  getMessages: () => api.get(`${base}/messages`).then((r) => r.data),
  markMessageRead: (id) => api.patch(`${base}/messages/${id}/read`),

  getFinalResultConfigs: (params) => api.get(`${base}/final-results/configs`, { params }).then((r) => r.data),
  getMyFinalResult: (params) => api.get(`${base}/final-results/mine`, { params }).then((r) => r.data),
  getFinalResultRankings: (params) => api.get(`${base}/final-results/rankings`, { params }).then((r) => r.data),
};