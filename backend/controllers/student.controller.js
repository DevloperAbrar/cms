const User = require('../models/User');
const Timetable = require('../models/Timetable');
const Marks = require('../models/Marks');
const Notice = require('../models/Notice');
const Message = require('../models/Message');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const ExamPattern = require('../models/ExamPattern');
const Branch = require('../models/Branch');
const Department = require('../models/Department');
const Stream = require('../models/Stream');
const {
  sendSuccess,
  sendError,
  sendNotFound,
  sendBadRequest,
  sendForbidden,
} = require('../utils/apiResponse');
const { QUIZ_STATUS, RESULT_VISIBILITY, RESULT_PUBLISH_MODE } = require('../config/constants');
const {
  getStudentSubjectAttendance,
  getStudentOverallAttendance,
} = require('../services/attendance.service');
const { calculateSGPA, calculateCGPA } = require('../services/grade.service');
const { scoreAttempt, getActiveQuizzesForStudent } = require('../services/quiz.service');
const { getNoticesForUser, markAsRead } = require('../services/notice.service');
const logger = require('../utils/logger');

// ─── DASHBOARD / PROFILE ─────────────────────────────────────────────────────

exports.getProfile = async (req, res) => {
  try {
    const student = await User.findById(req.user._id)
      .populate('branch_id', 'name code department_id')
      .populate('department_id', 'name code stream_id')
      .select('name email enrollment_number year section semester branch_id department_id phone')
      .lean();

    if (!student) return sendNotFound(res, 'Student not found.');
    return sendSuccess(res, student);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── ATTENDANCE ──────────────────────────────────────────────────────────────

exports.getMyAttendance = async (req, res) => {
  try {
    const [subjectWise, overall] = await Promise.all([
      getStudentSubjectAttendance(req.user._id),
      getStudentOverallAttendance(req.user._id),
    ]);
    return sendSuccess(res, { subject_wise: subjectWise, overall });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── MARKS ───────────────────────────────────────────────────────────────────

exports.getMyMarks = async (req, res) => {
  try {
    const { semester } = req.query;
    const filter = { student_id: req.user._id };
    if (semester) filter.semester = Number(semester);

    const marksList = await Marks.find(filter)
      .populate('subject_id', 'name code')
      .lean();

    // Group by subject
    const bySubject = {};
    for (const m of marksList) {
      const key = m.subject_id?._id?.toString();
      if (!key) continue;
      if (!bySubject[key]) {
        bySubject[key] = {
          subject_name: m.subject_id.name,
          subject_code: m.subject_id.code,
          semester: m.semester,
          components: [],
        };
      }
      bySubject[key].components.push({
        exam_component_id: m.exam_component_id,
        total_marks: m.total_marks,
        max_marks: m.max_marks,
        sub_field_entries: m.sub_field_entries,
        locked: m.locked,
      });
    }

    return sendSuccess(res, Object.values(bySubject));
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.getMySGPA = async (req, res) => {
  try {
    const { year, semester } = req.query;

    // Need stream_id via branch → dept → stream
    const student = await User.findById(req.user._id)
      .populate({ path: 'branch_id', populate: { path: 'department_id', populate: 'stream_id' } })
      .lean();

    const streamId = student?.branch_id?.department_id?.stream_id?._id;
    if (!streamId) return sendNotFound(res, 'Stream not found for student.');

    const { sgpa, components } = await calculateSGPA(
      req.user._id,
      streamId,
      Number(year || req.user.year),
      Number(semester || req.user.semester)
    );

    return sendSuccess(res, { sgpa, components });
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.getMyCGPA = async (req, res) => {
  try {
    const student = await User.findById(req.user._id)
      .populate({ path: 'branch_id', populate: { path: 'department_id', populate: 'stream_id' } })
      .lean();

    const streamId = student?.branch_id?.department_id?.stream_id?._id;
    if (!streamId) return sendNotFound(res, 'Stream not found for student.');

    const { cgpa, semesters } = await calculateCGPA(req.user._id, streamId);
    return sendSuccess(res, { cgpa, semesters });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── TIMETABLE ───────────────────────────────────────────────────────────────

exports.getMyTimetable = async (req, res) => {
  try {
    const { semester, academic_year } = req.query;
    const filter = {
      branch_id: req.user.branch_id,
      year: req.user.year,
      status: 'published',
    };
    if (semester) filter.semester = Number(semester);
    if (academic_year) filter.academic_year = academic_year;

    const timetable = await Timetable.findOne(filter)
      .populate('slots.subject_id', 'name code')
      .populate('slots.faculty_id', 'name')
      .lean();

    return sendSuccess(res, timetable);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── QUIZ ─────────────────────────────────────────────────────────────────────


exports.getActiveQuizzes = async (req, res) => {
  try {
    const now = new Date();
    const branchId = req.user.branch_id;
    const year = req.user.year;
 
    // DEBUG — remove after confirming (check your server console)
    console.log('[Quiz Debug] student branch_id:', branchId, '| year:', year, '| now:', now);
 
    // Build query — if year is null/undefined, skip year filter so student still sees quizzes
    const query = {
      branch_id: branchId,
      status: 'published',
      start_time: { $lte: now },
      end_time: { $gte: now },
    };
    if (year != null) {
      query.year = year;
    }
 
    console.log('[Quiz Debug] query:', JSON.stringify(query));
 
    const quizzes = await Quiz.find(query)
      .select('title subject_id start_time end_time duration_minutes total_marks attempts_allowed')
      .populate('subject_id', 'name code')
      .lean();
 
    console.log('[Quiz Debug] found quizzes:', quizzes.length);
 
    // Attach attempt info
    const enriched = await Promise.all(
      quizzes.map(async (q) => {
        const attempts = await QuizAttempt.find({
          quiz_id: q._id,
          student_id: req.user._id,
        })
          .select('submitted_at score attempt_number')
          .lean();
 
        const submittedCount = attempts.filter((a) => a.submitted_at).length;
        return {
          ...q,
          attempts_made: submittedCount,
          can_attempt: submittedCount < q.attempts_allowed,
          last_attempt: attempts[attempts.length - 1] || null,
        };
      })
    );
 
    return sendSuccess(res, enriched);
  } catch (err) {
    return sendError(res, err.message);
  }
};
exports.startQuiz = async (req, res) => {
  try {
    const { quiz_id } = req.params;
    const now = new Date();

    const quiz = await Quiz.findOne({
      _id: quiz_id,
      branch_id: req.user.branch_id,
      year: req.user.year,
      status: QUIZ_STATUS.PUBLISHED,
      start_time: { $lte: now },
      end_time: { $gte: now },
    });

    if (!quiz) return sendNotFound(res, 'Quiz not found or not active.');

    // Check attempt count
    const attemptCount = await QuizAttempt.countDocuments({
      quiz_id,
      student_id: req.user._id,
      submitted_at: { $ne: null },
    });

    if (attemptCount >= quiz.attempts_allowed) {
      return sendForbidden(res, 'Maximum attempts reached for this quiz.');
    }

    // Check for in-progress attempt
    const inProgress = await QuizAttempt.findOne({
      quiz_id,
      student_id: req.user._id,
      submitted_at: null,
    });

    if (inProgress) {
      // Return existing in-progress attempt
      const quizData = buildQuizForAttempt(quiz);
      return sendSuccess(res, { attempt: inProgress, quiz: quizData });
    }

    // Create new attempt
    const attempt = await QuizAttempt.create({
      quiz_id,
      student_id: req.user._id,
      started_at: now,
      attempt_number: attemptCount + 1,
    });

    const quizData = buildQuizForAttempt(quiz);
    return sendSuccess(res, { attempt, quiz: quizData });
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * Builds quiz payload for student — applies shuffle, strips is_correct.
 */
const buildQuizForAttempt = (quiz) => {
  let questions = quiz.questions.map((q) => ({
    _id: q._id,
    text: q.text,
    image_path: q.image_path,
    type: q.type,
    marks: q.marks,
    negative_marks: q.negative_marks,
    options: q.options.map((o) => ({
      _id: o._id,
      text: o.text,
      image_path: o.image_path,
      // is_correct intentionally omitted
    })),
  }));

  if (quiz.shuffle_questions) {
    questions = questions.sort(() => Math.random() - 0.5);
  }

  if (quiz.shuffle_options) {
    questions = questions.map((q) => ({
      ...q,
      options: q.options.sort(() => Math.random() - 0.5),
    }));
  }

  return {
    _id: quiz._id,
    title: quiz.title,
    duration_minutes: quiz.duration_minutes,
    total_marks: quiz.total_marks,
    negative_marking: quiz.negative_marking,
    end_time: quiz.end_time,
    questions,
  };
};

exports.submitQuiz = async (req, res) => {
  try {
    const { attempt_id } = req.params;
    const { answers, is_auto_submitted = false } = req.body;

    const attempt = await QuizAttempt.findOne({
      _id: attempt_id,
      student_id: req.user._id,
      submitted_at: null,
    });

    if (!attempt) return sendNotFound(res, 'Active attempt not found.');

    const quiz = await Quiz.findById(attempt.quiz_id);
    if (!quiz) return sendNotFound(res, 'Quiz not found.');

    const score = scoreAttempt(quiz, answers || []);

    attempt.answers = answers || [];
    attempt.submitted_at = new Date();
    attempt.score = score;
    attempt.is_auto_submitted = is_auto_submitted;
    await attempt.save();

    // Return result based on visibility setting
    const showResult =
      quiz.result_visibility === RESULT_VISIBILITY.IMMEDIATE || new Date() >= quiz.end_time;

    const responseData = { submitted: true };
    if (showResult) {
      responseData.score = score;
      responseData.total_marks = quiz.total_marks;
    } else {
      responseData.message = 'Result will be available after the quiz ends.';
    }

    return sendSuccess(res, responseData, 'Quiz submitted successfully.');
  } catch (err) {
    return sendError(res, err.message);
  }
};


// ─── REPLACE: getQuizResult — respects result_publish_mode ───────────────────
exports.getQuizResult = async (req, res) => {
  try {
    const { quiz_id } = req.params;
    const { RESULT_PUBLISH_MODE } = require('../config/constants');
 
    const quiz = await Quiz.findById(quiz_id);
    if (!quiz) return sendNotFound(res, 'Quiz not found.');
 
    // Check if faculty has published results
    if (quiz.result_publish_mode === RESULT_PUBLISH_MODE.NONE) {
      return sendForbidden(res, 'Results have not been published yet. Please wait for your faculty.');
    }
 
    const attempt = await QuizAttempt.findOne({
      quiz_id,
      student_id: req.user._id,
      submitted_at: { $ne: null },
    })
      .sort({ attempt_number: -1 })
      .lean();
 
    if (!attempt) return sendNotFound(res, 'No submitted attempt found.');
 
    const mode = quiz.result_publish_mode;
 
    // Base response — always included when result is published
    const response = {
      mode,
      score: attempt.score,
      total_marks: quiz.total_marks,
      submitted_at: attempt.submitted_at,
      is_auto_submitted: attempt.is_auto_submitted,
      quiz_title: quiz.title,
    };
 
    // Add rank if mode includes rank
    if (mode === RESULT_PUBLISH_MODE.SCORES_WITH_RANK || mode === RESULT_PUBLISH_MODE.SCORES_WITH_SOLUTION) {
      // Count how many students scored strictly higher than this student
      const higherCount = await QuizAttempt.countDocuments({
        quiz_id,
        submitted_at: { $ne: null },
        score: { $gt: attempt.score },
      });
      // Total attempts
      const totalAttempts = await QuizAttempt.countDocuments({
        quiz_id,
        submitted_at: { $ne: null },
      });
      response.rank = higherCount + 1;
      response.total_participants = totalAttempts;
    }
 
    // Add full solution if mode includes solution
    if (mode === RESULT_PUBLISH_MODE.SCORES_WITH_SOLUTION) {
      const detailed = quiz.questions.map((q) => {
        const studentAnswer = attempt.answers.find(
          (a) => a.question_id.toString() === q._id.toString()
        );
        const correctOptionIds = q.options
          .filter((o) => o.is_correct)
          .map((o) => o._id.toString());
        const selectedIds = studentAnswer?.selected_options?.map((id) => id.toString()) || [];
 
        const isCorrect =
          correctOptionIds.length === selectedIds.length &&
          correctOptionIds.every((id) => selectedIds.includes(id));
 
        return {
          question_id: q._id,
          question_text: q.text,
          image_path: q.image_path,
          type: q.type,
          marks: q.marks,
          negative_marks: q.negative_marks,
          is_correct: isCorrect,
          selected_options: selectedIds,
          correct_options: correctOptionIds,
          options: q.options.map((o) => ({
            _id: o._id,
            text: o.text,
            image_path: o.image_path,
            is_correct: o.is_correct,
          })),
        };
      });
      response.questions = detailed;
    }
 
    return sendSuccess(res, response);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── NOTICES ─────────────────────────────────────────────────────────────────

exports.getNotices = async (req, res) => {
  try {
    const notices = await getNoticesForUser(req.user);
    return sendSuccess(res, notices);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.markNoticeRead = async (req, res) => {
  try {
    await markAsRead(req.params.id, req.user._id);
    return sendSuccess(res, null, 'Notice marked as read.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── MESSAGES ────────────────────────────────────────────────────────────────

exports.getMessages = async (req, res) => {
  try {
    const messages = await Message.find({ recipient_id: req.user._id })
      .populate('sender_id', 'name role')
      .sort({ created_at: -1 })
      .lean();

    // Mark as delivered
    await Message.updateMany(
      { recipient_id: req.user._id, delivered_at: null },
      { $set: { delivered_at: new Date() } }
    );

    return sendSuccess(res, messages);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.markMessageRead = async (req, res) => {
  try {
    await Message.findOneAndUpdate(
      { _id: req.params.id, recipient_id: req.user._id },
      { $set: { read_at: new Date() } }
    );
    return sendSuccess(res, null, 'Message marked as read.');
  } catch (err) {
    return sendError(res, err.message);
  }
};


// ─── NEW: getPastQuizzes — quizzes that have ended + student attempted ────────
exports.getPastQuizzes = async (req, res) => {
  try {
    const now = new Date();
    const { RESULT_PUBLISH_MODE } = require('../config/constants');
 
    // Find quizzes for this student's branch/year that have ended
    const quizzes = await Quiz.find({
      branch_id: req.user.branch_id,
      year: req.user.year,
      status: 'published',
      end_time: { $lt: now },
    })
      .select('title subject_id total_marks end_time result_publish_mode duration_minutes')
      .populate('subject_id', 'name code')
      .sort({ end_time: -1 })
      .lean();
 
    // Attach attempt info for each quiz
    const enriched = await Promise.all(
      quizzes.map(async (q) => {
        const attempt = await QuizAttempt.findOne({
          quiz_id: q._id,
          student_id: req.user._id,
          submitted_at: { $ne: null },
        })
          .sort({ attempt_number: -1 })
          .select('score submitted_at attempt_number')
          .lean();
 
        return {
          ...q,
          attempted: !!attempt,
          score: attempt?.score ?? null,
          submitted_at: attempt?.submitted_at ?? null,
          result_available: q.result_publish_mode !== RESULT_PUBLISH_MODE.NONE,
        };
      })
    );
 
    return sendSuccess(res, enriched);
  } catch (err) {
    return sendError(res, err.message);
  }
};
 