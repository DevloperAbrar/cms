/**
 * Application-wide constants.
 * Import from here instead of using magic strings.
 */

const ROLES = Object.freeze({
  SUPERADMIN: 'superadmin',
  EXAM_CONTROLLER: 'examcontroller',
  HOD: 'hod',
  COORDINATOR: 'coordinator',
  FACULTY: 'faculty',
  STUDENT: 'student',
});

const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DELETED: 'deleted',
});

const TIMETABLE_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
});

const QUIZ_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
});

const RESULT_VISIBILITY = Object.freeze({
  IMMEDIATE: 'immediate',
  AFTER_END: 'after_end',
});

const RESULT_PUBLISH_MODE = Object.freeze({
  NONE: 'none',                          // not published yet — student sees nothing
  SCORES_ONLY: 'scores_only',            // student sees score only
  SCORES_WITH_RANK: 'scores_with_rank',  // student sees score + their rank
  SCORES_WITH_SOLUTION: 'scores_with_solution', // student sees score + full solution
});

const QUESTION_TYPE = Object.freeze({
  SINGLE: 'single',
  MULTIPLE: 'multiple',
});

const NOTICE_PRIORITY = Object.freeze({
  NORMAL: 'normal',
  IMPORTANT: 'important',
  URGENT: 'urgent',
});

const NOTICE_TARGET_TYPE = Object.freeze({
  ALL: 'all',
  STREAM: 'stream',
  DEPARTMENT: 'department',
  BRANCH: 'branch',
  YEAR: 'year',
  INDIVIDUAL: 'individual',
});

const ATTENDANCE_STATUS = Object.freeze({
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
});

const SUBJECT_TYPE = Object.freeze({
  THEORY: 'theory',
  PRACTICAL: 'practical',
});

const ENTERED_BY = Object.freeze({
  FACULTY: 'faculty',
  COORDINATOR: 'coordinator',
  EXAM_CONTROLLER: 'examcontroller',
});

const PARENT_TOKEN_EXPIRY_OPTIONS = Object.freeze({
  THIRTY_DAYS: '30d',
  NINETY_DAYS: '90d',
  PERMANENT: 'permanent',
});

module.exports = {
  ROLES,
  USER_STATUS,
  TIMETABLE_STATUS,
  QUIZ_STATUS,
  RESULT_VISIBILITY,
  RESULT_PUBLISH_MODE,
  QUESTION_TYPE,
  NOTICE_PRIORITY,
  NOTICE_TARGET_TYPE,
  ATTENDANCE_STATUS,
  SUBJECT_TYPE,
  ENTERED_BY,
  PARENT_TOKEN_EXPIRY_OPTIONS,
};