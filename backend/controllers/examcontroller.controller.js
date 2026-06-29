const User = require('../models/User');
const Marks = require('../models/Marks');
const ExamPattern = require('../models/ExamPattern');
const {
  sendSuccess,
  sendError,
  sendNotFound,
  sendBadRequest,
  sendForbidden,
} = require('../utils/apiResponse');
const { ROLES, USER_STATUS } = require('../config/constants');
const { upsertMarks } = require('../services/marks.service');
const { parseMarksCSV } = require('../services/csv.service');
const { generateMarksCSVTemplate } = require('../utils/csvTemplateGenerator');
const logger = require('../utils/logger');
// ─── FINAL RESULTS (Exam Controller) ─────────────────────────────────────────
const FinalResultConfig = require('../models/FinalResultConfig');
const FinalResult = require('../models/FinalResult');
const Branch = require('../models/Branch');
const Department = require('../models/Department');
const Stream = require('../models/Stream');
const { upsertResult, publishResults, unpublishResults } = require('../services/finalResult.service');

/**
 * GET /api/examcontroller/subjects
 * Returns all subjects (institute-wide) for end-sem marks entry.
 */
exports.getAllSubjects = async (req, res) => {
  try {
    const Subject = require('../models/Subject');
    const { branch_id, year, semester } = req.query;
    const filter = { status: 'active' };
    if (branch_id) filter.branch_id = branch_id;
    if (year) filter.year = Number(year);
    if (semester) filter.semester = Number(semester);

    const subjects = await Subject.find(filter)
      .populate('branch_id', 'name code')
      .sort({ name: 1 })
      .lean();

    return sendSuccess(res, subjects);
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * GET /api/examcontroller/branches
 * Returns all branches (institute-wide) for selection.
 */
exports.getAllBranches = async (req, res) => {
  try {
    const Branch = require('../models/Branch');
    const branches = await Branch.find({ status: 'active' })
      .populate('department_id', 'name code')
      .sort({ name: 1 })
      .lean();
    return sendSuccess(res, branches);
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * GET /api/examcontroller/students
 * Returns students for a branch+year (institute-wide).
 */
exports.getStudents = async (req, res) => {
  try {
    const { branch_id, year } = req.query;
    if (!branch_id || !year) return sendBadRequest(res, 'branch_id and year are required.');

    const students = await User.find({
      branch_id,
      year: Number(year),
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

/**
 * GET /api/examcontroller/marks
 * Returns existing end-sem marks for a subject+branch+year+component.
 */
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

    const result = students.map((s) => ({
      ...s,
      marks: marksMap[s._id.toString()] || null,
    }));

    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * POST /api/examcontroller/marks
 * Submit end-sem marks (portal entry).
 * Validates the component is entered_by = examcontroller.
 * If coordinator already submitted → warns but allows overwrite on confirm.
 */
exports.submitEndSemMarks = async (req, res) => {
  try {
    const { subject_id, branch_id, year, semester, exam_component_id, entries, confirm_overwrite } = req.body;

    // Validate component is end-sem type
    const pattern = await ExamPattern.findOne({ 'components._id': exam_component_id });
    if (!pattern) return sendNotFound(res, 'Exam pattern not found.');

    const component = pattern.components.id(exam_component_id);
    if (!component) return sendNotFound(res, 'Component not found in pattern.');

    if (!['examcontroller', 'coordinator'].includes(component.entered_by)) {
      return sendForbidden(res, 'This component is not designated for end-sem entry.');
    }

    // Check if coordinator already submitted for this branch+subject
    const coordinatorSubmission = await Marks.findOne({
      subject_id,
      branch_id,
      year: Number(year),
      semester: Number(semester),
      exam_component_id,
    }).populate('submitted_by', 'role');

    if (
      coordinatorSubmission?.submitted_by?.role === 'coordinator' &&
      !confirm_overwrite
    ) {
      return sendSuccess(
        res,
        { requires_confirmation: true },
        'Coordinator has already submitted marks for this branch and subject. Set confirm_overwrite=true to proceed.'
      );
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

/**
 * GET /api/examcontroller/marks/template
 * Download CSV template for end-sem marks.
 */
exports.downloadMarksTemplate = async (req, res) => {
  try {
    const { branch_id, year } = req.query;

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
    return sendError(res, err.message);
  }
};

/**
 * POST /api/examcontroller/marks/upload
 * Upload end-sem marks via CSV.
 */
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
          subFieldEntries: [],
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






/**
 * GET /examcontroller/final-results/configs
 * Returns all active configs (institute-wide, no year restriction).
 */
exports.getFinalResultConfigs = async (req, res) => {
  try {
    const filter = { is_active: true };
    if (req.query.year) filter.year = Number(req.query.year);
    if (req.query.semester) filter.semester = Number(req.query.semester);
    const configs = await FinalResultConfig.find(filter).sort({ year: 1, semester: 1 }).lean();
    return sendSuccess(res, configs);
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * GET /examcontroller/final-results/streams
 * Returns all streams for the filter cascade.
 */
exports.getFinalResultStreams = async (req, res) => {
  try {
    const streams = await Stream.find().sort({ name: 1 }).lean();
    return sendSuccess(res, streams);
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * GET /examcontroller/final-results/departments?stream_id=
 */
exports.getFinalResultDepartments = async (req, res) => {
  try {
    const filter = {};
    if (req.query.stream_id) filter.stream_id = req.query.stream_id;
    const departments = await Department.find(filter)
      .populate('stream_id', 'name')
      .sort({ name: 1 })
      .lean();
    return sendSuccess(res, departments);
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * GET /examcontroller/final-results/branches?department_id=
 */
exports.getFinalResultBranches = async (req, res) => {
  try {
    const filter = {};
    if (req.query.department_id) filter.department_id = req.query.department_id;
    const branches = await Branch.find(filter)
      .populate('department_id', 'name')
      .sort({ name: 1 })
      .lean();
    return sendSuccess(res, branches);
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * GET /examcontroller/final-results/students?config_id=&branch_id=
 * Returns students for a branch+year matching the config, with existing result values.
 */
exports.getFinalResultStudents = async (req, res) => {
  try {
    const { config_id, branch_id } = req.query;
    if (!config_id || !branch_id) return sendBadRequest(res, 'config_id and branch_id are required.');

    const config = await FinalResultConfig.findById(config_id).lean();
    if (!config) return sendNotFound(res, 'Config not found.');

    const students = await User.find({
      branch_id,
      year: config.year,
      semester: config.semester,
      role: ROLES.STUDENT,
      status: USER_STATUS.ACTIVE,
    })
      .select('name enrollment_number year semester branch_id department_id')
      .sort({ name: 1 })
      .lean();

    const studentIds = students.map((s) => s._id);
    const existingResults = await FinalResult.find({
      config_id,
      student_id: { $in: studentIds },
    }).lean();

    const resultMap = {};
    existingResults.forEach((r) => { resultMap[r.student_id.toString()] = r; });

    const enriched = students.map((s) => ({
      ...s,
      result: resultMap[s._id.toString()] || null,
    }));

    return sendSuccess(res, { config, students: enriched });
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * POST /examcontroller/final-results/submit
 * Body: { config_id, branch_id, entries: [{ student_id, value }] }
 */
exports.submitFinalResults = async (req, res) => {
  try {
    const { config_id, branch_id, entries } = req.body;
    if (!config_id || !branch_id || !Array.isArray(entries) || entries.length === 0) {
      return sendBadRequest(res, 'config_id, branch_id, and entries[] are required.');
    }

    const config = await FinalResultConfig.findById(config_id).lean();
    if (!config) return sendNotFound(res, 'Config not found.');

    const branch = await Branch.findById(branch_id).lean();
    if (!branch) return sendNotFound(res, 'Branch not found.');

    for (const e of entries) {
      if (e.value < 0 || e.value > config.max_value) {
        return sendBadRequest(res, `Value ${e.value} exceeds max ${config.max_value} for "${config.label}".`);
      }
    }

    const saved = await Promise.all(
      entries.map((e) =>
        upsertResult({
          configId: config_id,
          studentId: e.student_id,
          branchId: branch_id,
          departmentId: branch.department_id,
          year: config.year,
          semester: config.semester,
          value: Number(e.value),
          submittedBy: req.user._id,
        })
      )
    );

    return sendSuccess(res, { saved: saved.length }, `${saved.length} results saved.`);
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * POST /examcontroller/final-results/publish
 * Body: { config_id, branch_id }
 */
exports.publishFinalResults = async (req, res) => {
  try {
    const { config_id, branch_id } = req.body;
    if (!config_id || !branch_id) return sendBadRequest(res, 'config_id and branch_id are required.');
    const result = await publishResults(config_id, branch_id);
    return sendSuccess(res, { modified: result.modifiedCount }, 'Results published.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * POST /examcontroller/final-results/unpublish
 * Body: { config_id, branch_id }
 */
exports.unpublishFinalResults = async (req, res) => {
  try {
    const { config_id, branch_id } = req.body;
    if (!config_id || !branch_id) return sendBadRequest(res, 'config_id and branch_id are required.');
    const result = await unpublishResults(config_id, branch_id);
    return sendSuccess(res, { modified: result.modifiedCount }, 'Results unpublished.');
  } catch (err) {
    return sendError(res, err.message);
  }
};