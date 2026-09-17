const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { auditLog } = require('../middleware/audit.middleware');
const ctrl = require('../controllers/examcontroller.controller');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.use(authenticate, authorize(ROLES.EXAM_CONTROLLER));

// ─── LOOKUP (dashboard stats only) ───────────────────────────────────────────
router.get('/subjects', ctrl.getAllSubjects);
router.get('/branches', ctrl.getAllBranches);

// ─── FINAL RESULTS (exam controller's actual job: publish CGPA/percentage) ──
router.get('/final-results/configs', ctrl.getFinalResultConfigs);
router.get('/final-results/departments', ctrl.getFinalResultDepartments);
router.get('/final-results/branches', ctrl.getFinalResultBranches);
router.get('/final-results/students', ctrl.getFinalResultStudents);
router.post('/final-results/submit', auditLog('SUBMIT', 'FinalResult'), ctrl.submitFinalResults);
router.post('/final-results/publish', auditLog('PUBLISH', 'FinalResult'), ctrl.publishFinalResults);
router.post('/final-results/unpublish', auditLog('UNPUBLISH', 'FinalResult'), ctrl.unpublishFinalResults);

module.exports = router;