import api from './axiosInstance';

const base = '/hod';

export const hodApi = {
  // Timetable
  getTimetable: (params) => api.get(`${base}/timetable`, { params }).then((r) => r.data),
  upsertTimetable: (data) => api.post(`${base}/timetable`, data).then((r) => r.data),
  publishTimetable: (id) => api.patch(`${base}/timetable/${id}/publish`).then((r) => r.data),

  // Faculty
  getDeptFaculty: () => api.get(`${base}/faculty`).then((r) => r.data),
  assignCoordinator: (data) =>
    api.post(`${base}/faculty/assign-coordinator`, data).then((r) => r.data),
  removeCoordinator: (faculty_id) =>
    api.delete(`${base}/faculty/coordinator/${faculty_id}`).then((r) => r.data),

  //branch
  getDeptBranches: () => api.get(`${base}/branches`).then((r) => r.data),

  //subject
  getDeptSubjects: (params) => api.get(`${base}/subjects`, { params }).then((r) => r.data),

  // Marks
  lockComponent: (data) => api.post(`${base}/marks/lock`, data).then((r) => r.data),
  unlockComponent: (data) => api.post(`${base}/marks/unlock`, data).then((r) => r.data),

  // Students
  getDeptStudents: () => api.get(`${base}/students`).then((r) => r.data),
  getStudentAttendance: (studentId) =>
    api.get(`${base}/students/${studentId}/attendance`).then((r) => r.data),
  getBranchDefaulters: (params) =>
    api.get(`${base}/defaulters`, { params }).then((r) => r.data),

  // Parent URL
  generateParentURL: (data) =>
    api.post(`${base}/parent-url/generate`, data).then((r) => r.data),
  revokeParentURL: (data) =>
    api.post(`${base}/parent-url/revoke`, data).then((r) => r.data),

  // Notices
  getNotices: () => api.get(`${base}/notices`).then((r) => r.data),
  postNotice: (data) => api.post(`${base}/notices`, data).then((r) => r.data),

  // Messages
  getMessages: () => api.get(`${base}/messages`).then((r) => r.data),
  sendMessage: (data) => api.post(`${base}/messages`, data).then((r) => r.data),

  getSubjectsWithFaculty: (params) => api.get(`${base}/subjects/with-faculty`, { params }).then((r) => r.data),
  assignSubjectFaculty: (data) => api.post(`${base}/subjects/assign-faculty`, data).then((r) => r.data),

  createSubject: (data) => api.post(`${base}/subjects`, data).then((r) => r.data),
  updateSubject: (id, data) => api.put(`${base}/subjects/${id}`, data).then((r) => r.data),
  deleteSubject: (id) => api.delete(`${base}/subjects/${id}`).then((r) => r.data),

  // Faculty Attendance
  getFacultyAttendanceSummary: (date) =>
    api.get(`${base}/faculty-attendance/summary`, { params: { date } }).then((r) => r.data),
  getFacultyAttendance: (params) =>
    api.get(`${base}/faculty-attendance`, { params }).then((r) => r.data),
  markFacultyAttendance: (records) =>
    api.post(`${base}/faculty-attendance`, { records }).then((r) => r.data),

  // Exam Pattern
  listExamPatterns: () => api.get(`${base}/exam-pattern/list`).then((r) => r.data),
  getExamPattern: (params) => api.get(`${base}/exam-pattern`, { params }).then((r) => r.data),
  upsertExamPattern: (data) => api.post(`${base}/exam-pattern`, data).then((r) => r.data),

  getMarksEntries: (params) => api.get(`${base}/marks/entries`, { params }).then((r) => r.data),

  getMarksLockStatus: (params) => api.get(`${base}/marks/lock-status`, { params }).then((r) => r.data),

  getFinalResultConfigs: (params) => api.get(`/hod/final-results/configs`, { params }).then((r) => r.data),
  getFinalResultRankings: (params) => api.get(`/hod/final-results/rankings`, { params }).then((r) => r.data),
  getQuizMarks: (params) => api.get(`${base}/quiz-marks`, { params }).then((r) => r.data),

};