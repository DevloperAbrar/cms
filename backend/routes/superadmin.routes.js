const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { auditLog } = require('../middleware/audit.middleware');
const ctrl = require('../controllers/superadmin.controller');
const { ROLES } = require('../config/constants');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// All routes require SuperAdmin
router.use(authenticate, authorize(ROLES.SUPERADMIN));

// ─── STREAMS ─────────────────────────────────────────────────────────────────
router.get('/streams', ctrl.getStreams);
router.post('/streams', auditLog('CREATE', 'Stream'), ctrl.createStream);
router.put('/streams/:id', auditLog('UPDATE', 'Stream'), ctrl.updateStream);
router.delete('/streams/:id', auditLog('DELETE', 'Stream'), ctrl.deleteStream);

// ─── DEPARTMENTS ─────────────────────────────────────────────────────────────
router.get('/departments', ctrl.getDepartments);
router.post('/departments', auditLog('CREATE', 'Department'), ctrl.createDepartment);
router.put('/departments/:id', auditLog('UPDATE', 'Department'), ctrl.updateDepartment);
router.delete('/departments/:id', auditLog('DELETE', 'Department'), ctrl.deleteDepartment);

// ─── BRANCHES ────────────────────────────────────────────────────────────────
router.get('/branches', ctrl.getBranches);
router.post('/branches', auditLog('CREATE', 'Branch'), ctrl.createBranch);
router.put('/branches/:id', auditLog('UPDATE', 'Branch'), ctrl.updateBranch);
router.delete('/branches/:id', auditLog('DELETE', 'Branch'), ctrl.deleteBranch);

// ─── SUBJECTS ────────────────────────────────────────────────────────────────
router.get('/subjects', ctrl.getSubjects);
router.post('/subjects', auditLog('CREATE', 'Subject'), ctrl.createSubject);
router.put('/subjects/:id', auditLog('UPDATE', 'Subject'), ctrl.updateSubject);
router.delete('/subjects/:id', auditLog('DELETE', 'Subject'), ctrl.deleteSubject);

// ─── USERS (faculty / hod / examcontroller / student) ────────────────────────
router.get('/users', ctrl.getUsers);
router.post('/users', auditLog('CREATE', 'User'), ctrl.createUser);
router.put('/users/:id', auditLog('UPDATE', 'User'), ctrl.updateUser);
router.patch('/users/:id/deactivate', auditLog('DEACTIVATE', 'User'), ctrl.deactivateUser);
router.delete('/users/:id', auditLog('DELETE', 'User'), ctrl.deleteUser);

// ─── STUDENT CSV ─────────────────────────────────────────────────────────────
router.post(
  '/students/csv-upload',
  upload.single('file'),
  auditLog('IMPORT', 'User'),
  ctrl.uploadStudentsCSV
);
router.get('/students/csv-template', ctrl.downloadStudentCSVTemplate);

// ─── EXAM PATTERN ────────────────────────────────────────────────────────────
router.get('/exam-pattern', ctrl.getExamPattern);
router.post('/exam-pattern', auditLog('UPSERT', 'ExamPattern'), ctrl.upsertExamPattern);
router.patch(
  '/exam-pattern/:id/force-unlock',
  auditLog('FORCE_UNLOCK', 'ExamPattern'),
  ctrl.forceUnlockExamPattern
);

// ─── AUDIT LOGS ──────────────────────────────────────────────────────────────
router.get('/audit-logs', ctrl.getAuditLogs);
router.get('/audit-logs/export', ctrl.exportAuditLogsCSV);

// ─── NOTICES ─────────────────────────────────────────────────────────────────
router.get('/notices', ctrl.getNotices);
router.post('/notices', auditLog('CREATE', 'Notice'), ctrl.createNotice);
router.put('/notices/:id', auditLog('UPDATE', 'Notice'), ctrl.updateNotice);
router.delete('/notices/:id', auditLog('DELETE', 'Notice'), ctrl.deleteNotice);

// ─── FINAL RESULTS ───────────────────────────────────────────────────────────
router.get('/final-results/configs', ctrl.getFinalResultConfigs);
router.post('/final-results/configs', auditLog('CREATE', 'FinalResultConfig'), ctrl.createFinalResultConfig);
router.put('/final-results/configs/:id', auditLog('UPDATE', 'FinalResultConfig'), ctrl.updateFinalResultConfig);
router.delete('/final-results/configs/:id', auditLog('DELETE', 'FinalResultConfig'), ctrl.deleteFinalResultConfig);
router.get('/final-results', ctrl.getFinalResultsAdmin);

module.exports = router;