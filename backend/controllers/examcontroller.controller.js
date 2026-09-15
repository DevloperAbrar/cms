const prisma = require('../config/prismaClient');
const { sendSuccess, sendError, sendNotFound, sendBadRequest, sendForbidden } = require('../utils/apiResponse');
const { ROLES } = require('../config/constants');
const { upsertMarks } = require('../services/marks.service');
const { parseMarksCSV } = require('../services/csv.service');
const { generateMarksCSVTemplate } = require('../utils/csvTemplateGenerator');
const { upsertResult, publishResults, unpublishResults } = require('../services/finalResult.service');
const logger = require('../utils/logger');

exports.getAllSubjects = async (req, res) => {
  try {
    const { branch_id, year, semester } = req.query;
    const where = { status: 'active', collegeId: req.user.collegeId };
    if (branch_id) where.branchId = branch_id;
    if (year) where.year = Number(year);
    if (semester) where.semester = Number(semester);

    const subjects = await prisma.subject.findMany({
      where, include: { branch: { select: { id: true, name: true, code: true } } }, orderBy: { name: 'asc' },
    });
    return sendSuccess(res, subjects.map((s) => ({ ...s, _id: s.id, branch_id: s.branch ? { _id: s.branchId, name: s.branch.name, code: s.branch.code } : s.branchId })));
  } catch (err) { return sendError(res, err.message); }
};

exports.getAllBranches = async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { collegeId: req.user.collegeId, status: 'active' },
      include: { department: { select: { id: true, name: true, code: true } } },
      orderBy: { name: 'asc' },
    });
    return sendSuccess(res, branches.map((b) => ({ ...b, _id: b.id, department_id: b.department ? { _id: b.departmentId, name: b.department.name, code: b.department.code } : b.departmentId })));
  } catch (err) { return sendError(res, err.message); }
};

exports.getStudents = async (req, res) => {
  try {
    const { branch_id, year } = req.query;
    if (!branch_id || !year) return sendBadRequest(res, 'branch_id and year are required.');

    const students = await prisma.user.findMany({
      where: { branchId: branch_id, year: Number(year), role: 'student', status: 'active' },
      select: { id: true, name: true, email: true, enrollmentNumber: true, section: true },
      orderBy: { name: 'asc' },
    });
    return sendSuccess(res, students.map((s) => ({ _id: s.id, ...s, enrollment_number: s.enrollmentNumber })));
  } catch (err) { return sendError(res, err.message); }
};

exports.getMarksEntries = async (req, res) => {
  try {
    const { subject_id, branch_id, year, semester, exam_component_id } = req.query;

    const students = await prisma.user.findMany({
      where: { branchId: branch_id, year: Number(year), role: 'student', status: 'active' },
      select: { id: true, name: true, enrollmentNumber: true },
      orderBy: { name: 'asc' },
    });

    const marksList = await prisma.marks.findMany({
      where: { subjectId: subject_id, branchId: branch_id, year: Number(year), semester: Number(semester), examComponentId: exam_component_id },
    });

    const marksMap = {};
    for (const m of marksList) marksMap[m.studentId] = m;

    return sendSuccess(res, students.map((s) => ({ _id: s.id, name: s.name, enrollment_number: s.enrollmentNumber, marks: marksMap[s.id] || null })));
  } catch (err) { return sendError(res, err.message); }
};

exports.submitEndSemMarks = async (req, res) => {
  try {
    const { subject_id, branch_id, year, semester, exam_component_id, entries, confirm_overwrite, academic_session_id } = req.body;

    const pattern = await prisma.examPattern.findFirst({
      where: { collegeId: req.user.collegeId },
      include: { components: true },
    });

    if (pattern) {
      const component = pattern.components.find((c) => c.id === exam_component_id);
      if (component && !['examcontroller', 'coordinator'].includes(component.enteredBy)) {
        return sendForbidden(res, 'This component is not designated for end-sem entry.');
      }
    }

    const coordinatorSubmission = await prisma.marks.findFirst({
      where: { subjectId: subject_id, branchId: branch_id, year: Number(year), semester: Number(semester), examComponentId: exam_component_id },
      include: { submittedBy: { select: { role: true } } },
    });

    if (coordinatorSubmission?.submittedBy?.role === 'coordinator' && !confirm_overwrite) {
      return sendSuccess(res, { requires_confirmation: true }, 'Coordinator has already submitted marks for this branch and subject. Set confirm_overwrite=true to proceed.');
    }

    const results = [];
    for (const entry of entries) {
      const marks = await upsertMarks({
        collegeId: req.user.collegeId, studentId: entry.student_id, subjectId: subject_id, branchId: branch_id,
        academicSessionId: academic_session_id, year: Number(year), semester: Number(semester),
        examComponentId: exam_component_id, totalMarks: entry.total_marks, maxMarks: entry.max_marks,
        subFieldEntries: [], submittedBy: req.user.id,
      });
      results.push(marks);
    }

    return sendSuccess(res, results, 'End-sem marks submitted.');
  } catch (err) {
    if (err.statusCode === 403) return sendForbidden(res, err.message);
    return sendError(res, err.message);
  }
};

exports.downloadMarksTemplate = async (req, res) => {
  try {
    const { branch_id, year } = req.query;
    const students = await prisma.user.findMany({
      where: { branchId: branch_id, year: Number(year), role: 'student', status: 'active' },
      select: { id: true, name: true, enrollmentNumber: true },
    });
    const buffer = generateMarksCSVTemplate(students.map((s) => ({ ...s, enrollment_number: s.enrollmentNumber })), []);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="endsem_template.csv"');
    return res.send(buffer);
  } catch (err) { return sendError(res, err.message); }
};

exports.uploadMarksCSV = async (req, res) => {
  try {
    if (!req.file) return sendBadRequest(res, 'CSV file required.');
    const { subject_id, branch_id, year, semester, exam_component_id, academic_session_id } = req.body;
    const rows = await parseMarksCSV(req.file.buffer);

    const students = await prisma.user.findMany({
      where: { branchId: branch_id, year: Number(year), role: 'student' },
      select: { id: true, enrollmentNumber: true },
    });

    const enrollMap = {};
    for (const s of students) enrollMap[s.enrollmentNumber] = s.id;

    const errors = [];
    const results = [];
    for (const row of rows) {
      const studentId = enrollMap[row.enrollment_no];
      if (!studentId) { errors.push({ enrollment_no: row.enrollment_no, error: 'Student not found' }); continue; }
      try {
        const marks = await upsertMarks({
          collegeId: req.user.collegeId, studentId, subjectId: subject_id, branchId: branch_id, academicSessionId: academic_session_id,
          year: Number(year), semester: Number(semester), examComponentId: exam_component_id,
          totalMarks: row.marks_obtained, maxMarks: row.max_marks, subFieldEntries: [], submittedBy: req.user.id,
        });
        results.push(marks);
      } catch (e) { errors.push({ enrollment_no: row.enrollment_no, error: e.message }); }
    }

    return sendSuccess(res, { imported: results.length, errors }, 'CSV marks processed.');
  } catch (err) { return sendError(res, err.message); }
};

exports.getFinalResultConfigs = async (req, res) => {
  try {
    const where = { isActive: true, collegeId: req.user.collegeId };
    if (req.query.year) where.year = Number(req.query.year);
    if (req.query.semester) where.semester = Number(req.query.semester);
    const configs = await prisma.finalResultConfig.findMany({ where, orderBy: [{ year: 'asc' }, { semester: 'asc' }] });
    return sendSuccess(res, configs.map((c) => ({ ...c, _id: c.id, is_active: c.isActive, metric_type: c.metricType, passing_value: c.passingValue, max_value: c.maxValue })));
  } catch (err) { return sendError(res, err.message); }
};

exports.getFinalResultStreams = async (req, res) => {
  try {
    const streams = await prisma.stream.findMany({ where: { collegeId: req.user.collegeId }, orderBy: { name: 'asc' } });
    return sendSuccess(res, streams.map((s) => ({ ...s, _id: s.id })));
  } catch (err) { return sendError(res, err.message); }
};

exports.getFinalResultDepartments = async (req, res) => {
  try {
    const where = { collegeId: req.user.collegeId };
    if (req.query.stream_id) where.streamId = req.query.stream_id;
    const departments = await prisma.department.findMany({ where, include: { stream: { select: { name: true } } }, orderBy: { name: 'asc' } });
    return sendSuccess(res, departments.map((d) => ({ ...d, _id: d.id, stream_id: d.stream ? { _id: d.streamId, name: d.stream.name } : d.streamId })));
  } catch (err) { return sendError(res, err.message); }
};

exports.getFinalResultBranches = async (req, res) => {
  try {
    const where = { collegeId: req.user.collegeId };
    if (req.query.department_id) where.departmentId = req.query.department_id;
    const branches = await prisma.branch.findMany({ where, include: { department: { select: { name: true } } }, orderBy: { name: 'asc' } });
    return sendSuccess(res, branches.map((b) => ({ ...b, _id: b.id, department_id: b.department ? { _id: b.departmentId, name: b.department.name } : b.departmentId })));
  } catch (err) { return sendError(res, err.message); }
};

exports.getFinalResultStudents = async (req, res) => {
  try {
    const { config_id, branch_id } = req.query;
    if (!config_id || !branch_id) return sendBadRequest(res, 'config_id and branch_id are required.');

    const config = await prisma.finalResultConfig.findUnique({ where: { id: config_id } });
    if (!config) return sendNotFound(res, 'Config not found.');

    const students = await prisma.user.findMany({
      where: { branchId: branch_id, year: config.year, role: 'student', status: 'active' },
      select: { id: true, name: true, enrollmentNumber: true, year: true, semester: true, branchId: true, departmentId: true },
      orderBy: { name: 'asc' },
    });

    const studentIds = students.map((s) => s.id);
    const existingResults = await prisma.finalResult.findMany({ where: { configId: config_id, studentId: { in: studentIds } } });

    const resultMap = {};
    existingResults.forEach((r) => { resultMap[r.studentId] = r; });

    return sendSuccess(res, {
      config: { ...config, _id: config.id, is_active: config.isActive, metric_type: config.metricType, max_value: config.maxValue, passing_value: config.passingValue },
      students: students.map((s) => ({ _id: s.id, ...s, enrollment_number: s.enrollmentNumber, result: resultMap[s.id] || null })),
    });
  } catch (err) { return sendError(res, err.message); }
};

exports.submitFinalResults = async (req, res) => {
  try {
    const { config_id, branch_id, entries } = req.body;
    if (!config_id || !branch_id || !Array.isArray(entries) || entries.length === 0) return sendBadRequest(res, 'config_id, branch_id, and entries[] are required.');

    const config = await prisma.finalResultConfig.findUnique({ where: { id: config_id } });
    if (!config) return sendNotFound(res, 'Config not found.');

    const branch = await prisma.branch.findUnique({ where: { id: branch_id } });
    if (!branch) return sendNotFound(res, 'Branch not found.');

    for (const e of entries) {
      if (e.value < 0 || e.value > config.maxValue) return sendBadRequest(res, `Value ${e.value} exceeds max ${config.maxValue} for "${config.label}".`);
    }

    const saved = await Promise.all(
      entries.map((e) => upsertResult({
        collegeId: req.user.collegeId, configId: config_id, studentId: e.student_id, branchId: branch_id,
        departmentId: branch.departmentId, year: config.year, semester: config.semester, value: Number(e.value), submittedBy: req.user.id,
      }))
    );

    return sendSuccess(res, { saved: saved.length }, `${saved.length} results saved.`);
  } catch (err) { return sendError(res, err.message); }
};

exports.publishFinalResults = async (req, res) => {
  try {
    const { config_id, branch_id } = req.body;
    if (!config_id || !branch_id) return sendBadRequest(res, 'config_id and branch_id are required.');
    const result = await publishResults(config_id, branch_id);
    return sendSuccess(res, { modified: result.count }, 'Results published.');
  } catch (err) { return sendError(res, err.message); }
};

exports.unpublishFinalResults = async (req, res) => {
  try {
    const { config_id, branch_id } = req.body;
    if (!config_id || !branch_id) return sendBadRequest(res, 'config_id and branch_id are required.');
    const result = await unpublishResults(config_id, branch_id);
    return sendSuccess(res, { modified: result.count }, 'Results unpublished.');
  } catch (err) { return sendError(res, err.message); }
};