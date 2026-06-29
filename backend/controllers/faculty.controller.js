const mongoose = require('mongoose');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Marks = require('../models/Marks');
const MarksComponent = require('../models/MarksComponent');
const ExamPattern = require('../models/ExamPattern');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Notice = require('../models/Notice');
const Message = require('../models/Message');
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
const { checkQuizConflict, scoreAttempt } = require('../services/quiz.service');
const { parseMarksCSV } = require('../services/csv.service');
const { generateMarksCSVTemplate } = require('../utils/csvTemplateGenerator');
const { saveQuizImage, deleteQuizImage } = require('../services/image.service');
const { getNoticesForUser } = require('../services/notice.service');
const logger = require('../utils/logger');

// ─── MY STUDENTS ─────────────────────────────────────────────────────────────

exports.getMyStudents = async (req, res) => {
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

// ─── SUBJECTS ASSIGNED TO FACULTY ────────────────────────────────────────────

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

// ─── SUB-FIELD CONFIG ────────────────────────────────────────────────────────

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
      { faculty_id: req.user._id, subject_id, branch_id, year: Number(year), exam_component_id },
      { $set: { sub_fields } },
      { upsert: true, new: true }
    );

    return sendSuccess(res, config, 'Sub-field config saved.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── MARKS ENTRY ─────────────────────────────────────────────────────────────

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

    const marksMap = {};
    const marksList = await Marks.find({
      subject_id,
      branch_id,
      year: Number(year),
      semester: Number(semester),
      exam_component_id,
    }).lean();

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

exports.submitMarks = async (req, res) => {
  try {
    const { subject_id, branch_id, year, semester, exam_component_id, entries } = req.body;
    // entries: [{ student_id, total_marks, max_marks, sub_field_entries }]

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

    return sendSuccess(res, results, 'Marks submitted.');
  } catch (err) {
    if (err.statusCode === 403) return sendForbidden(res, err.message);
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

    const students = await User.find({
      branch_id,
      year: Number(year),
      role: ROLES.STUDENT,
    }).select('enrollment_number').lean();

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

// ─── QUIZ CRUD ───────────────────────────────────────────────────────────────

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
    const quiz = await Quiz.create({ ...req.body, created_by: req.user._id, status: QUIZ_STATUS.DRAFT });
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

    // Conflict check
    const conflict = await checkQuizConflict(quiz.branch_id, quiz.year, quiz.start_time, quiz.end_time, quiz._id);
    if (conflict) {
      return sendBadRequest(res, `Quiz conflicts with "${conflict.title}" by ${conflict.created_by?.name} (${conflict.start_time} – ${conflict.end_time}). Adjust your time window.`);
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

    // Delete all images
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
    const path = await saveQuizImage(req.file.buffer, questionId);
    return sendSuccess(res, { image_path: path }, 'Image uploaded.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.getQuizResults = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, created_by: req.user._id });
    if (!quiz) return sendNotFound(res);

    const attempts = await QuizAttempt.find({ quiz_id: req.params.id, submitted_at: { $ne: null } })
      .populate('student_id', 'name enrollment_number')
      .sort({ score: -1 })
      .lean();

    return sendSuccess(res, { quiz: { title: quiz.title, total_marks: quiz.total_marks }, attempts });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── NOTICES ─────────────────────────────────────────────────────────────────

exports.postNotice = async (req, res) => {
  try {
    const { title, body, priority, target_type, target_ids, schedule_at, expires_at } = req.body;
    const notice = await Notice.create({ title, body, priority, target_type, target_ids, schedule_at, expires_at, posted_by: req.user._id });
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

// ─── ATTENDANCE ──────────────────────────────────────────────────────────────

exports.getAttendanceByDate = async (req, res) => {
  try {
    const Attendance = require('../models/Attendance');
    const { subject_id, date } = req.query;

    const subject = await Subject.findOne({ _id: subject_id, assigned_faculty: req.user._id });
    if (!subject) return sendForbidden(res, 'Subject not assigned to you.');

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
    return sendError(res, err.message);
  }
};

exports.submitAttendance = async (req, res) => {
  try {
    const Attendance = require('../models/Attendance');
    const { subject_id, date, slot, entries } = req.body;
    // entries: [{ student_id, status }]

    const subject = await Subject.findOne({ _id: subject_id, assigned_faculty: req.user._id });
    if (!subject) return sendForbidden(res, 'Subject not assigned to you.');

    const attendanceDate = new Date(date);

    const ops = entries.map((e) => ({
      updateOne: {
        filter: {
          student_id: e.student_id,
          subject_id,
          date: attendanceDate,
        },
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
    return sendError(res, err.message);
  }
};

exports.getAttendanceSummary = async (req, res) => {
  try {
    const Attendance = require('../models/Attendance');
    const { subject_id } = req.query;

    const subject = await Subject.findOne({ _id: subject_id, assigned_faculty: req.user._id });
    if (!subject) return sendForbidden(res, 'Subject not assigned to you.');

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
    return sendError(res, err.message);
  }
};

// ─── EXAM PATTERN ────────────────────────────────────────────────────────────

exports.getExamPattern = async (req, res) => {
  try {
    const Department = require('../models/Department');
    const Branch = require('../models/Branch');
    const { subject_id, semester } = req.query;

    if (!subject_id || !semester) {
      return sendBadRequest(res, 'subject_id and semester are required.');
    }

    // Walk the chain: Subject → Branch → Department → stream_id
    const subject = await Subject.findById(subject_id).lean();
    if (!subject) return sendNotFound(res, 'Subject not found.');

    const branch = await Branch.findById(subject.branch_id).lean();
    if (!branch) return sendNotFound(res, 'Branch not found.');

    const department = await Department.findById(branch.department_id).lean();
    if (!department) return sendNotFound(res, 'Department not found.');

    // DEBUG — remove after confirming it works
    console.log('STREAM LOOKUP:', {
      subject_id,
      branch_id: subject.branch_id,
      dept_id: branch.department_id,
      stream_id: department.stream_id,
      year: subject.year,
      semester,
    });

    const pattern = await ExamPattern.findOne({
      stream_id: department.stream_id,
      year: Number(subject.year),
      semester: Number(semester),
    }).lean();

    console.log('PATTERN FOUND:', pattern ? 'YES — ' + pattern._id : 'NO');

    if (!pattern) return sendNotFound(res, 'No exam pattern found for this subject + semester.');

    return sendSuccess(res, pattern);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── MARKS LOCK STATUS ───────────────────────────────────────────────────────

exports.getMarksLockStatus = async (req, res) => {
  try {
    const { subject_id, branch_id, year, semester, exam_component_id } = req.query;

    // A component is considered locked if ANY marks record for it is locked
    const lockedRecord = await Marks.findOne({
      subject_id,
      branch_id,
      year: Number(year),
      exam_component_id,
      locked: true,
    });

    return sendSuccess(res, { locked: !!lockedRecord });
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.getFinalResultBranches = async (req, res) => {
  try {
    const Branch = require('../models/Branch');
    const branches = await Branch.find({ department_id: req.user.department_id })
      .select('name code')
      .sort({ name: 1 })
      .lean();
    return sendSuccess(res, branches);
  } catch (err) {
    return sendError(res, err.message);
  }
};
 

exports.publishResults = async (req, res) => {
  try {
    const { mode } = req.body; // 'scores_only' | 'scores_with_rank' | 'scores_with_solution'
 
    const { RESULT_PUBLISH_MODE } = require('../config/constants');
 
    const allowed = Object.values(RESULT_PUBLISH_MODE).filter((m) => m !== RESULT_PUBLISH_MODE.NONE);
    if (!allowed.includes(mode)) {
      return sendBadRequest(res, `Invalid mode. Choose: ${allowed.join(', ')}`);
    }
 
    const quiz = await Quiz.findOne({ _id: req.params.id, created_by: req.user._id });
    if (!quiz) return sendNotFound(res, 'Quiz not found.');
 
    quiz.result_publish_mode = mode;
    await quiz.save();
 
    return sendSuccess(res, { result_publish_mode: quiz.result_publish_mode }, 'Results published to students.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.exportAttendanceSummary = async (req, res) => {
  try {
    const Attendance = require('../models/Attendance');
    const { subject_id } = req.query;

    const subject = await Subject.findOne({ _id: subject_id, assigned_faculty: req.user._id });
    if (!subject) return sendForbidden(res, 'Subject not assigned to you.');

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
    return sendError(res, err.message);
  }
};