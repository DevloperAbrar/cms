const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const ctrl = require('../controllers/student.controller');
const { ROLES } = require('../config/constants');
const sharedFrCtrl = require('../controllers/shared_finalresult.controller');

const router = express.Router();
router.use(authenticate, authorize(ROLES.STUDENT));

// Profile
router.get('/profile', ctrl.getProfile);

// Attendance
router.get('/attendance', ctrl.getMyAttendance);

// Marks
router.get('/marks', ctrl.getMyMarks);
router.get('/marks/sgpa', ctrl.getMySGPA);
router.get('/marks/cgpa', ctrl.getMyCGPA);

// Timetable
router.get('/timetable', ctrl.getMyTimetable);

// Quiz
router.get('/quizzes/active', ctrl.getActiveQuizzes);
router.get('/quizzes/past', ctrl.getPastQuizzes);
router.post('/quizzes/:quiz_id/start', ctrl.startQuiz);
router.post('/quizzes/attempts/:attempt_id/submit', ctrl.submitQuiz);
router.get('/quizzes/:quiz_id/result', ctrl.getQuizResult);

// Notices
router.get('/notices', ctrl.getNotices);
router.patch('/notices/:id/read', ctrl.markNoticeRead);

// Messages
router.get('/messages', ctrl.getMessages);
router.patch('/messages/:id/read', ctrl.markMessageRead);

router.get('/final-results/configs', sharedFrCtrl.getPublishedConfigs);
router.get('/final-results/mine', sharedFrCtrl.getStudentOwnResult);
router.get('/final-results/rankings', sharedFrCtrl.getFinalResultRankings);

module.exports = router;