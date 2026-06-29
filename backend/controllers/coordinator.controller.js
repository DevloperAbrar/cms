const User = require('../models/User');
const Subject = require('../models/Subject');
const Marks = require('../models/Marks');
const MarksComponent = require('../models/MarksComponent');
const ExamPattern = require('../models/ExamPattern');
const Attendance = require('../models/Attendance');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Notice = require('../models/Notice');
const Message = require('../models/Message');
const Timetable = require('../models/Timetable');
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

/**
 * Verifies that the coordinator has access to the given branch_id.
 * Called at the top of every branch-scoped handler.
 */
const assertBranchAccess = (user, branchId) => {
  console.log('coordinator_branches:', JSON.stringify(user.coordinator_branches));
  console.log('requesting branch_id:', branchId);
  const allowed = (user.coordinator_branches || []).map((b) =>
    (b.branch_id?._id || b.branch_id)?.toString()
  );
  console.log('allowed:', allowed);
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
    const subjects = await Subject.find({ assigned_faculty: req.user._id })
      .populate('branch_id', 'name code')
      .lean();
    return sendSuccess(res, subjects);
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
    const subject = await Subject.findById(subject_id);
    if (!subject) return sendNotFound(res, 'Subject not found.');

    const students = await User.find({
      branch_id: subject.branch_id,
      year: subject.year,
      role: ROLES.STUDENT,
      status: USER_STATUS.ACTIVE,
    })
      .select('name email enrollment_number section')
      .sort({ name: 1 })
      .lean();

    return sendSuccess(res, students);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// Sub-field config (faculty context)
exports.getSubFieldConfig = async (req, res) => {
  try {
    const { subject_id, branch_id, year, exam_component_id } = req.query;
    const config = await MarksComponent.findOne({
      faculty_id: req.user._id,
      subject_id,
      branch_id,
      year: Number(year),
      exam_component_id,
    });
    return sendSuccess(res, config);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.saveSubFieldConfig = async (req, res) => {
  try {
    const { subject_id, branch_id, year, exam_component_id, sub_fields } = req.body;

    const existing = await MarksComponent.findOne({
      faculty_id: req.user._id,
      subject_id,
      branch_id,
      year: Number(year),
      exam_component_id,
    });

    if (existing?.structure_locked) {
      return sendForbidden(res, 'Sub-field structure is locked after first submission.');
    }

    const config = await MarksComponent.findOneAndUpdate(
      {
        faculty_id: req.user._id,
        subject_id,
        branch_id,
        year: Number(year),
        exam_component_id,
      },
      { $set: { sub_fields } },
      { upsert: true, new: true }
    );

    return sendSuccess(res, config, 'Sub-field config saved.');
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
        studentId: entry.student_id,
        subjectId: subject_id,
        branchId: branch_id,
        year: Number(year),
        semester: Number(semester),
        examComponentId: exam_component_id,
        totalMarks: entry.total_marks,
        maxMarks: entry.max_marks,
        subFieldEntries: entry.sub_field_entries || [],
        submittedBy: req.user._id,
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

    const students = await User.find({
      branch_id,
      year: Number(year),
      role: ROLES.STUDENT,
      status: USER_STATUS.ACTIVE,
    })
      .select('name enrollment_number')
      .sort({ name: 1 })
      .lean();

    const marksList = await Marks.find({
      subject_id,
      branch_id,
      year: Number(year),
      semester: Number(semester),
      exam_component_id,
    }).lean();

    const marksMap = {};
    for (const m of marksList) marksMap[m.student_id.toString()] = m;

    const subFieldConfig = await MarksComponent.findOne({
      faculty_id: req.user._id,
      subject_id,
      branch_id,
      year: Number(year),
      exam_component_id,
    });

    const result = students.map((s) => ({
      ...s,
      marks: marksMap[s._id.toString()] || null,
    }));

    return sendSuccess(res, { students: result, sub_field_config: subFieldConfig });
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.downloadMarksTemplate = async (req, res) => {
  try {
    const { subject_id, branch_id, year, exam_component_id } = req.query;

    const students = await User.find({
      branch_id,
      year: Number(year),
      role: ROLES.STUDENT,
      status: USER_STATUS.ACTIVE,
    })
      .select('name enrollment_number')
      .lean();

    const sfConfig = await MarksComponent.findOne({
      faculty_id: req.user._id,
      subject_id,
      branch_id,
      year: Number(year),
      exam_component_id,
    });

    const buffer = generateMarksCSVTemplate(students, sfConfig?.sub_fields || []);
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

    const students = await User.find({ branch_id, year: Number(year), role: ROLES.STUDENT })
      .select('enrollment_number')
      .lean();

    const enrollMap = {};
    for (const s of students) enrollMap[s.enrollment_number] = s._id;

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
          studentId,
          subjectId: subject_id,
          branchId: branch_id,
          year: Number(year),
          semester: Number(semester),
          examComponentId: exam_component_id,
          totalMarks: row.marks_obtained,
          maxMarks: row.max_marks,
          subFieldEntries: row.sub_field_entries || [],
          submittedBy: req.user._id,
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
    const quizzes = await Quiz.find({ created_by: req.user._id })
      .populate('subject_id', 'name code')
      .sort({ created_at: -1 })
      .lean();
    return sendSuccess(res, quizzes);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.createQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.create({
      ...req.body,
      created_by: req.user._id,
      status: QUIZ_STATUS.DRAFT,
    });
    return sendCreated(res, quiz, 'Quiz created as draft.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.updateQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, created_by: req.user._id });
    if (!quiz) return sendNotFound(res, 'Quiz not found.');
    if (quiz.status === QUIZ_STATUS.PUBLISHED) {
      return sendForbidden(res, 'Cannot edit a published quiz.');
    }
    Object.assign(quiz, req.body);
    await quiz.save();
    return sendSuccess(res, quiz, 'Quiz updated.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.publishQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, created_by: req.user._id });
    if (!quiz) return sendNotFound(res);

    const conflict = await checkQuizConflict(
      quiz.branch_id,
      quiz.year,
      quiz.start_time,
      quiz.end_time,
      quiz._id
    );
    if (conflict) {
      return sendBadRequest(
        res,
        `Quiz conflicts with "${conflict.title}" by ${conflict.created_by?.name} (${conflict.start_time} – ${conflict.end_time}). Adjust your time window.`
      );
    }

    quiz.status = QUIZ_STATUS.PUBLISHED;
    await quiz.save();
    return sendSuccess(res, null, 'Quiz published.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, created_by: req.user._id });
    if (!quiz) return sendNotFound(res);

    for (const q of quiz.questions) {
      if (q.image_path) deleteQuizImage(q.image_path);
      for (const opt of q.options) {
        if (opt.image_path) deleteQuizImage(opt.image_path);
      }
    }

    await quiz.deleteOne();
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
    const quiz = await Quiz.findOne({ _id: req.params.id, created_by: req.user._id });
    if (!quiz) return sendNotFound(res);

    const attempts = await QuizAttempt.find({
      quiz_id: req.params.id,
      submitted_at: { $ne: null },
    })
      .populate('student_id', 'name enrollment_number')
      .sort({ score: -1 })
      .lean();

    return sendSuccess(res, {
      quiz: { title: quiz.title, total_marks: quiz.total_marks },
      attempts,
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

    const students = await User.find({
      branch_id,
      role: ROLES.STUDENT,
      status: { $ne: USER_STATUS.DELETED },
    })
      .select('name email enrollment_number year section semester')
      .sort({ name: 1 })
      .lean();

    return sendSuccess(res, students);
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
    const { branch_id, subject_id, year } = req.query;
    assertBranchAccess(req.user, branch_id);

    const students = await User.find({
      branch_id,
      year: Number(year),
      role: ROLES.STUDENT,
      status: USER_STATUS.ACTIVE,
    })
      .select('_id name enrollment_number')
      .lean();

    const attendanceData = await Promise.all(
      students.map(async (s) => {
        const [subjectWise, overall] = await Promise.all([
          getStudentSubjectAttendance(s._id),
          getStudentOverallAttendance(s._id),
        ]);
        return { student: s, subject_wise: subjectWise, overall };
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
    const pattern = await ExamPattern.findOne({
      'components._id': exam_component_id,
    });
    if (!pattern) return sendNotFound(res, 'Exam pattern not found.');

    const component = pattern.components.id(exam_component_id);
    if (!component) return sendNotFound(res, 'Component not found.');

    if (!['coordinator', 'examcontroller'].includes(component.entered_by)) {
      return sendForbidden(res, 'You are not authorized to enter marks for this component.');
    }

    const results = [];
    for (const entry of entries) {
      const marks = await upsertMarks({
        studentId: entry.student_id,
        subjectId: subject_id,
        branchId: branch_id,
        year: Number(year),
        semester: Number(semester),
        examComponentId: exam_component_id,
        totalMarks: entry.total_marks,
        maxMarks: entry.max_marks,
        subFieldEntries: [],
        submittedBy: req.user._id,
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

    const students = await User.find({
      branch_id,
      year: Number(year),
      role: ROLES.STUDENT,
      status: USER_STATUS.ACTIVE,
    })
      .select('name enrollment_number')
      .lean();

    const buffer = generateMarksCSVTemplate(students, []);
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
    const students = await User.find({ branch_id, year: Number(year), role: ROLES.STUDENT })
      .select('enrollment_number')
      .lean();

    const enrollMap = {};
    for (const s of students) enrollMap[s.enrollment_number] = s._id;

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
          studentId,
          subjectId: subject_id,
          branchId: branch_id,
          year: Number(year),
          semester: Number(semester),
          examComponentId: exam_component_id,
          totalMarks: row.marks_obtained,
          maxMarks: row.max_marks,
          subFieldEntries: [],
          submittedBy: req.user._id,
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

    // Verify student belongs to branch
    const student = await User.findOne({
      _id: student_id,
      branch_id,
      role: ROLES.STUDENT,
    });
    if (!student) return sendNotFound(res, 'Student not found in this branch.');

    const token = await generateParentToken(student_id, req.user._id, expiry);
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
    const notice = await Notice.create({
      title,
      body,
      priority,
      target_type,
      target_ids,
      schedule_at,
      expires_at,
      posted_by: req.user._id,
    });
    return sendCreated(res, notice, 'Notice posted.');
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
    const msg = await Message.create({ sender_id: req.user._id, recipient_id, body });
    return sendCreated(res, msg, 'Message sent.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.getMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [{ sender_id: req.user._id }, { recipient_id: req.user._id }],
    })
      .populate('sender_id', 'name role')
      .populate('recipient_id', 'name role')
      .sort({ created_at: -1 })
      .lean();
    return sendSuccess(res, messages);
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

    const [totalStudents, marksDist] = await Promise.all([
      User.countDocuments({ branch_id, year: Number(year), role: ROLES.STUDENT, status: USER_STATUS.ACTIVE }),
      Marks.aggregate([
        { $match: { branch_id: require('mongoose').Types.ObjectId(branch_id), year: Number(year) } },
        {
          $group: {
            _id: '$student_id',
            avg_marks: { $avg: { $divide: ['$total_marks', '$max_marks'] } },
          },
        },
        {
          $group: {
            _id: null,
            class_average: { $avg: '$avg_marks' },
            pass_count: { $sum: { $cond: [{ $gte: ['$avg_marks', 0.4] }, 1, 0] } },
            fail_count: { $sum: { $cond: [{ $lt: ['$avg_marks', 0.4] }, 1, 0] } },
          },
        },
      ]),
    ]);

    return sendSuccess(res, {
      total_students: totalStudents,
      marks_distribution: marksDist[0] || { class_average: 0, pass_count: 0, fail_count: 0 },
    });
  } catch (err) {
    if (err.statusCode === 403) return sendForbidden(res, err.message);
    return sendError(res, err.message);
  }
};

exports.markAttendanceByDate = async (req, res) => {
  try {
    const Attendance = require('../models/Attendance');
    const { subject_id, date } = req.query;

    const subject = await Subject.findById(subject_id);
    if (!subject) return sendNotFound(res, 'Subject not found.');
    assertBranchAccess(req.user, subject.branch_id);

    const students = await User.find({
      branch_id: subject.branch_id,
      year: subject.year,
      role: ROLES.STUDENT,
      status: USER_STATUS.ACTIVE,
    }).select('name enrollment_number section').sort({ name: 1 }).lean();

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existing = await Attendance.find({
      subject_id,
      date: { $gte: startOfDay, $lte: endOfDay },
    }).lean();

    const attendanceMap = {};
    for (const a of existing) attendanceMap[a.student_id.toString()] = a.status;

    const result = students.map((s) => ({
      ...s,
      status: attendanceMap[s._id.toString()] || 'present',
    }));

    return sendSuccess(res, result);
  } catch (err) {
    if (err.statusCode === 403) return sendForbidden(res, err.message);
    return sendError(res, err.message);
  }
};

exports.submitAttendanceMark = async (req, res) => {
  try {
    const Attendance = require('../models/Attendance');
    const { subject_id, date, slot, entries } = req.body;

    const subject = await Subject.findById(subject_id);
    if (!subject) return sendNotFound(res, 'Subject not found.');
    assertBranchAccess(req.user, subject.branch_id);

    const attendanceDate = new Date(date);
    const ops = entries.map((e) => ({
      updateOne: {
        filter: { student_id: e.student_id, subject_id, date: attendanceDate },
        update: {
          $set: {
            status: e.status,
            branch_id: subject.branch_id,
            year: subject.year,
            slot: slot || null,
            marked_by: req.user._id,
          },
        },
        upsert: true,
      },
    }));

    await Attendance.bulkWrite(ops);
    return sendSuccess(res, null, 'Attendance saved.');
  } catch (err) {
    if (err.statusCode === 403) return sendForbidden(res, err.message);
    return sendError(res, err.message);
  }
};

exports.getAttendanceSummaryCoord = async (req, res) => {
  try {
    const Attendance = require('../models/Attendance');
    const { subject_id } = req.query;

    const subject = await Subject.findById(subject_id);
    if (!subject) return sendNotFound(res, 'Subject not found.');
    assertBranchAccess(req.user, subject.branch_id);

    const students = await User.find({
      branch_id: subject.branch_id,
      year: subject.year,
      role: ROLES.STUDENT,
      status: USER_STATUS.ACTIVE,
    }).select('name enrollment_number').sort({ name: 1 }).lean();

    const records = await Attendance.find({ subject_id }).lean();

    const summary = {};
    for (const s of students) {
      summary[s._id.toString()] = { ...s, total: 0, present: 0, absent: 0, late: 0 };
    }
    for (const r of records) {
      const key = r.student_id.toString();
      if (summary[key]) {
        summary[key].total++;
        summary[key][r.status]++;
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
    const branchIds = (req.user.coordinator_branches || []).map(
      (b) => b.branch_id?._id || b.branch_id
    );
    const subjects = await Subject.find({ branch_id: { $in: branchIds } })
      .populate('branch_id', 'name code')
      .sort({ name: 1 })
      .lean();
    return sendSuccess(res, subjects);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.exportAttendanceSummaryCSV = async (req, res) => {
  try {
    const Attendance = require('../models/Attendance');
    const { subject_id } = req.query;

    const subject = await Subject.findById(subject_id);
    if (!subject) return sendNotFound(res, 'Subject not found.');
    assertBranchAccess(req.user, subject.branch_id);

    const students = await User.find({
      branch_id: subject.branch_id,
      year: subject.year,
      role: ROLES.STUDENT,
      status: USER_STATUS.ACTIVE,
    }).select('name enrollment_number').sort({ name: 1 }).lean();

    const records = await Attendance.find({ subject_id }).lean();

    const summary = {};
    for (const s of students) {
      summary[s._id.toString()] = { ...s, total: 0, present: 0, absent: 0, late: 0 };
    }
    for (const r of records) {
      const key = r.student_id.toString();
      if (summary[key]) {
        summary[key].total++;
        summary[key][r.status]++;
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