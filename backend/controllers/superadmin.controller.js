const mongoose = require('mongoose');
const User = require('../models/User');
const Stream = require('../models/Stream');
const Department = require('../models/Department');
const Branch = require('../models/Branch');
const Subject = require('../models/Subject');
const ExamPattern = require('../models/ExamPattern');
const AuditLog = require('../models/AuditLog');
const Marks = require('../models/Marks');
const Quiz = require('../models/Quiz');
const Attendance = require('../models/Attendance');
const Notice = require('../models/Notice'); 
const {
  sendSuccess,
  sendCreated,
  sendError,
  sendNotFound,
  sendBadRequest,
  sendConflict,
} = require('../utils/apiResponse');
const { ROLES, USER_STATUS } = require('../config/constants');
const { processStudentCSV, generateStudentCSVTemplate } = require('../services/csv.service');
const { generateStudentCSVTemplate: genTemplate } = require('../utils/csvTemplateGenerator');
const logger = require('../utils/logger');

// ─── STREAMS ────────────────────────────────────────────────────────────────

exports.getStreams = async (_req, res) => {
  try {
    const streams = await Stream.find().sort({ name: 1 }).lean();
    return sendSuccess(res, streams);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.createStream = async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) return sendBadRequest(res, 'Name and code are required.');

    const exists = await Stream.findOne({ code: code.toUpperCase() });
    if (exists) return sendConflict(res, 'Stream code already exists.');

    const stream = await Stream.create({ name, code });
    return sendCreated(res, stream, 'Stream created.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.updateStream = async (req, res) => {
  try {
    const stream = await Stream.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!stream) return sendNotFound(res, 'Stream not found.');
    return sendSuccess(res, stream, 'Stream updated.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.deleteStream = async (req, res) => {
  try {
    const hasBranches = await Branch.exists({
      department_id: {
        $in: await Department.find({ stream_id: req.params.id }).distinct('_id'),
      },
    });
    if (hasBranches) return sendBadRequest(res, 'Cannot delete: branches exist under this stream.');

    await Stream.findByIdAndDelete(req.params.id);
    return sendSuccess(res, null, 'Stream deleted.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── DEPARTMENTS ─────────────────────────────────────────────────────────────

exports.getDepartments = async (req, res) => {
  try {
    const filter = req.query.stream_id ? { stream_id: req.query.stream_id } : {};
    const departments = await Department.find(filter).populate('stream_id', 'name code').sort({ name: 1 }).lean();
    return sendSuccess(res, departments);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const { name, code, stream_id } = req.body;
    if (!name || !code || !stream_id) return sendBadRequest(res, 'Name, code, and stream_id are required.');

    const exists = await Department.findOne({ code: code.toUpperCase() });
    if (exists) return sendConflict(res, 'Department code already exists.');

    const dept = await Department.create({ name, code, stream_id });
    return sendCreated(res, dept, 'Department created.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const dept = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!dept) return sendNotFound(res, 'Department not found.');
    return sendSuccess(res, dept, 'Department updated.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const hasUsers = await User.exists({ department_id: req.params.id });
    if (hasUsers) return sendBadRequest(res, 'Cannot delete: users assigned to this department.');
    await Department.findByIdAndDelete(req.params.id);
    return sendSuccess(res, null, 'Department deleted.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── BRANCHES ────────────────────────────────────────────────────────────────

exports.getBranches = async (req, res) => {
  try {
    const filter = req.query.department_id ? { department_id: req.query.department_id } : {};
    const branches = await Branch.find(filter).populate('department_id', 'name code').sort({ name: 1 }).lean();
    return sendSuccess(res, branches);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.createBranch = async (req, res) => {
  try {
    const { name, code, department_id } = req.body;
    if (!name || !code || !department_id) return sendBadRequest(res, 'Name, code, and department_id are required.');

    const exists = await Branch.findOne({ code: code.toUpperCase() });
    if (exists) return sendConflict(res, 'Branch code already exists.');

    const branch = await Branch.create({ name, code, department_id });
    return sendCreated(res, branch, 'Branch created.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.updateBranch = async (req, res) => {
  try {
    const branch = await Branch.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!branch) return sendNotFound(res, 'Branch not found.');
    return sendSuccess(res, branch, 'Branch updated.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.deleteBranch = async (req, res) => {
  try {
    const hasStudents = await User.exists({ branch_id: req.params.id, role: ROLES.STUDENT });
    if (hasStudents) return sendBadRequest(res, 'Cannot delete: students assigned to this branch.');
    await Branch.findByIdAndDelete(req.params.id);
    return sendSuccess(res, null, 'Branch deleted.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── SUBJECTS ────────────────────────────────────────────────────────────────

exports.getSubjects = async (req, res) => {
  try {
    const filter = {};
    if (req.query.branch_id) filter.branch_id = req.query.branch_id;
    if (req.query.year) filter.year = Number(req.query.year);
    if (req.query.semester) filter.semester = Number(req.query.semester);
    const subjects = await Subject.find(filter).populate('branch_id', 'name code').sort({ name: 1 }).lean();
    return sendSuccess(res, subjects);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.createSubject = async (req, res) => {
  try {
    const { name, code, branch_id, year, semester, type, credits } = req.body;
    if (!name || !code || !branch_id || !year || !semester) {
      return sendBadRequest(res, 'Name, code, branch_id, year, and semester are required.');
    }
    const exists = await Subject.findOne({ code: code.toUpperCase() });
    if (exists) return sendConflict(res, 'Subject code already exists.');
    const subject = await Subject.create({ name, code, branch_id, year, semester, type, credits });
    return sendCreated(res, subject, 'Subject created.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.updateSubject = async (req, res) => {
  try {
    const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!subject) return sendNotFound(res, 'Subject not found.');
    return sendSuccess(res, subject, 'Subject updated.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.deleteSubject = async (req, res) => {
  try {
    await Subject.findByIdAndDelete(req.params.id);
    return sendSuccess(res, null, 'Subject deleted.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── FACULTY ────────────────────────────────────────────────────────────────

exports.getUsers = async (req, res) => {
  try {
    const { role, department_id, status } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (department_id) filter.department_id = department_id;
    if (status) filter.status = status;

    const users = await User.find(filter)
      .select('-google_id')
      .populate('department_id', 'name code')
      .populate('branch_id', 'name code')
      .sort({ name: 1 })
      .lean();
    return sendSuccess(res, users);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, role, department_id, phone } = req.body;
    if (!name || !email || !role) return sendBadRequest(res, 'Name, email, and role are required.');

    if (role === ROLES.SUPERADMIN) return sendBadRequest(res, 'Cannot create superadmin via API.');

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return sendConflict(res, 'Email already registered.');

    const user = await User.create({ name, email: email.toLowerCase(), role, department_id, phone });
    return sendCreated(res, user, 'User created.');
  } catch (err) {
    console.error('CREATE USER ERROR:', err); // ADD THIS LINE
    return sendError(res, err.message);
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { role, ...updateData } = req.body;
    // Prevent role escalation to superadmin
    if (role === ROLES.SUPERADMIN) return sendBadRequest(res, 'Invalid role.');
    if (role) updateData.role = role;

    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .select('-google_id')
      .lean();
    if (!user) return sendNotFound(res, 'User not found.');
    return sendSuccess(res, user, 'User updated.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.deactivateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { status: USER_STATUS.INACTIVE } },
      { new: true }
    );
    if (!user) return sendNotFound(res, 'User not found.');
    return sendSuccess(res, null, 'User deactivated.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return sendNotFound(res, 'User not found.');

    // Students: soft delete
    if (user.role === ROLES.STUDENT) {
      await User.findByIdAndUpdate(req.params.id, { status: USER_STATUS.DELETED });
      return sendSuccess(res, null, 'Student soft-deleted. Data retained.');
    }

    // Faculty: block if active quiz exists
    if (user.role === ROLES.FACULTY) {
      const activeQuiz = await Quiz.exists({ created_by: req.params.id, status: 'published' });
      if (activeQuiz) return sendBadRequest(res, 'Cannot delete: faculty has active published quiz.');
    }

    await User.findByIdAndDelete(req.params.id);
    return sendSuccess(res, null, 'User deleted.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── STUDENT CSV UPLOAD ──────────────────────────────────────────────────────

exports.uploadStudentsCSV = async (req, res) => {
  try {
    if (!req.file) return sendBadRequest(res, 'CSV file is required.');
    const result = await processStudentCSV(req.file.buffer);
    return sendSuccess(res, result, `Import complete. ${result.imported} students added.`);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.downloadStudentCSVTemplate = async (_req, res) => {
  try {
    const { generateStudentCSVTemplate } = require('../utils/csvTemplateGenerator');
    const buffer = generateStudentCSVTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="student_upload_template.csv"');
    return res.send(buffer);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── EXAM PATTERN ────────────────────────────────────────────────────────────

exports.getExamPattern = async (req, res) => {
  try {
    const { stream_id, year, semester } = req.query;
    const pattern = await ExamPattern.findOne({ stream_id, year: Number(year), semester: Number(semester) });
    if (!pattern) return sendNotFound(res, 'Exam pattern not configured for this stream/year/semester.');
    return sendSuccess(res, pattern);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.upsertExamPattern = async (req, res) => {
  try {
    const { stream_id, year, semester, components, sgpa_formula } = req.body;
    if (!stream_id || !year || !semester || !components?.length) {
      return sendBadRequest(res, 'stream_id, year, semester, and components are required.');
    }

    // Validate weightage sum = 100
    const totalWeightage = components.reduce((sum, c) => sum + (c.weightage_percent || 0), 0);
    if (Math.round(totalWeightage) !== 100) {
      return sendBadRequest(res, `Component weightages must sum to 100. Current sum: ${totalWeightage}.`);
    }

    const pattern = await ExamPattern.findOneAndUpdate(
      { stream_id, year, semester },
      { $set: { components, sgpa_formula: sgpa_formula || 'weighted_average' } },
      { upsert: true, new: true }
    );
    return sendSuccess(res, pattern, 'Exam pattern saved.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.forceUnlockExamPattern = async (req, res) => {
  try {
    const pattern = await ExamPattern.findByIdAndUpdate(
      req.params.id,
      { $set: { locked: false, force_unlock_by: req.user._id } },
      { new: true }
    );
    if (!pattern) return sendNotFound(res);
    return sendSuccess(res, null, 'Exam pattern force-unlocked. SGPA will recalculate.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── AUDIT LOGS ──────────────────────────────────────────────────────────────

exports.getAuditLogs = async (req, res) => {
  try {
    const { actor_id, action, resource_type, from, to, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (actor_id) filter.actor_id = actor_id;
    if (action) filter.action = new RegExp(action, 'i');
    if (resource_type) filter.resource_type = resource_type;
    if (from || to) {
      filter.created_at = {};
      if (from) filter.created_at.$gte = new Date(from);
      if (to) filter.created_at.$lte = new Date(to);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(Number(limit)).lean(),
      AuditLog.countDocuments(filter),
    ]);

    return sendSuccess(res, { logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.exportAuditLogsCSV = async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = {};
    if (from || to) {
      filter.created_at = {};
      if (from) filter.created_at.$gte = new Date(from);
      if (to) filter.created_at.$lte = new Date(to);
    }

    const logs = await AuditLog.find(filter).sort({ created_at: -1 }).lean();
    const { Parser } = require('json2csv');
    const fields = ['actor_name', 'actor_role', 'action', 'resource_type', 'ip_address', 'created_at'];
    const parser = new Parser({ fields });
    const csv = parser.parse(logs);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.csv"');
    return res.send(csv);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── NOTICES ─────────────────────────────────────────────────────────────────

exports.getNotices = async (req, res) => {
  try {
    const filter = {};
    if (req.query.priority) filter.priority = req.query.priority;

    const notices = await Notice.find(filter)
      .populate('posted_by', 'name role')
      .sort({ created_at: -1 })
      .lean();
    return sendSuccess(res, notices);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.createNotice = async (req, res) => {
  try {
    const { title, body, priority, target_type, target_ids, schedule_at, expires_at } = req.body;
    if (!title || !body || !target_type) {
      return sendBadRequest(res, 'Title, body, and target_type are required.');
    }

    // SuperAdmin is synthetic (no DB _id), so skip posted_by for superadmin
    const noticeData = {
      title,
      body,
      priority,
      target_type,
      target_ids: target_ids || [],
      schedule_at: schedule_at || null,
      expires_at: expires_at || null,
    };

    if (!req.isSuperAdmin) {
      noticeData.posted_by = req.user._id;
    }

    const notice = await Notice.create(noticeData);
    return sendCreated(res, notice, 'Notice posted.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.updateNotice = async (req, res) => {
  try {
    const notice = await Notice.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!notice) return sendNotFound(res, 'Notice not found.');
    return sendSuccess(res, notice, 'Notice updated.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.deleteNotice = async (req, res) => {
  try {
    const notice = await Notice.findByIdAndDelete(req.params.id);
    if (!notice) return sendNotFound(res, 'Notice not found.');
    return sendSuccess(res, null, 'Notice deleted.');
  } catch (err) {
    return sendError(res, err.message);
  }
};


// ─── FINAL RESULT CONFIG (SuperAdmin) ────────────────────────────────────────
const FinalResultConfig = require('../models/FinalResultConfig');
const FinalResult = require('../models/FinalResult');

exports.getFinalResultConfigs = async (req, res) => {
  try {
    const filter = {};
    if (req.query.year) filter.year = Number(req.query.year);
    if (req.query.semester) filter.semester = Number(req.query.semester);
    const configs = await FinalResultConfig.find(filter).sort({ year: 1, semester: 1, created_at: -1 }).lean();
    return sendSuccess(res, configs);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.createFinalResultConfig = async (req, res) => {
  try {
    const { label, metric_type, year, semester, max_value, passing_value, decimal_places } = req.body;
    if (!label || !metric_type || !year || !semester || max_value == null || passing_value == null) {
      return sendBadRequest(res, 'label, metric_type, year, semester, max_value, passing_value are required.');
    }
    const config = await FinalResultConfig.create({
      label, metric_type, year: Number(year), semester: Number(semester),
      max_value, passing_value, decimal_places: decimal_places ?? 2,
      created_by: null, // superadmin has no DB _id
    });
    return sendCreated(res, config, 'Final result config created.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.updateFinalResultConfig = async (req, res) => {
  try {
    const config = await FinalResultConfig.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!config) return sendNotFound(res, 'Config not found.');
    return sendSuccess(res, config, 'Config updated.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.deleteFinalResultConfig = async (req, res) => {
  try {
    const hasResults = await FinalResult.exists({ config_id: req.params.id });
    if (hasResults) return sendBadRequest(res, 'Cannot delete: results already submitted for this config.');
    await FinalResultConfig.findByIdAndDelete(req.params.id);
    return sendSuccess(res, null, 'Config deleted.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.getFinalResultsAdmin = async (req, res) => {
  try {
    const { config_id, branch_id, department_id } = req.query;
    if (!config_id) return sendBadRequest(res, 'config_id is required.');
    const filter = { config_id };
    if (branch_id) filter.branch_id = branch_id;
    if (department_id) filter.department_id = department_id;

    const results = await FinalResult.find(filter)
      .populate('student_id', 'name enrollment_number year semester')
      .populate('branch_id', 'name code')
      .populate('department_id', 'name code')
      .sort({ value: -1 })
      .lean();

    const ranked = results.map((r, i) => ({ ...r, rank: i + 1 }));
    return sendSuccess(res, ranked);
  } catch (err) {
    return sendError(res, err.message);
  }
};