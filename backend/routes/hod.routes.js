const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { auditLog } = require('../middleware/audit.middleware');
const ctrl = require('../controllers/hod.controller');
const { ROLES } = require('../config/constants');
const sharedFrCtrl = require('../controllers/shared_finalresult.controller');

const router = express.Router();
router.use(authenticate, authorize(ROLES.HOD));

// ─── TIMETABLE ───────────────────────────────────────────────────────────────
router.get('/timetable', ctrl.getTimetable);
router.post('/timetable', auditLog('UPSERT', 'Timetable'), ctrl.upsertTimetable);
router.patch('/timetable/:id/publish', auditLog('PUBLISH', 'Timetable'), ctrl.publishTimetable);

// ─── FACULTY MANAGEMENT ──────────────────────────────────────────────────────
router.get('/faculty', ctrl.getDeptFaculty);
router.post('/faculty/assign-coordinator', auditLog('ASSIGN_COORDINATOR', 'User'), ctrl.assignCoordinator);
router.delete('/faculty/coordinator/:faculty_id', auditLog('REMOVE_COORDINATOR', 'User'), ctrl.removeCoordinator);
router.get('/branches', ctrl.getDeptBranches);
router.get('/subjects', ctrl.getDeptSubjects);

// ─── MARKS LOCK/UNLOCK ───────────────────────────────────────────────────────
router.post('/marks/lock', auditLog('LOCK', 'Marks'), ctrl.lockMarksComponent);
router.post('/marks/unlock', auditLog('UNLOCK', 'Marks'), ctrl.unlockMarksComponent);

// ─── STUDENTS & ANALYTICS ────────────────────────────────────────────────────
router.get('/students', ctrl.getDeptStudents);
router.get('/students/:student_id/attendance', ctrl.getStudentAttendance);
router.get('/defaulters', ctrl.getBranchDefaulters);

// ─── PARENT URL ──────────────────────────────────────────────────────────────
router.post('/parent-url/generate', auditLog('GENERATE', 'ParentToken'), ctrl.generateParentURL);
router.post('/parent-url/revoke', auditLog('REVOKE', 'ParentToken'), ctrl.revokeParentURL);

// ─── NOTICES ─────────────────────────────────────────────────────────────────
router.get('/notices', ctrl.getNotices);
router.post('/notices', auditLog('CREATE', 'Notice'), ctrl.postNotice);

// ─── MESSAGES ────────────────────────────────────────────────────────────────
router.get('/messages', ctrl.getMessages);
router.post('/messages', auditLog('CREATE', 'Message'), ctrl.sendMessage);

router.get('/subjects/with-faculty', ctrl.getDeptSubjectsWithFaculty);
router.post('/subjects/assign-faculty', auditLog('ASSIGN_FACULTY', 'Subject'), ctrl.assignSubjectFaculty);

// ─── SUBJECTS ────────────────────────────────────────────────────────────────
router.post('/subjects', auditLog('CREATE', 'Subject'), ctrl.createSubject);
router.put('/subjects/:id', auditLog('UPDATE', 'Subject'), ctrl.updateSubject);
router.delete('/subjects/:id', auditLog('DELETE', 'Subject'), ctrl.deleteSubject);

// ─── FACULTY ATTENDANCE ──────────────────────────────────────────────────────
router.get('/faculty-attendance/summary', ctrl.getFacultyAttendanceSummary);
router.get('/faculty-attendance', ctrl.getFacultyAttendance);
router.post('/faculty-attendance', auditLog('MARK', 'FacultyAttendance'), ctrl.markFacultyAttendance);

// ─── EXAM PATTERN ────────────────────────────────────────────────────────────
router.get('/exam-pattern', ctrl.getExamPattern);
router.post('/exam-pattern', auditLog('UPSERT', 'ExamPattern'), ctrl.upsertExamPattern);
router.get('/marks/entries', ctrl.getMarksEntries);

router.get('/marks/lock-status', ctrl.getMarksLockStatus);

router.get('/final-results/configs', sharedFrCtrl.getPublishedConfigs);
router.get('/final-results/rankings', sharedFrCtrl.getFinalResultRankings);
router.get('/quiz-marks', ctrl.getQuizMarks);

module.exports = router;