const prisma = require('../config/prismaClient');
const {
  sendSuccess,
  sendCreated,
  sendError,
  sendNotFound,
  sendBadRequest,
  sendForbidden,
} = require('../utils/apiResponse');
const { ROLES, USER_STATUS, QUIZ_STATUS } = require('../config/constants');
const { upsertMarks } = require('../services/marks.service');
const { checkQuizConflict } = require('../services/quiz.service');
const { parseMarksCSV } = require('../services/csv.service');
const { generateMarksCSVTemplate } = require('../utils/csvTemplateGenerator');
const { saveQuizImage, deleteQuizImage } = require('../services/image.service');
const { getNoticesForUser } = require('../services/notice.service');
const { generateParentToken, revokeParentToken } = require('../services/parentToken.service');
const {
  getStudentSubjectAttendance,
  getStudentOverallAttendance,
} = require('../services/attendance.service');
const logger = require('../utils/logger');

// NOTE: coordinator_branches is not a column on the User table in the new schema.
// Same as coordinator_finalresult.controller.js, this reads it off req.user, which
// your auth middleware/token payload needs to populate (e.g. from a join table or
// JSON column you add later). Until then this mirrors the old embedded-array shape:
// [{ branch_id: '<uuid>', year: 2 }, ...]
const getCoordinatorBranches = (user) => user.coordinatorBranches || user.coordinator_branches || [];

/**
 * Verifies that the coordinator has access to the given branch_id.
 * Called at the top of every branch-scoped handler.
 */
const assertBranchAccess = (user, branchId) => {
  const allowed = getCoordinatorBranches(user).map((b) =>
    (b.branch_id?._id || b.branch_id || b.branchId)?.toString()
  );
  if (!allowed.includes(branchId?.toString())) {
    const err = new Error('You do not have coordinator access to this branch.');
    err.statusCode = 403;
    throw err;
  }
};

// ─── AS-FACULTY CONTEXT ──────────────────────────────────────────────────────

/**
 * GET /api/coordinator/subjects/mine
 * Returns subjects this coordinator teaches (faculty role context).
 */
exports.getMySubjects = async (req, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      where: { assignedFacultyId: req.user.id },
      include: { branch: { select: { id: true, name: true, code: true } } },
    });
    return sendSuccess(res, subjects.map((s) => ({
      ...s, _id: s.id,
      branch_id: s.branch ? { _id: s.branchId, name: s.branch.name, code: s.branch.code } : s.branchId,
    })));
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * GET /api/coordinator/students/subject
 * Returns students for a coordinator's own subject (faculty context).
 */
exports.getSubjectStudents = async (req, res) => {
  try {
    const { subject_id } = req.query;
    const subject = await prisma.subject.findUnique({ where: { id: subject_id } });
    if (!subject) return sendNotFound(res, 'Subject not found.');

    const students = await prisma.user.findMany({
      where: {
        branchId: subject.branchId,
        year: subject.year,
        role: ROLES.STUDENT,
        status: USER_STATUS.ACTIVE,
      },
      select: { id: true, name: true, email: true, enrollmentNumber: true, section: true },
      orderBy: { name: 'asc' },
    });

    return sendSuccess(res, students.map((s) => ({ ...s, _id: s.id, enrollment_number: s.enrollmentNumber })));
  } catch (err) {
    return sendError(res, err.message);
  }
};

// Sub-field config (faculty context)
exports.getSubFieldConfig = async (req, res) => {
  try {
    const { subject_id, branch_id, year, exam_component_id } = req.query;
    const config = await prisma.marksComponent.findFirst({
      where: {
        facultyId: req.user.id,
        subjectId: subject_id,
        branchId: branch_id,
        year: Number(year),
        examComponentId: exam_component_id,
      },
      include: { subFields: { orderBy: { displayOrder: 'asc' } } },
    });
    return sendSuccess(res, config ? {
      ...config, _id: config.id,
      sub_fields: config.subFields.map((sf) => ({ _id: sf.id, name: sf.name, max_marks: sf.maxMarks, display_order: sf.displayOrder })),
    } : null);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.saveSubFieldConfig = async (req, res) => {
  try {
    const { subject_id, branch_id, year, exam_component_id, sub_fields } = req.body;

    const existing = await prisma.marksComponent.findFirst({
      where: {
        facultyId: req.user.id,
        subjectId: subject_id,
        branchId: branch_id,
        year: Number(year),
        examComponentId: exam_component_id,
      },
    });

    if (existing?.structureLocked) {
      return sendForbidden(res, 'Sub-field structure is locked after first submission.');
    }

    let config;
    if (existing) {
      await prisma.marksSubField.deleteMany({ where: { marksComponentId: existing.id } });
      config = await prisma.marksComponent.update({
        where: { id: existing.id },
        data: {
          subFields: {
            create: sub_fields.map((sf, i) => ({ name: sf.name, maxMarks: sf.max_marks, displayOrder: i })),
          },
        },
        include: { subFields: true },
      });
    } else {
      config = await prisma.marksComponent.create({
        data: {
          collegeId: req.user.collegeId,
          facultyId: req.user.id,
          subjectId: subject_id,
          branchId: branch_id,
          academicSessionId: req.body.academic_session_id || req.user.currentSessionId || 'default',
          year: Number(year),
          examComponentId: exam_component_id,
          subFields: {
            create: sub_fields.map((sf, i) => ({ name: sf.name, maxMarks: sf.max_marks, displayOrder: i })),
          },
        },
        include: { subFields: true },
      });
    }

    return sendSuccess(res, { ...config, _id: config.id }, 'Sub-field config saved.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// Internal marks entry (faculty context — own subject)
exports.submitInternalMarks = async (req, res) => {
  try {
    const { subject_id, branch_id, year, semester, exam_component_id, entries } = req.body;

    const results = [];
    for (const entry of entries) {
      const marks = await upsertMarks({
        collegeId: req.user.collegeId,
        studentId: entry.student_id,
        subjectId: subject_id,
        branchId: branch_id,
        academicSessionId: entry.academic_session_id || req.body.academic_session_id,
        year: Number(year),
        semester: Number(semester),
        examComponentId: exam_component_id,
        totalMarks: entry.total_marks,
        maxMarks: entry.max_marks,
        subFieldEntries: entry.sub_field_entries || [],
        submittedBy: req.user.id,
      });
      results.push(marks);
    }

    return sendSuccess(res, results, 'Internal marks submitted.');
  } catch (err) {
    if (err.statusCode === 403) return sendForbidden(res, err.message);
    return sendError(res, err.message);
  }
};

exports.getMarksEntries = async (req, res) => {
  try {
    const { subject_id, branch_id, year, semester, exam_component_id } = req.query;

    const students = await prisma.user.findMany({
      where: { branchId: branch_id, year: Number(year), role: ROLES.STUDENT, status: USER_STATUS.ACTIVE },
      select: { id: true, name: true, enrollmentNumber: true },
      orderBy: { name: 'asc' },
    });

    const marksList = await prisma.marks.findMany({
      where: { subjectId: subject_id, branchId: branch_id, year: Number(year), semester: Number(semester), examComponentId: exam_component_id },
      include: { subFieldEntries: true },
    });

    const marksMap = {};
    for (const m of marksList) marksMap[m.studentId] = m;

    const subFieldConfig = await prisma.marksComponent.findFirst({
      where: { facultyId: req.user.id, subjectId: subject_id, branchId: branch_id, year: Number(year), examComponentId: exam_component_id },
      include: { subFields: { orderBy: { displayOrder: 'asc' } } },
    });

    const result = students.map((s) => ({
      _id: s.id, name: s.name, enrollment_number: s.enrollmentNumber,
      marks: marksMap[s.id] || null,
    }));

    return sendSuccess(res, { students: result, sub_field_config: subFieldConfig });
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.downloadMarksTemplate = async (req, res) => {
  try {
    const { subject_id, branch_id, year, exam_component_id } = req.query;

    const students = await prisma.user.findMany({
      where: { branchId: branch_id, year: Number(year), role: ROLES.STUDENT, status: USER_STATUS.ACTIVE },
      select: { id: true, name: true, enrollmentNumber: true },
    });

    const sfConfig = await prisma.marksComponent.findFirst({
      where: { facultyId: req.user.id, subjectId: subject_id, branchId: branch_id, year: Number(year), examComponentId: exam_component_id },
      include: { subFields: true },
    });

    const buffer = generateMarksCSVTemplate(
      students.map((s) => ({ ...s, enrollment_number: s.enrollmentNumber })),
      sfConfig?.subFields?.map((sf) => ({ ...sf, max_marks: sf.maxMarks })) || []
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="marks_template.csv"');
    return res.send(buffer);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.uploadMarksCSV = async (req, res) => {
  try {
    if (!req.file) return sendBadRequest(res, 'CSV file required.');

    const { subject_id, branch_id, year, semester, exam_component_id } = req.body;
    const rows = await parseMarksCSV(req.file.buffer);

    const students = await prisma.user.findMany({
      where: { branchId: branch_id, year: Number(year), role: ROLES.STUDENT },
      select: { id: true, enrollmentNumber: true },
    });

    const enrollMap = {};
    for (const s of students) enrollMap[s.enrollmentNumber] = s.id;

    const errors = [];
    const results = [];

    for (const row of rows) {
      const studentId = enrollMap[row.enrollment_no];
      if (!studentId) {
        errors.push({ enrollment_no: row.enrollment_no, error: 'Student not found' });
        continue;
      }
      try {
        const marks = await upsertMarks({
          collegeId: req.user.collegeId,
          studentId,
          subjectId: subject_id,
          branchId: branch_id,
          academicSessionId: req.body.academic_session_id,
          year: Number(year),
          semester: Number(semester),
          examComponentId: exam_component_id,
          totalMarks: row.marks_obtained,
          maxMarks: row.max_marks,
          subFieldEntries: row.sub_field_entries || [],
          submittedBy: req.user.id,
        });
        results.push(marks);
      } catch (e) {
        errors.push({ enrollment_no: row.enrollment_no, error: e.message });
      }
    }

    return sendSuccess(res, { imported: results.length, errors }, 'CSV marks processed.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── QUIZ (FACULTY CONTEXT) ──────────────────────────────────────────────────

exports.getMyQuizzes = async (req, res) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      where: { createdById: req.user.id },
      include: { subject: { select: { id: true, name: true, code: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return sendSuccess(res, quizzes.map((q) => ({
      ...q, _id: q.id,
      subject_id: q.subject ? { _id: q.subjectId, name: q.subject.name, code: q.subject.code } : q.subjectId,
    })));
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.createQuiz = async (req, res) => {
  try {
    const {
      title, subject_id, branch_id, year, start_time, end_time, duration_minutes,
      total_marks, negative_marking, negative_value, shuffle_questions, shuffle_options,
      attempts_allowed, result_visibility, academic_session_id,
    } = req.body;

    const quiz = await prisma.quiz.create({
      data: {
        collegeId: req.user.collegeId,
        title,
        subjectId: subject_id,
        branchId: branch_id,
        academicSessionId: academic_session_id,
        year,
        createdById: req.user.id,
        startTime: new Date(start_time),
        endTime: new Date(end_time),
        durationMinutes: duration_minutes,
        totalMarks: total_marks,
        negativeMarking: negative_marking || false,
        negativeValue: negative_value || 0,
        shuffleQuestions: shuffle_questions || false,
        shuffleOptions: shuffle_options || false,
        attemptsAllowed: attempts_allowed || 1,
        resultVisibility: result_visibility || 'immediate',
        status: QUIZ_STATUS.DRAFT,
      },
    });
    return sendCreated(res, { ...quiz, _id: quiz.id }, 'Quiz created as draft.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.updateQuiz = async (req, res) => {
  try {
    const quiz = await prisma.quiz.findFirst({ where: { id: req.params.id, createdById: req.user.id } });
    if (!quiz) return sendNotFound(res, 'Quiz not found.');
    if (quiz.status === QUIZ_STATUS.PUBLISHED) {
      return sendForbidden(res, 'Cannot edit a published quiz.');
    }

    const updated = await prisma.quiz.update({
      where: { id: req.params.id },
      data: {
        title: req.body.title,
        startTime: req.body.start_time ? new Date(req.body.start_time) : undefined,
        endTime: req.body.end_time ? new Date(req.body.end_time) : undefined,
        durationMinutes: req.body.duration_minutes,
        totalMarks: req.body.total_marks,
        negativeMarking: req.body.negative_marking,
        negativeValue: req.body.negative_value,
        shuffleQuestions: req.body.shuffle_questions,
        shuffleOptions: req.body.shuffle_options,
        attemptsAllowed: req.body.attempts_allowed,
        resultVisibility: req.body.result_visibility,
      },
    });
    return sendSuccess(res, { ...updated, _id: updated.id }, 'Quiz updated.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.publishQuiz = async (req, res) => {
  try {
    const quiz = await prisma.quiz.findFirst({ where: { id: req.params.id, createdById: req.user.id } });
    if (!quiz) return sendNotFound(res);

    const conflict = await checkQuizConflict(quiz.branchId, quiz.year, quiz.startTime, quiz.endTime, quiz.id);
    if (conflict) {
      return sendBadRequest(
        res,
        `Quiz conflicts with "${conflict.title}" (${conflict.startTime} – ${conflict.endTime}). Adjust your time window.`
      );
    }

    await prisma.quiz.update({ where: { id: quiz.id }, data: { status: QUIZ_STATUS.PUBLISHED } });
    return sendSuccess(res, null, 'Quiz published.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.deleteQuiz = async (req, res) => {
  try {
    const quiz = await prisma.quiz.findFirst({
      where: { id: req.params.id, createdById: req.user.id },
      include: { questions: { include: { options: true } } },
    });
    if (!quiz) return sendNotFound(res);

    for (const q of quiz.questions) {
      if (q.imagePath) deleteQuizImage(q.imagePath);
      for (const opt of q.options) {
        if (opt.imagePath) deleteQuizImage(opt.imagePath);
      }
    }

    await prisma.quiz.delete({ where: { id: quiz.id } });
    return sendSuccess(res, null, 'Quiz deleted.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.uploadQuizImage = async (req, res) => {
  try {
    if (!req.file) return sendBadRequest(res, 'Image file required.');
    const questionId = req.params.questionId || `q_${Date.now()}`;
    const imagePath = await saveQuizImage(req.file.buffer, questionId);
    return sendSuccess(res, { image_path: imagePath }, 'Image uploaded.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.getQuizResults = async (req, res) => {
  try {
    const quiz = await prisma.quiz.findFirst({ where: { id: req.params.id, createdById: req.user.id } });
    if (!quiz) return sendNotFound(res);

    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId: req.params.id, submittedAt: { not: null } },
      include: { student: { select: { id: true, name: true, enrollmentNumber: true } } },
      orderBy: { score: 'desc' },
    });

    return sendSuccess(res, {
      quiz: { title: quiz.title, total_marks: quiz.totalMarks },
      attempts: attempts.map((a) => ({
        ...a, _id: a.id,
        student_id: a.student ? { _id: a.studentId, name: a.student.name, enrollment_number: a.student.enrollmentNumber } : a.studentId,
        submitted_at: a.submittedAt, is_auto_submitted: a.isAutoSubmitted,
      })),
    });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── COORDINATOR CONTEXT — BRANCH-SCOPED ─────────────────────────────────────

/**
 * GET /api/coordinator/branch/students
 * All students in coordinator's assigned branch(es).
 */
exports.getBranchStudents = async (req, res) => {
  try {
    const { branch_id } = req.query;
    assertBranchAccess(req.user, branch_id);

    const students = await prisma.user.findMany({
      where: { branchId: branch_id, role: ROLES.STUDENT, status: { not: USER_STATUS.DELETED } },
      select: { id: true, name: true, email: true, enrollmentNumber: true, year: true, section: true, semester: true },
      orderBy: { name: 'asc' },
    });

    return sendSuccess(res, students.map((s) => ({ ...s, _id: s.id, enrollment_number: s.enrollmentNumber })));
  } catch (err) {
    if (err.statusCode === 403) return sendForbidden(res, err.message);
    return sendError(res, err.message);
  }
};

/**
 * GET /api/coordinator/branch/attendance
 */
exports.getBranchAttendance = async (req, res) => {
  try {
    const { branch_id, year } = req.query;
    assertBranchAccess(req.user, branch_id);

    const students = await prisma.user.findMany({
      where: { branchId: branch_id, year: Number(year), role: ROLES.STUDENT, status: USER_STATUS.ACTIVE },
      select: { id: true, name: true, enrollmentNumber: true },
    });

    const attendanceData = await Promise.all(
      students.map(async (s) => {
        const [subjectWise, overall] = await Promise.all([
          getStudentSubjectAttendance(s.id),
          getStudentOverallAttendance(s.id),
        ]);
        return {
          student: { _id: s.id, name: s.name, enrollment_number: s.enrollmentNumber },
          subject_wise: subjectWise,
          overall,
        };
      })
    );

    return sendSuccess(res, attendanceData);
  } catch (err) {
    if (err.statusCode === 403) return sendForbidden(res, err.message);
    return sendError(res, err.message);
  }
};

/**
 * POST /api/coordinator/branch/endsem-marks
 * End-sem marks entry for branch students.
 */
exports.submitEndSemMarks = async (req, res) => {
  try {
    const { subject_id, branch_id, year, semester, exam_component_id, entries } = req.body;
    assertBranchAccess(req.user, branch_id);

    // Validate this component is entered_by coordinator or examcontroller
    const component = await prisma.examPatternComponent.findUnique({
      where: { id: exam_component_id },
    });
    if (!component) return sendNotFound(res, 'Component not found.');

    if (!['coordinator', 'examcontroller'].includes(component.enteredBy)) {
      return sendForbidden(res, 'You are not authorized to enter marks for this component.');
    }

    const results = [];
    for (const entry of entries) {
      const marks = await upsertMarks({
        collegeId: req.user.collegeId,
        studentId: entry.student_id,
        subjectId: subject_id,
        branchId: branch_id,
        academicSessionId: req.body.academic_session_id,
        year: Number(year),
        semester: Number(semester),
        examComponentId: exam_component_id,
        totalMarks: entry.total_marks,
        maxMarks: entry.max_marks,
        subFieldEntries: [],
        submittedBy: req.user.id,
      });
      results.push(marks);
    }

    return sendSuccess(res, results, 'End-sem marks submitted.');
  } catch (err) {
    if (err.statusCode === 403) return sendForbidden(res, err.message);
    return sendError(res, err.message);
  }
};

exports.downloadEndSemTemplate = async (req, res) => {
  try {
    const { branch_id, year } = req.query;
    assertBranchAccess(req.user, branch_id);

    const students = await prisma.user.findMany({
      where: { branchId: branch_id, year: Number(year), role: ROLES.STUDENT, status: USER_STATUS.ACTIVE },
      select: { id: true, name: true, enrollmentNumber: true },
    });

    const buffer = generateMarksCSVTemplate(students.map((s) => ({ ...s, enrollment_number: s.enrollmentNumber })), []);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="endsem_template.csv"');
    return res.send(buffer);
  } catch (err) {
    if (err.statusCode === 403) return sendForbidden(res, err.message);
    return sendError(res, err.message);
  }
};

exports.uploadEndSemCSV = async (req, res) => {
  try {
    if (!req.file) return sendBadRequest(res, 'CSV file required.');

    const { subject_id, branch_id, year, semester, exam_component_id } = req.body;
    assertBranchAccess(req.user, branch_id);

    const rows = await parseMarksCSV(req.file.buffer);
    const students = await prisma.user.findMany({
      where: { branchId: branch_id, year: Number(year), role: ROLES.STUDENT },
      select: { id: true, enrollmentNumber: true },
    });

    const enrollMap = {};
    for (const s of students) enrollMap[s.enrollmentNumber] = s.id;

    const errors = [];
    const results = [];

    for (const row of rows) {
      const studentId = enrollMap[row.enrollment_no];
      if (!studentId) {
        errors.push({ enrollment_no: row.enrollment_no, error: 'Student not found' });
        continue;
      }
      try {
        const marks = await upsertMarks({
          collegeId: req.user.collegeId,
          studentId,
          subjectId: subject_id,
          branchId: branch_id,
          academicSessionId: req.body.academic_session_id,
          year: Number(year),
          semester: Number(semester),
          examComponentId: exam_component_id,
          totalMarks: row.marks_obtained,
          maxMarks: row.max_marks,
          subFieldEntries: [],
          submittedBy: req.user.id,
        });
        results.push(marks);
      } catch (e) {
        errors.push({ enrollment_no: row.enrollment_no, error: e.message });
      }
    }

    return sendSuccess(res, { imported: results.length, errors }, 'End-sem CSV processed.');
  } catch (err) {
    if (err.statusCode === 403) return sendForbidden(res, err.message);
    return sendError(res, err.message);
  }
};

// ─── PARENT URL ──────────────────────────────────────────────────────────────

exports.generateParentURL = async (req, res) => {
  try {
    const { student_id, branch_id, expiry } = req.body;
    assertBranchAccess(req.user, branch_id);

    const student = await prisma.user.findFirst({
      where: { id: student_id, branchId: branch_id, role: ROLES.STUDENT },
    });
    if (!student) return sendNotFound(res, 'Student not found in this branch.');

    const token = await generateParentToken(student_id, req.user.id, expiry, req.user.collegeId);
    const url = `${process.env.CLIENT_URL}/parent/${token}`;
    return sendSuccess(res, { url, token }, 'Parent URL generated.');
  } catch (err) {
    if (err.statusCode === 403) return sendForbidden(res, err.message);
    return sendError(res, err.message);
  }
};

exports.revokeParentURL = async (req, res) => {
  try {
    const { student_id, branch_id } = req.body;
    assertBranchAccess(req.user, branch_id);

    await revokeParentToken(student_id);
    return sendSuccess(res, null, 'Parent URL revoked.');
  } catch (err) {
    if (err.statusCode === 403) return sendForbidden(res, err.message);
    return sendError(res, err.message);
  }
};

// ─── NOTICES ─────────────────────────────────────────────────────────────────

exports.postNotice = async (req, res) => {
  try {
    const { title, body, priority, target_type, target_ids, schedule_at, expires_at } = req.body;
    const notice = await prisma.notice.create({
      data: {
        collegeId: req.user.collegeId,
        title,
        body,
        priority: priority || 'normal',
        targetType: target_type,
        targetIds: Array.isArray(target_ids) ? target_ids.map(String) : [String(target_ids)],
        scheduleAt: schedule_at ? new Date(schedule_at) : null,
        expiresAt: expires_at ? new Date(expires_at) : null,
        postedById: req.user.id,
      },
    });
    return sendCreated(res, { ...notice, _id: notice.id }, 'Notice posted.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.getNotices = async (req, res) => {
  try {
    const notices = await getNoticesForUser(req.user);
    return sendSuccess(res, notices);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── MESSAGES ────────────────────────────────────────────────────────────────

exports.sendMessage = async (req, res) => {
  try {
    const { recipient_id, body } = req.body;
    if (!recipient_id || !body) return sendBadRequest(res, 'recipient_id and body are required.');
    const msg = await prisma.message.create({
      data: { collegeId: req.user.collegeId, senderId: req.user.id, recipientId: recipient_id, body },
    });
    return sendCreated(res, { ...msg, _id: msg.id }, 'Message sent.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.getMessages = async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { OR: [{ senderId: req.user.id }, { recipientId: req.user.id }] },
      include: {
        sender: { select: { name: true, role: true } },
        recipient: { select: { name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return sendSuccess(res, messages.map((m) => ({
      ...m, _id: m.id,
      sender_id: { _id: m.senderId, name: m.sender?.name, role: m.sender?.role },
      recipient_id: { _id: m.recipientId, name: m.recipient?.name, role: m.recipient?.role },
    })));
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * GET /api/coordinator/branch/analytics
 */
exports.getBranchAnalytics = async (req, res) => {
  try {
    const { branch_id, year } = req.query;
    assertBranchAccess(req.user, branch_id);

    const totalStudents = await prisma.user.count({
      where: { branchId: branch_id, year: Number(year), role: ROLES.STUDENT, status: USER_STATUS.ACTIVE },
    });

    const rows = await prisma.$queryRaw`
      SELECT
        AVG(avg_ratio) AS class_average,
        SUM(CASE WHEN avg_ratio >= 0.4 THEN 1 ELSE 0 END) AS pass_count,
        SUM(CASE WHEN avg_ratio < 0.4 THEN 1 ELSE 0 END) AS fail_count
      FROM (
        SELECT "studentId", AVG("totalMarks"::float / NULLIF("maxMarks", 0)) AS avg_ratio
        FROM marks
        WHERE "branchId" = ${branch_id} AND year = ${Number(year)}
        GROUP BY "studentId"
      ) sub
    `;

    const r = rows[0] || {};
    return sendSuccess(res, {
      total_students: totalStudents,
      marks_distribution: {
        class_average: r.class_average !== null ? Number(r.class_average) : 0,
        pass_count: Number(r.pass_count || 0),
        fail_count: Number(r.fail_count || 0),
      },
    });
  } catch (err) {
    if (err.statusCode === 403) return sendForbidden(res, err.message);
    return sendError(res, err.message);
  }
};

exports.markAttendanceByDate = async (req, res) => {
  try {
    const { subject_id, date } = req.query;

    const subject = await prisma.subject.findUnique({ where: { id: subject_id } });
    if (!subject) return sendNotFound(res, 'Subject not found.');
    assertBranchAccess(req.user, subject.branchId);

    const students = await prisma.user.findMany({
      where: { branchId: subject.branchId, year: subject.year, role: ROLES.STUDENT, status: USER_STATUS.ACTIVE },
      select: { id: true, name: true, enrollmentNumber: true, section: true },
      orderBy: { name: 'asc' },
    });

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existing = await prisma.attendance.findMany({
      where: { subjectId: subject_id, date: { gte: startOfDay, lte: endOfDay } },
    });

    const attendanceMap = {};
    for (const a of existing) attendanceMap[a.studentId] = a.status;

    const result = students.map((s) => ({
      _id: s.id, name: s.name, enrollment_number: s.enrollmentNumber, section: s.section,
      status: attendanceMap[s.id] || 'present',
    }));

    return sendSuccess(res, result);
  } catch (err) {
    if (err.statusCode === 403) return sendForbidden(res, err.message);
    return sendError(res, err.message);
  }
};

exports.submitAttendanceMark = async (req, res) => {
  try {
    const { subject_id, date, slot, entries } = req.body;

    const subject = await prisma.subject.findUnique({ where: { id: subject_id } });
    if (!subject) return sendNotFound(res, 'Subject not found.');
    assertBranchAccess(req.user, subject.branchId);

    const attendanceDate = new Date(date);

    await prisma.$transaction(
      entries.map((e) =>
        prisma.attendance.upsert({
          where: { studentId_subjectId_date: { studentId: e.student_id, subjectId: subject_id, date: attendanceDate } },
          update: { status: e.status, slot: slot || null, markedById: req.user.id },
          create: {
            collegeId: req.user.collegeId,
            studentId: e.student_id,
            subjectId: subject_id,
            branchId: subject.branchId,
            year: subject.year,
            academicSessionId: req.body.academic_session_id || 'default',
            date: attendanceDate,
            slot: slot || null,
            status: e.status,
            markedById: req.user.id,
          },
        })
      )
    );

    return sendSuccess(res, null, 'Attendance saved.');
  } catch (err) {
    if (err.statusCode === 403) return sendForbidden(res, err.message);
    return sendError(res, err.message);
  }
};

exports.getAttendanceSummaryCoord = async (req, res) => {
  try {
    const { subject_id } = req.query;

    const subject = await prisma.subject.findUnique({ where: { id: subject_id } });
    if (!subject) return sendNotFound(res, 'Subject not found.');
    assertBranchAccess(req.user, subject.branchId);

    const students = await prisma.user.findMany({
      where: { branchId: subject.branchId, year: subject.year, role: ROLES.STUDENT, status: USER_STATUS.ACTIVE },
      select: { id: true, name: true, enrollmentNumber: true },
      orderBy: { name: 'asc' },
    });

    const records = await prisma.attendance.findMany({ where: { subjectId: subject_id } });

    const summary = {};
    for (const s of students) {
      summary[s.id] = { _id: s.id, name: s.name, enrollment_number: s.enrollmentNumber, total: 0, present: 0, absent: 0, late: 0 };
    }
    for (const r of records) {
      if (summary[r.studentId]) {
        summary[r.studentId].total++;
        summary[r.studentId][r.status]++;
      }
    }

    const result = Object.values(summary).map((s) => ({
      ...s,
      percentage: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
    }));

    return sendSuccess(res, result);
  } catch (err) {
    if (err.statusCode === 403) return sendForbidden(res, err.message);
    return sendError(res, err.message);
  }
};

exports.getBranchSubjects = async (req, res) => {
  try {
    const branchIds = getCoordinatorBranches(req.user).map(
      (b) => b.branch_id?._id || b.branch_id || b.branchId
    );
    const subjects = await prisma.subject.findMany({
      where: { branchId: { in: branchIds } },
      include: { branch: { select: { id: true, name: true, code: true } } },
      orderBy: { name: 'asc' },
    });
    return sendSuccess(res, subjects.map((s) => ({
      ...s, _id: s.id,
      branch_id: s.branch ? { _id: s.branchId, name: s.branch.name, code: s.branch.code } : s.branchId,
    })));
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.exportAttendanceSummaryCSV = async (req, res) => {
  try {
    const { subject_id } = req.query;

    const subject = await prisma.subject.findUnique({ where: { id: subject_id } });
    if (!subject) return sendNotFound(res, 'Subject not found.');
    assertBranchAccess(req.user, subject.branchId);

    const students = await prisma.user.findMany({
      where: { branchId: subject.branchId, year: subject.year, role: ROLES.STUDENT, status: USER_STATUS.ACTIVE },
      select: { id: true, name: true, enrollmentNumber: true },
      orderBy: { name: 'asc' },
    });

    const records = await prisma.attendance.findMany({ where: { subjectId: subject_id } });

    const summary = {};
    for (const s of students) {
      summary[s.id] = { name: s.name, enrollment_number: s.enrollmentNumber, total: 0, present: 0, absent: 0, late: 0 };
    }
    for (const r of records) {
      if (summary[r.studentId]) {
        summary[r.studentId].total++;
        summary[r.studentId][r.status]++;
      }
    }

    const rows = Object.values(summary).map((s) => ({
      ...s,
      percentage: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
    }));

    const header = 'Name,Enrollment,Total,Present,Absent,Late,Percentage\n';
    const csv = header + rows.map((r) =>
      `${r.name},${r.enrollment_number},${r.total},${r.present},${r.absent},${r.late},${r.percentage}%`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance_summary.csv"');
    return res.send(csv);
  } catch (err) {
    if (err.statusCode === 403) return sendForbidden(res, err.message);
    return sendError(res, err.message);
  }
};