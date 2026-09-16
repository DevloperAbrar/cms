const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { auditLog } = require('../middleware/audit.middleware');
const ctrl = require('../controllers/faculty.controller');
const { ROLES } = require('../config/constants');
const sharedFrCtrl = require('../controllers/shared_finalresult.controller');

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

router.use(authenticate, authorize(ROLES.FACULTY, ROLES.COORDINATOR));

// ─── STUDENTS & SUBJECTS ─────────────────────────────────────────────────────
router.get('/students', ctrl.getMyStudents);
router.get('/subjects', ctrl.getMySubjects);

// ─── SUB-FIELD CONFIG ────────────────────────────────────────────────────────
router.get('/sub-field-config', ctrl.getSubFieldConfig);
router.post('/sub-field-config', auditLog('UPSERT', 'MarksComponent'), ctrl.saveSubFieldConfig);

// ─── MARKS ───────────────────────────────────────────────────────────────────
router.get('/marks/entries', ctrl.getMarksEntries);
router.post('/marks/submit', auditLog('SUBMIT', 'Marks'), ctrl.submitMarks);
router.get('/marks/template', ctrl.downloadMarksTemplate);
router.post('/marks/upload', upload.single('file'), auditLog('IMPORT', 'Marks'), ctrl.uploadMarksCSV);

// ─── QUIZ ─────────────────────────────────────────────────────────────────────
router.get('/quizzes', ctrl.getMyQuizzes);
router.post('/quizzes', auditLog('CREATE', 'Quiz'), ctrl.createQuiz);
router.put('/quizzes/:id', auditLog('UPDATE', 'Quiz'), ctrl.updateQuiz);
router.patch('/quizzes/:id/publish', auditLog('PUBLISH', 'Quiz'), ctrl.publishQuiz);
router.patch('/quizzes/:id/publish-results', auditLog('PUBLISH_RESULTS', 'Quiz'), ctrl.publishResults);
router.delete('/quizzes/:id', auditLog('DELETE', 'Quiz'), ctrl.deleteQuiz);
router.post('/quizzes/image/:questionId', imageUpload.single('image'), ctrl.uploadQuizImage);
router.get('/quizzes/:id/results', ctrl.getQuizResults);

// ─── NOTICES ─────────────────────────────────────────────────────────────────
router.get('/notices', ctrl.getNotices);
router.post('/notices', auditLog('CREATE', 'Notice'), ctrl.postNotice);

// ─── MESSAGES ────────────────────────────────────────────────────────────────
router.get('/messages', ctrl.getMessages);
router.post('/messages', auditLog('CREATE', 'Message'), ctrl.sendMessage);

// ─── ATTENDANCE ──────────────────────────────────────────────────────────────
router.get('/attendance', ctrl.getAttendanceByDate);
router.post('/attendance', auditLog('SUBMIT', 'Attendance'), ctrl.submitAttendance);
router.get('/attendance/summary', ctrl.getAttendanceSummary);

// ─── EXAM PATTERN ────────────────────────────────────────────────────────────
router.get('/exam-pattern', ctrl.getExamPattern);

router.get('/marks/lock-status', ctrl.getMarksLockStatus);

router.get('/final-results/configs', sharedFrCtrl.getPublishedConfigs);
router.get('/final-results/rankings', sharedFrCtrl.getFinalResultRankings);
router.get('/final-results/branches', ctrl.getFinalResultBranches);

router.get('/attendance/summary/export', ctrl.exportAttendanceSummary);

module.exports = router;