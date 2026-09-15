const prisma = require('../config/prismaClient');
const { sendSuccess, sendError, sendNotFound, sendBadRequest, sendForbidden } = require('../utils/apiResponse');
const { QUIZ_STATUS, RESULT_VISIBILITY, RESULT_PUBLISH_MODE } = require('../config/constants');
const { getStudentSubjectAttendance, getStudentOverallAttendance } = require('../services/attendance.service');
const { calculateSGPA, calculateCGPA } = require('../services/grade.service');
const { scoreAttempt } = require('../services/quiz.service');
const { getNoticesForUser, markAsRead } = require('../services/notice.service');
const logger = require('../utils/logger');

exports.getProfile = async (req, res) => {
  try {
    const student = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        branch: { include: { department: { include: { stream: true } } } },
      },
    });
    if (!student) return sendNotFound(res, 'Student not found.');

    return sendSuccess(res, {
      _id: student.id, name: student.name, email: student.email,
      enrollment_number: student.enrollmentNumber, year: student.year,
      section: student.section, semester: student.semester, phone: student.phone,
      branch_id: student.branch ? { _id: student.branchId, name: student.branch.name, code: student.branch.code, department_id: student.branch.departmentId } : student.branchId,
      department_id: student.branch?.department ? { _id: student.branch.departmentId, name: student.branch.department.name, code: student.branch.department.code, stream_id: student.branch.department.streamId } : student.departmentId,
    });
  } catch (err) { return sendError(res, err.message); }
};

exports.getMyAttendance = async (req, res) => {
  try {
    const [subjectWise, overall] = await Promise.all([
      getStudentSubjectAttendance(req.user.id),
      getStudentOverallAttendance(req.user.id),
    ]);
    return sendSuccess(res, { subject_wise: subjectWise, overall });
  } catch (err) { return sendError(res, err.message); }
};

exports.getMyMarks = async (req, res) => {
  try {
    const { semester } = req.query;
    const where = { studentId: req.user.id };
    if (semester) where.semester = Number(semester);

    const marksList = await prisma.marks.findMany({
      where,
      include: { subject: { select: { id: true, name: true, code: true } } },
    });

    const bySubject = {};
    for (const m of marksList) {
      const key = m.subjectId;
      if (!key) continue;
      if (!bySubject[key]) {
        bySubject[key] = { subject_name: m.subject?.name, subject_code: m.subject?.code, semester: m.semester, components: [] };
      }
      bySubject[key].components.push({
        exam_component_id: m.examComponentId, total_marks: m.totalMarks,
        max_marks: m.maxMarks, locked: m.locked,
      });
    }

    return sendSuccess(res, Object.values(bySubject));
  } catch (err) { return sendError(res, err.message); }
};

exports.getMySGPA = async (req, res) => {
  try {
    const { year, semester } = req.query;

    const student = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { branch: { include: { department: { include: { stream: true } } } } },
    });

    const streamId = student?.branch?.department?.streamId;
    if (!streamId) return sendNotFound(res, 'Stream not found for student.');

    const { sgpa, components } = await calculateSGPA(req.user.id, streamId, Number(year || req.user.year), Number(semester || req.user.semester));
    return sendSuccess(res, { sgpa, components });
  } catch (err) { return sendError(res, err.message); }
};

exports.getMyCGPA = async (req, res) => {
  try {
    const student = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { branch: { include: { department: { include: { stream: true } } } } },
    });

    const streamId = student?.branch?.department?.streamId;
    if (!streamId) return sendNotFound(res, 'Stream not found for student.');

    const { cgpa, semesters } = await calculateCGPA(req.user.id, streamId);
    return sendSuccess(res, { cgpa, semesters });
  } catch (err) { return sendError(res, err.message); }
};

exports.getMyTimetable = async (req, res) => {
  try {
    const { semester, academic_session_id } = req.query;
    const where = { branchId: req.user.branchId, year: req.user.year, status: 'published' };
    if (semester) where.semester = Number(semester);
    if (academic_session_id) where.academicSessionId = academic_session_id;

    const timetable = await prisma.timetable.findFirst({
      where,
      include: {
        slots: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
            faculty: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!timetable) return sendSuccess(res, null);

    return sendSuccess(res, {
      ...timetable, _id: timetable.id,
      slots: timetable.slots.map((s) => ({
        ...s, _id: s.id,
        subject_id: s.subject ? { _id: s.subjectId, name: s.subject.name, code: s.subject.code } : s.subjectId,
        faculty_id: s.faculty ? { _id: s.facultyId, name: s.faculty.name } : s.facultyId,
        time_slot: s.timeSlot,
      })),
    });
  } catch (err) { return sendError(res, err.message); }
};

exports.getActiveQuizzes = async (req, res) => {
  try {
    const now = new Date();
    const where = {
      branchId: req.user.branchId,
      status: 'published',
      startTime: { lte: now },
      endTime: { gte: now },
    };
    if (req.user.year != null) where.year = req.user.year;

    const quizzes = await prisma.quiz.findMany({
      where,
      select: { id: true, title: true, subjectId: true, startTime: true, endTime: true, durationMinutes: true, totalMarks: true, attemptsAllowed: true, subject: { select: { name: true, code: true } } },
    });

    const enriched = await Promise.all(
      quizzes.map(async (q) => {
        const attempts = await prisma.quizAttempt.findMany({
          where: { quizId: q.id, studentId: req.user.id },
          select: { id: true, submittedAt: true, score: true, attemptNumber: true },
        });
        const submittedCount = attempts.filter((a) => a.submittedAt).length;
        return {
          ...q, _id: q.id,
          subject_id: q.subject ? { _id: q.subjectId, name: q.subject.name, code: q.subject.code } : q.subjectId,
          start_time: q.startTime, end_time: q.endTime, duration_minutes: q.durationMinutes,
          total_marks: q.totalMarks, attempts_allowed: q.attemptsAllowed,
          attempts_made: submittedCount, can_attempt: submittedCount < q.attemptsAllowed,
          last_attempt: attempts[attempts.length - 1] || null,
        };
      })
    );

    return sendSuccess(res, enriched);
  } catch (err) { return sendError(res, err.message); }
};

const buildQuizForAttempt = (quiz) => {
  let questions = quiz.questions.map((q) => ({
    _id: q.id, id: q.id, text: q.text, imagePath: q.imagePath, type: q.type, marks: q.marks, negative_marks: q.negativeMarks,
    options: q.options.map((o) => ({ _id: o.id, id: o.id, text: o.text, imagePath: o.imagePath })),
  }));

  if (quiz.shuffleQuestions) questions = questions.sort(() => Math.random() - 0.5);
  if (quiz.shuffleOptions) questions = questions.map((q) => ({ ...q, options: q.options.sort(() => Math.random() - 0.5) }));

  return {
    _id: quiz.id, title: quiz.title, duration_minutes: quiz.durationMinutes,
    total_marks: quiz.totalMarks, negative_marking: quiz.negativeMarking, end_time: quiz.endTime, questions,
  };
};

exports.startQuiz = async (req, res) => {
  try {
    const { quiz_id } = req.params;
    const now = new Date();

    const quiz = await prisma.quiz.findFirst({
      where: {
        id: quiz_id, branchId: req.user.branchId, year: req.user.year,
        status: 'published', startTime: { lte: now }, endTime: { gte: now },
      },
      include: { questions: { include: { options: true } } },
    });

    if (!quiz) return sendNotFound(res, 'Quiz not found or not active.');

    const attemptCount = await prisma.quizAttempt.count({
      where: { quizId: quiz_id, studentId: req.user.id, submittedAt: { not: null } },
    });

    if (attemptCount >= quiz.attemptsAllowed) return sendForbidden(res, 'Maximum attempts reached for this quiz.');

    const inProgress = await prisma.quizAttempt.findFirst({
      where: { quizId: quiz_id, studentId: req.user.id, submittedAt: null },
    });

    if (inProgress) {
      return sendSuccess(res, { attempt: { ...inProgress, _id: inProgress.id }, quiz: buildQuizForAttempt(quiz) });
    }

    const attempt = await prisma.quizAttempt.create({
      data: {
        collegeId: req.user.collegeId, quizId: quiz_id, studentId: req.user.id,
        startedAt: now, attemptNumber: attemptCount + 1,
      },
    });

    return sendSuccess(res, { attempt: { ...attempt, _id: attempt.id }, quiz: buildQuizForAttempt(quiz) });
  } catch (err) { return sendError(res, err.message); }
};

exports.submitQuiz = async (req, res) => {
  try {
    const { attempt_id } = req.params;
    const { answers, is_auto_submitted = false } = req.body;

    const attempt = await prisma.quizAttempt.findFirst({
      where: { id: attempt_id, studentId: req.user.id, submittedAt: null },
    });
    if (!attempt) return sendNotFound(res, 'Active attempt not found.');

    const quiz = await prisma.quiz.findUnique({
      where: { id: attempt.quizId },
      include: { questions: { include: { options: true } } },
    });
    if (!quiz) return sendNotFound(res, 'Quiz not found.');

    const score = scoreAttempt(quiz, answers || []);

    // Save answers
    const updatedAttempt = await prisma.quizAttempt.update({
      where: { id: attempt_id },
      data: {
        submittedAt: new Date(), score, isAutoSubmitted: is_auto_submitted,
        answers: {
          create: (answers || []).map((a) => ({
            questionId: a.question_id,
            selectedOptionIds: Array.isArray(a.selected_options) ? a.selected_options : [],
          })),
        },
      },
    });

    const showResult = quiz.resultVisibility === 'immediate' || new Date() >= quiz.endTime;
    const responseData = { submitted: true };
    if (showResult) { responseData.score = score; responseData.total_marks = quiz.totalMarks; }
    else { responseData.message = 'Result will be available after the quiz ends.'; }

    return sendSuccess(res, responseData, 'Quiz submitted successfully.');
  } catch (err) { return sendError(res, err.message); }
};

exports.getQuizResult = async (req, res) => {
  try {
    const { quiz_id } = req.params;
    const quiz = await prisma.quiz.findUnique({ where: { id: quiz_id } });
    if (!quiz) return sendNotFound(res, 'Quiz not found.');

    if (quiz.resultPublishMode === 'none') {
      return sendForbidden(res, 'Results have not been published yet. Please wait for your faculty.');
    }

    const attempt = await prisma.quizAttempt.findFirst({
      where: { quizId: quiz_id, studentId: req.user.id, submittedAt: { not: null } },
      include: { answers: true },
      orderBy: { attemptNumber: 'desc' },
    });
    if (!attempt) return sendNotFound(res, 'No submitted attempt found.');

    const mode = quiz.resultPublishMode;
    const response = {
      mode, score: attempt.score, total_marks: quiz.totalMarks,
      submitted_at: attempt.submittedAt, is_auto_submitted: attempt.isAutoSubmitted, quiz_title: quiz.title,
    };

    if (mode === 'scores_with_rank' || mode === 'scores_with_solution') {
      const [higherCount, totalAttempts] = await Promise.all([
        prisma.quizAttempt.count({ where: { quizId: quiz_id, submittedAt: { not: null }, score: { gt: attempt.score ?? 0 } } }),
        prisma.quizAttempt.count({ where: { quizId: quiz_id, submittedAt: { not: null } } }),
      ]);
      response.rank = higherCount + 1;
      response.total_participants = totalAttempts;
    }

    if (mode === 'scores_with_solution') {
      const quizWithQs = await prisma.quiz.findUnique({
        where: { id: quiz_id },
        include: { questions: { include: { options: true } } },
      });

      const answerMap = {};
      for (const a of attempt.answers) answerMap[a.questionId] = a.selectedOptionIds;

      response.questions = quizWithQs.questions.map((q) => {
        const correctOptionIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
        const selectedIds = answerMap[q.id] || [];
        const isCorrect = correctOptionIds.length === selectedIds.length && correctOptionIds.every((id) => selectedIds.includes(id));
        return {
          question_id: q.id, question_text: q.text, image_path: q.imagePath, type: q.type, marks: q.marks, negative_marks: q.negativeMarks,
          is_correct: isCorrect, selected_options: selectedIds, correct_options: correctOptionIds,
          options: q.options.map((o) => ({ _id: o.id, text: o.text, image_path: o.imagePath, is_correct: o.isCorrect })),
        };
      });
    }

    return sendSuccess(res, response);
  } catch (err) { return sendError(res, err.message); }
};

exports.getNotices = async (req, res) => {
  try {
    const notices = await getNoticesForUser(req.user);
    return sendSuccess(res, notices);
  } catch (err) { return sendError(res, err.message); }
};

exports.markNoticeRead = async (req, res) => {
  try {
    await markAsRead(req.params.id, req.user.id);
    return sendSuccess(res, null, 'Notice marked as read.');
  } catch (err) { return sendError(res, err.message); }
};

exports.getMessages = async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { recipientId: req.user.id },
      include: { sender: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });

    await prisma.message.updateMany({
      where: { recipientId: req.user.id, deliveredAt: null },
      data: { deliveredAt: new Date() },
    });

    return sendSuccess(res, messages.map((m) => ({
      ...m, _id: m.id,
      sender_id: m.sender ? { _id: m.senderId, name: m.sender.name, role: m.sender.role } : m.senderId,
    })));
  } catch (err) { return sendError(res, err.message); }
};

exports.markMessageRead = async (req, res) => {
  try {
    await prisma.message.updateMany({
      where: { id: req.params.id, recipientId: req.user.id },
      data: { readAt: new Date() },
    });
    return sendSuccess(res, null, 'Message marked as read.');
  } catch (err) { return sendError(res, err.message); }
};

exports.getPastQuizzes = async (req, res) => {
  try {
    const now = new Date();
    const quizzes = await prisma.quiz.findMany({
      where: { branchId: req.user.branchId, year: req.user.year, status: 'published', endTime: { lt: now } },
      select: { id: true, title: true, subjectId: true, totalMarks: true, endTime: true, resultPublishMode: true, durationMinutes: true, subject: { select: { name: true, code: true } } },
      orderBy: { endTime: 'desc' },
    });

    const enriched = await Promise.all(
      quizzes.map(async (q) => {
        const attempt = await prisma.quizAttempt.findFirst({
          where: { quizId: q.id, studentId: req.user.id, submittedAt: { not: null } },
          select: { score: true, submittedAt: true, attemptNumber: true },
          orderBy: { attemptNumber: 'desc' },
        });
        return {
          ...q, _id: q.id, total_marks: q.totalMarks, end_time: q.endTime,
          subject_id: q.subject ? { _id: q.subjectId, name: q.subject.name, code: q.subject.code } : q.subjectId,
          attempted: !!attempt, score: attempt?.score ?? null, submitted_at: attempt?.submittedAt ?? null,
          result_available: q.resultPublishMode !== 'none',
        };
      })
    );

    return sendSuccess(res, enriched);
  } catch (err) { return sendError(res, err.message); }
};