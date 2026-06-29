const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { auditLog } = require('../middleware/audit.middleware');
const ctrl = require('../controllers/coordinator.controller');
const { ROLES } = require('../config/constants');
const frCoordCtrl = require('../controllers/coordinator_finalresult.controller');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WebP images allowed.'));
  },
});

router.use(authenticate, authorize(ROLES.COORDINATOR));

// ─── FACULTY CONTEXT — Own subject ───────────────────────────────────────────
router.get('/subjects/mine', ctrl.getMySubjects);
router.get('/students/subject', ctrl.getSubjectStudents);

// Sub-field config
router.get('/sub-field-config', ctrl.getSubFieldConfig);
router.post('/sub-field-config', auditLog('UPSERT', 'MarksComponent'), ctrl.saveSubFieldConfig);

// Internal marks entry
router.get('/marks/entries', ctrl.getMarksEntries);
router.post('/marks/submit', auditLog('SUBMIT', 'Marks'), ctrl.submitInternalMarks);
router.get('/marks/template', ctrl.downloadMarksTemplate);
router.post('/marks/upload', upload.single('file'), auditLog('IMPORT', 'Marks'), ctrl.uploadMarksCSV);

// Quiz
router.get('/quizzes', ctrl.getMyQuizzes);
router.post('/quizzes', auditLog('CREATE', 'Quiz'), ctrl.createQuiz);
router.put('/quizzes/:id', auditLog('UPDATE', 'Quiz'), ctrl.updateQuiz);
router.patch('/quizzes/:id/publish', auditLog('PUBLISH', 'Quiz'), ctrl.publishQuiz);
router.delete('/quizzes/:id', auditLog('DELETE', 'Quiz'), ctrl.deleteQuiz);
router.post('/quizzes/image/:questionId', imageUpload.single('image'), ctrl.uploadQuizImage);
router.get('/quizzes/:id/results', ctrl.getQuizResults);

// ─── COORDINATOR CONTEXT — Branch-scoped ─────────────────────────────────────
router.get('/branch/students', ctrl.getBranchStudents);
router.get('/branch/attendance', ctrl.getBranchAttendance);
router.get('/branch/analytics', ctrl.getBranchAnalytics);

// End-sem marks
router.get('/branch/endsem-marks', ctrl.getMarksEntries); // same format
router.post('/branch/endsem-marks', auditLog('SUBMIT', 'Marks'), ctrl.submitEndSemMarks);
router.get('/branch/endsem-marks/template', ctrl.downloadEndSemTemplate);
router.post('/branch/endsem-marks/upload', upload.single('file'), auditLog('IMPORT', 'Marks'), ctrl.uploadEndSemCSV);

// Parent URL
router.post('/parent-url/generate', auditLog('GENERATE', 'ParentToken'), ctrl.generateParentURL);
router.post('/parent-url/revoke', auditLog('REVOKE', 'ParentToken'), ctrl.revokeParentURL);

// Notices
router.get('/notices', ctrl.getNotices);
router.post('/notices', auditLog('CREATE', 'Notice'), ctrl.postNotice);

// Messages
router.get('/messages', ctrl.getMessages);
router.post('/messages', auditLog('CREATE', 'Message'), ctrl.sendMessage);
router.get('/attendance/mark', ctrl.markAttendanceByDate);
router.post('/attendance/mark', auditLog('SUBMIT', 'Attendance'), ctrl.submitAttendanceMark);
router.get('/attendance/summary', ctrl.getAttendanceSummaryCoord);
router.get('/branch/subjects', ctrl.getBranchSubjects);

// ─── EXAM PATTERN ────────────────────────────────────────────────────────────
const facultyCtrl = require('../controllers/faculty.controller');
router.get('/exam-pattern', facultyCtrl.getExamPattern);

router.get('/marks/lock-status', facultyCtrl.getMarksLockStatus);

router.get('/final-results/configs', frCoordCtrl.getFinalResultConfigs);
router.get('/final-results/students', frCoordCtrl.getFinalResultStudents);
router.post('/final-results/submit', auditLog('SUBMIT', 'FinalResult'), frCoordCtrl.submitFinalResults);
router.post('/final-results/publish', auditLog('PUBLISH', 'FinalResult'), frCoordCtrl.publishFinalResults);
router.post('/final-results/unpublish', auditLog('UNPUBLISH', 'FinalResult'), frCoordCtrl.unpublishFinalResults);
router.get('/final-results/rankings', frCoordCtrl.getFinalResultRankings);
router.get('/final-results/branches', frCoordCtrl.getFinalResultBranchesForCoord);
router.put('/quizzes/:id', auditLog('UPDATE', 'Quiz'), ctrl.updateQuiz);
router.get('/attendance/summary/export', ctrl.exportAttendanceSummaryCSV);
module.exports = router;