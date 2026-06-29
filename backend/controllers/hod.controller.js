const User = require('../models/User');
const Timetable = require('../models/Timetable');
const Subject = require('../models/Subject');
const Marks = require('../models/Marks');
const FacultyAttendance = require('../models/FacultyAttendance');
const ExamPattern = require('../models/ExamPattern');
const Notice = require('../models/Notice');
const Message = require('../models/Message');
const { sendSuccess, sendCreated, sendError, sendNotFound, sendBadRequest, sendForbidden } = require('../utils/apiResponse');
const { ROLES, USER_STATUS, ATTENDANCE_STATUS } = require('../config/constants');
const mongoose = require('mongoose');
const { lockComponent, unlockComponent } = require('../services/marks.service');
const { getStudentSubjectAttendance, getStudentOverallAttendance, getBranchDefaulters } = require('../services/attendance.service');
const { generateParentToken, revokeParentToken } = require('../services/parentToken.service');
const { getNoticesForUser } = require('../services/notice.service');
const logger = require('../utils/logger');

// ─── TIMETABLE ───────────────────────────────────────────────────────────────

exports.getTimetable = async (req, res) => {
  try {
    const { branch_id, year, semester, academic_year } = req.query;
    const filter = { branch_id, year: Number(year), semester: Number(semester), academic_year };

    const timetable = await Timetable.findOne(filter)
      .populate('slots.subject_id', 'name code')
      .populate('slots.faculty_id', 'name email')
      .lean();

    return sendSuccess(res, timetable);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.upsertTimetable = async (req, res) => {
  try {
    const { branch_id, year, section, academic_year, semester, slots } = req.body;

    // Conflict detection: same faculty or same room in same slot
    const conflicts = [];
    const slotMap = {};

    for (const slot of slots) {
      const key = `${slot.day}-${slot.time_slot}`;
      if (slotMap[key]) {
        // Check faculty conflict
        if (slot.faculty_id && slotMap[key].faculty_id === slot.faculty_id) {
          conflicts.push(`Faculty conflict on ${slot.day} ${slot.time_slot}`);
        }
        // Check room conflict
        if (slot.room && slotMap[key].room === slot.room) {
          conflicts.push(`Room conflict on ${slot.day} ${slot.time_slot}: ${slot.room}`);
        }
      } else {
        slotMap[key] = slot;
      }
    }

    if (conflicts.length) return sendBadRequest(res, `Timetable conflicts: ${conflicts.join('; ')}`);

    const timetable = await Timetable.findOneAndUpdate(
      { branch_id, year, section: section || null, academic_year, semester },
      { $set: { slots, created_by: req.user._id } },
      { upsert: true, new: true }
    );

    return sendSuccess(res, timetable, 'Timetable saved.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.publishTimetable = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return sendNotFound(res);

    timetable.status = 'published';
    timetable.published_at = new Date();
    await timetable.save();

    return sendSuccess(res, null, 'Timetable published.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── FACULTY MANAGEMENT ──────────────────────────────────────────────────────

exports.getDeptFaculty = async (req, res) => {
  try {
    const faculty = await User.find({
      department_id: req.user.department_id,
      role: { $in: [ROLES.FACULTY, ROLES.COORDINATOR] },
      status: USER_STATUS.ACTIVE,
    })
      .select('name email role coordinator_branches')
      .populate('coordinator_branches.branch_id', 'name code')  // updated
      .lean();

    return sendSuccess(res, faculty);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.getDeptBranches = async (req, res) => {
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

exports.getDeptSubjects = async (req, res) => {
  try {
    const Subject = require('../models/Subject');
    const filter = {};
    if (req.query.branch_id) filter.branch_id = req.query.branch_id;
    if (req.query.year) filter.year = Number(req.query.year);
    if (req.query.semester) filter.semester = Number(req.query.semester);

    const subjects = await Subject.find(filter)
      .select('name code branch_id year semester type credits')
      .populate('branch_id', 'name code')
      .sort({ name: 1 })
      .lean();
    return sendSuccess(res, subjects);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.assignCoordinator = async (req, res) => {
  try {
    const { faculty_id, coordinator_branches } = req.body;
    // coordinator_branches = [{ branch_id, year }, ...]
    if (!faculty_id || !coordinator_branches?.length) {
      return sendBadRequest(res, 'faculty_id and coordinator_branches are required.');
    }

    const user = await User.findByIdAndUpdate(
      faculty_id,
      {
        $set: {
          role: ROLES.COORDINATOR,
          coordinator_branches,
        },
      },
      { new: true }
    );

    if (!user) return sendNotFound(res, 'Faculty not found.');
    return sendSuccess(res, null, 'Coordinator assigned.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── MARKS LOCK / UNLOCK ─────────────────────────────────────────────────────

exports.lockMarksComponent = async (req, res) => {
  try {
    const { subject_id, branch_id, year, exam_component_id } = req.body;
    await lockComponent(subject_id, branch_id, Number(year), exam_component_id);
    return sendSuccess(res, null, 'Component locked.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.unlockMarksComponent = async (req, res) => {
  try {
    const { subject_id, branch_id, year, exam_component_id } = req.body;
    await unlockComponent(subject_id, branch_id, Number(year), exam_component_id);
    return sendSuccess(res, null, 'Component unlocked.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── STUDENTS / ATTENDANCE / ANALYTICS ───────────────────────────────────────

exports.getDeptStudents = async (req, res) => {
  try {
    const students = await User.find({
      department_id: req.user.department_id,
      role: ROLES.STUDENT,
      status: { $ne: USER_STATUS.DELETED },
    })
      .select('name email enrollment_number branch_id year section')
      .populate('branch_id', 'name code')
      .sort({ name: 1 })
      .lean();

    return sendSuccess(res, students);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.getStudentAttendance = async (req, res) => {
  try {
    const { student_id } = req.params;
    const [subject, overall] = await Promise.all([
      getStudentSubjectAttendance(student_id),
      getStudentOverallAttendance(student_id),
    ]);
    return sendSuccess(res, { subject_wise: subject, overall });
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.getBranchDefaulters = async (req, res) => {
  try {
    const { branch_id, year, threshold = 75 } = req.query;
    const defaulters = await getBranchDefaulters(branch_id, Number(year), Number(threshold));
    return sendSuccess(res, defaulters);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── PARENT URL ──────────────────────────────────────────────────────────────

exports.generateParentURL = async (req, res) => {
  try {
    const { student_id, expiry } = req.body;
    if (!student_id) return sendBadRequest(res, 'student_id is required.');

    const token = await generateParentToken(student_id, req.user._id, expiry);
    const url = `${process.env.CLIENT_URL}/parent/${token}`;
    return sendSuccess(res, { url, token }, 'Parent URL generated.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.revokeParentURL = async (req, res) => {
  try {
    const { student_id } = req.body;
    await revokeParentToken(student_id);
    return sendSuccess(res, null, 'Parent URL revoked.');
  } catch (err) {
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

exports.assignSubjectFaculty = async (req, res) => {
  try {
    const Subject = require('../models/Subject');
    const { subject_id, faculty_id } = req.body;
    if (!subject_id || !faculty_id) {
      return sendBadRequest(res, 'subject_id and faculty_id are required.');
    }

    // Verify subject belongs to HOD's department branches
    const Branch = require('../models/Branch');
    const deptBranches = await Branch.find({ department_id: req.user.department_id }).distinct('_id');
    const subject = await Subject.findOne({ _id: subject_id, branch_id: { $in: deptBranches } });
    if (!subject) return sendNotFound(res, 'Subject not found in your department.');

    // Verify faculty belongs to HOD's department
    const faculty = await User.findOne({
      _id: faculty_id,
      department_id: req.user.department_id,
      role: { $in: [ROLES.FACULTY, ROLES.COORDINATOR] },
    });
    if (!faculty) return sendNotFound(res, 'Faculty not found in your department.');

    subject.assigned_faculty = faculty_id;
    await subject.save();

    return sendSuccess(res, null, 'Faculty assigned to subject.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.getDeptSubjectsWithFaculty = async (req, res) => {
  try {
    const Subject = require('../models/Subject');
    const Branch = require('../models/Branch');
    const filter = {};
    if (req.query.branch_id) filter.branch_id = req.query.branch_id;
    if (req.query.year) filter.year = Number(req.query.year);

    const deptBranches = await Branch.find({ department_id: req.user.department_id }).distinct('_id');
    filter.branch_id = filter.branch_id ? filter.branch_id : { $in: deptBranches };

    const subjects = await Subject.find(filter)
      .populate('branch_id', 'name code')
      .populate('assigned_faculty', 'name email')
      .sort({ name: 1 })
      .lean();
    return sendSuccess(res, subjects);
  } catch (err) {
    return sendError(res, err.message);
  }
};


exports.createSubject = async (req, res) => {
  try {
    const Subject = require('../models/Subject');
    const Branch = require('../models/Branch');
    const { name, code, branch_id, year, semester, type, credits } = req.body;
    if (!name || !code || !branch_id || !year || !semester) {
      return sendBadRequest(res, 'Name, code, branch_id, year, and semester are required.');
    }

    // Verify branch belongs to HOD's department
    const branch = await Branch.findOne({ _id: branch_id, department_id: req.user.department_id });
    if (!branch) return sendBadRequest(res, 'Branch does not belong to your department.');

    const exists = await Subject.findOne({ code: code.toUpperCase() });
    if (exists) return sendBadRequest(res, 'Subject code already exists.');

    const subject = await Subject.create({ name, code, branch_id, year, semester, type, credits });
    return sendCreated(res, subject, 'Subject created.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.updateSubject = async (req, res) => {
  try {
    const Subject = require('../models/Subject');
    const Branch = require('../models/Branch');
    const deptBranches = await Branch.find({ department_id: req.user.department_id }).distinct('_id');
    const subject = await Subject.findOneAndUpdate(
      { _id: req.params.id, branch_id: { $in: deptBranches } },
      req.body,
      { new: true }
    );
    if (!subject) return sendNotFound(res, 'Subject not found in your department.');
    return sendSuccess(res, subject, 'Subject updated.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.deleteSubject = async (req, res) => {
  try {
    const Subject = require('../models/Subject');
    const Branch = require('../models/Branch');
    const deptBranches = await Branch.find({ department_id: req.user.department_id }).distinct('_id');
    const subject = await Subject.findOneAndDelete({ _id: req.params.id, branch_id: { $in: deptBranches } });
    if (!subject) return sendNotFound(res, 'Subject not found in your department.');
    return sendSuccess(res, null, 'Subject deleted.');
  } catch (err) {
    return sendError(res, err.message);
  }
};


exports.markFacultyAttendance = async (req, res) => {
  try {
    const FacultyAttendance = require('../models/FacultyAttendance');
    const { records } = req.body; // array
 
    if (!Array.isArray(records) || records.length === 0) {
      return sendBadRequest(res, 'records array is required.');
    }
 
    // Verify every faculty_id belongs to this HOD's department
    const facultyIds = [...new Set(records.map((r) => r.faculty_id))];
    const validFaculty = await User.find({
      _id: { $in: facultyIds },
      department_id: req.user.department_id,
      role: { $in: [ROLES.FACULTY, ROLES.COORDINATOR] },
      status: USER_STATUS.ACTIVE,
    }).distinct('_id');
 
    const validSet = new Set(validFaculty.map(String));
    const invalid = facultyIds.filter((id) => !validSet.has(String(id)));
    if (invalid.length) {
      return sendBadRequest(res, `Faculty not in your department: ${invalid.join(', ')}`);
    }
 
    // Bulk upsert — one record per faculty per date
    const ops = records.map(({ faculty_id, date, status, note }) => ({
      updateOne: {
        filter: {
          faculty_id,
          date: new Date(new Date(date).toISOString().slice(0, 10)), // strip time
        },
        update: {
          $set: {
            faculty_id,
            department_id: req.user.department_id,
            date: new Date(new Date(date).toISOString().slice(0, 10)),
            status,
            note: note || null,
            marked_by: req.user._id,
          },
        },
        upsert: true,
      },
    }));
 
    await FacultyAttendance.bulkWrite(ops);
    return sendSuccess(res, null, 'Faculty attendance marked.');
  } catch (err) {
    return sendError(res, err.message);
  }
};
 


exports.getFacultyAttendance = async (req, res) => {
  try {
    const FacultyAttendance = require('../models/FacultyAttendance');
    const mongoose = require('mongoose');
    const { faculty_id, from, to, month, year } = req.query;
 
    if (!faculty_id) return sendBadRequest(res, 'faculty_id is required.');
 
    // Verify faculty belongs to HOD's department
    const faculty = await User.findOne({
      _id: faculty_id,
      department_id: req.user.department_id,
      role: { $in: [ROLES.FACULTY, ROLES.COORDINATOR] },
    }).select('name email role').lean();
    if (!faculty) return sendNotFound(res, 'Faculty not found in your department.');
 
    // Build date filter
    const dateFilter = {};
    if (from || to) {
      if (from) dateFilter.$gte = new Date(from);
      if (to)   dateFilter.$lte = new Date(to);
    } else if (month && year) {
      const m = Number(month) - 1; // JS months 0-indexed
      const y = Number(year);
      dateFilter.$gte = new Date(y, m, 1);
      dateFilter.$lte = new Date(y, m + 1, 0); // last day of month
    }
    // Default: current month if nothing provided
    if (!Object.keys(dateFilter).length) {
      const now = new Date();
      dateFilter.$gte = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter.$lte = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
 
    const records = await FacultyAttendance.find({
      faculty_id: new mongoose.Types.ObjectId(faculty_id),
      date: dateFilter,
    })
      .sort({ date: 1 })
      .lean();
 
    // Summary
    const total   = records.length;
    const present = records.filter((r) => r.status === ATTENDANCE_STATUS.PRESENT).length;
    const absent  = records.filter((r) => r.status === ATTENDANCE_STATUS.ABSENT).length;
    const late    = records.filter((r) => r.status === ATTENDANCE_STATUS.LATE).length;
    const percentage = total > 0 ? Math.round((present / total) * 100 * 100) / 100 : 0;
 
    return sendSuccess(res, {
      faculty,
      summary: { total, present, absent, late, percentage },
      records,
    });
  } catch (err) {
    return sendError(res, err.message);
  }
};


exports.getFacultyAttendanceSummary = async (req, res) => {
  try {
    const FacultyAttendance = require('../models/FacultyAttendance');
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const day = new Date(dateStr);
    const dayEnd = new Date(dateStr);
    dayEnd.setDate(dayEnd.getDate() + 1);
 
    // All active faculty in department
    const allFaculty = await User.find({
      department_id: req.user.department_id,
      role: { $in: [ROLES.FACULTY, ROLES.COORDINATOR] },
      status: USER_STATUS.ACTIVE,
    })
      .select('name email role')
      .sort({ name: 1 })
      .lean();
 
    // Attendance records for that day
    const records = await FacultyAttendance.find({
      department_id: req.user.department_id,
      date: { $gte: day, $lt: dayEnd },
    }).lean();
 
    const recordMap = {};
    records.forEach((r) => { recordMap[String(r.faculty_id)] = r; });
 
    const summary = allFaculty.map((f) => {
      const rec = recordMap[String(f._id)];
      return {
        faculty_id: f._id,
        name: f.name,
        email: f.email,
        role: f.role,
        status: rec ? rec.status : null,   // null = not marked yet
        note: rec ? rec.note : null,
        record_id: rec ? rec._id : null,
      };
    });
 
    return sendSuccess(res, { date: dateStr, summary });
  } catch (err) {
    return sendError(res, err.message);
  }
};
 

// ─── EXAM PATTERN ────────────────────────────────────────────────────────────

exports.getExamPattern = async (req, res) => {
  try {
    const Department = require('../models/Department');
    const { year, semester } = req.query;

    // HOD's department → stream_id (no manual selection needed)
    const department = await Department.findById(req.user.department_id).lean();
    if (!department) return sendNotFound(res, 'Department not found.');

    const pattern = await ExamPattern.findOne({
      stream_id: department.stream_id,
      year: Number(year),
      semester: Number(semester),
    }).lean();

    if (!pattern) return sendNotFound(res, 'No exam pattern found. Please create one.');
    return sendSuccess(res, pattern);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.upsertExamPattern = async (req, res) => {
  try {
    const Department = require('../models/Department');
    const { year, semester, components, sgpa_formula } = req.body;

    if (!year || !semester || !components?.length) {
      return sendBadRequest(res, 'year, semester, and components are required.');
    }

    const totalWeightage = components.reduce((sum, c) => sum + (c.weightage_percent || 0), 0);
    if (Math.round(totalWeightage) !== 100) {
      return sendBadRequest(res, `Weightages must sum to 100. Current: ${totalWeightage}.`);
    }

    const department = await Department.findById(req.user.department_id).lean();
    if (!department) return sendNotFound(res, 'Department not found.');

    const pattern = await ExamPattern.findOneAndUpdate(
      { stream_id: department.stream_id, year: Number(year), semester: Number(semester) },
      { $set: { components, sgpa_formula: sgpa_formula || 'weighted_average' } },
      { upsert: true, new: true }
    );
    return sendSuccess(res, pattern, 'Exam pattern saved.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── MARKS VIEW ──────────────────────────────────────────────────────────────

exports.getMarksEntries = async (req, res) => {
  try {
    const { subject_id, branch_id, year, semester, exam_component_id } = req.query;

    // Verify branch belongs to HOD's department
    const Branch = require('../models/Branch');
    const branch = await Branch.findOne({ _id: branch_id, department_id: req.user.department_id });
    if (!branch) return sendForbidden(res, 'Branch not in your department.');

    const students = await User.find({
      branch_id,
      year: Number(year),
      role: ROLES.STUDENT,
      status: USER_STATUS.ACTIVE,
    }).select('name enrollment_number').sort({ name: 1 }).lean();

    const marksList = await Marks.find({
      subject_id, branch_id,
      year: Number(year),
      semester: Number(semester),
      exam_component_id,
    }).lean();

    const marksMap = {};
    for (const m of marksList) marksMap[m.student_id.toString()] = m;

    const result = students.map((s) => ({
      ...s,
      marks: marksMap[s._id.toString()] || null,
    }));

    return sendSuccess(res, { students: result });
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.getMarksLockStatus = async (req, res) => {
  try {
    const Marks = require('../models/Marks');
    const { subject_id, branch_id, year, exam_component_id } = req.query;

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

// ─── QUIZ MARKS VIEW ─────────────────────────────────────────────────────────

exports.getQuizMarks = async (req, res) => {
  try {
    const Quiz = require('../models/Quiz');
    const QuizAttempt = require('../models/QuizAttempt');
    const Branch = require('../models/Branch');
    const { branch_id, year, subject_id, quiz_id } = req.query;

    if (branch_id) {
      const branch = await Branch.findOne({ _id: branch_id, department_id: req.user.department_id });
      if (!branch) return sendForbidden(res, 'Branch not in your department.');
    }

    const deptBranches = await Branch.find({ department_id: req.user.department_id }).distinct('_id');
    const quizFilter = { branch_id: { $in: deptBranches }, status: 'published' };
    if (branch_id) quizFilter.branch_id = branch_id;
    if (year) quizFilter.year = Number(year);
    if (subject_id) quizFilter.subject_id = subject_id;

    if (quiz_id) {
      const quiz = await Quiz.findOne({ _id: quiz_id, branch_id: { $in: deptBranches } })
        .populate('subject_id', 'name code').lean();
      if (!quiz) return sendNotFound(res, 'Quiz not found.');

      const attempts = await QuizAttempt.find({ quiz_id, submitted_at: { $ne: null } })
        .populate('student_id', 'name enrollment_number').sort({ score: -1 }).lean();

      const totalMarks = quiz.total_marks;
      const students = attempts.map((a) => ({
        _id: a.student_id?._id,
        name: a.student_id?.name || 'Unknown',
        enrollment_number: a.student_id?.enrollment_number || '—',
        score: a.score ?? 0,
        total_marks: totalMarks,
        percentage: totalMarks > 0 ? Math.round((a.score / totalMarks) * 100) : 0,
        submitted_at: a.submitted_at,
        is_auto_submitted: a.is_auto_submitted,
      }));
      return sendSuccess(res, { quiz, students });
    }

    const quizzes = await Quiz.find(quizFilter)
      .populate('subject_id', 'name code').populate('branch_id', 'name code')
      .sort({ start_time: -1 }).lean();

    const quizIds = quizzes.map((q) => q._id);
    const attemptCounts = await QuizAttempt.aggregate([
      { $match: { quiz_id: { $in: quizIds }, submitted_at: { $ne: null } } },
      { $group: { _id: '$quiz_id', count: { $sum: 1 }, avg_score: { $avg: '$score' } } },
    ]);
    const attemptMap = {};
    attemptCounts.forEach((a) => { attemptMap[a._id.toString()] = a; });

    const result = quizzes.map((q) => {
      const a = attemptMap[q._id.toString()] || { count: 0, avg_score: null };
      return { ...q, attempt_count: a.count, avg_score: a.avg_score !== null ? Math.round(a.avg_score * 10) / 10 : null };
    });
    return sendSuccess(res, { quizzes: result });
  } catch (err) {
    return sendError(res, err.message);
  }
};