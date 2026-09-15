const express = require('express');
const router = express.Router();
const platformAuth = require('../middleware/platformAuth.middleware');
const ctrl = require('../controllers/platform.controller');

router.post('/auth/login', ctrl.login);

router.use(platformAuth);

router.get('/colleges', ctrl.listColleges);
router.post('/colleges', ctrl.createCollege);
router.patch('/colleges/:collegeId', ctrl.updateCollege);
router.patch('/colleges/:collegeId/renew', ctrl.renewSubscription);
router.patch('/colleges/:collegeId/suspend', ctrl.suspendCollege);
router.delete('/colleges/:collegeId', ctrl.softDeleteCollege);
router.patch('/colleges/:collegeId/reactivate', ctrl.reactivateCollege);
router.post('/colleges/:collegeId/purge', ctrl.purgeCollege);
router.patch('/colleges/:collegeId/regenerate-password', ctrl.regenerateSuperAdminPassword);

module.exports = router;