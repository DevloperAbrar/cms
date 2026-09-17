const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { auditLog } = require('../middleware/audit.middleware');
const ctrl = require('../controllers/examcontroller.controller');
const { ROLES } = require('../config/constants');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticate, authorize(ROLES.EXAM_CONTROLLER));

// ─── LOOKUP ──────────────────────────────────────────────────────────────────
router.get('/subjects', ctrl.getAllSubjects);
router.get('/branches', ctrl.getAllBranches);
router.get('/students', ctrl.getStudents);
router.get('/exam-pattern', ctrl.getExamPattern);

// ─── MARKS ───────────────────────────────────────────────────────────────────
router.get('/marks', ctrl.getMarksEntries);
router.post('/marks', auditLog('SUBMIT', 'Marks'), ctrl.submitEndSemMarks);
router.get('/marks/template', ctrl.downloadMarksTemplate);
router.post('/marks/upload', upload.single('file'), auditLog('IMPORT', 'Marks'), ctrl.uploadMarksCSV);

router.get('/final-results/configs', ctrl.getFinalResultConfigs);
router.get('/final-results/streams', ctrl.getFinalResultStreams);
router.get('/final-results/departments', ctrl.getFinalResultDepartments);
router.get('/final-results/branches', ctrl.getFinalResultBranches);
router.get('/final-results/students', ctrl.getFinalResultStudents);
router.post('/final-results/submit', auditLog('SUBMIT', 'FinalResult'), ctrl.submitFinalResults);
router.post('/final-results/publish', auditLog('PUBLISH', 'FinalResult'), ctrl.publishFinalResults);
router.post('/final-results/unpublish', auditLog('UNPUBLISH', 'FinalResult'), ctrl.unpublishFinalResults);

module.exports = router;