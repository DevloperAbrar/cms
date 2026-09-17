const prisma = require('../config/prismaClient');
const { sendSuccess, sendError, sendNotFound, sendBadRequest } = require('../utils/apiResponse');
const { upsertResult, publishResults, unpublishResults } = require('../services/finalResult.service');

// Subject/branch counts for the dashboard stat cards only —
// exam controller no longer enters subject-wise marks (that's faculty's job).
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

exports.getFinalResultConfigs = async (req, res) => {
  try {
    const where = { isActive: true, collegeId: req.user.collegeId };
    if (req.query.year) where.year = Number(req.query.year);
    if (req.query.semester) where.semester = Number(req.query.semester);
    const configs = await prisma.finalResultConfig.findMany({ where, orderBy: [{ year: 'asc' }, { semester: 'asc' }] });
    return sendSuccess(res, configs.map((c) => ({ ...c, _id: c.id, is_active: c.isActive, metric_type: c.metricType, passing_value: c.passingValue, max_value: c.maxValue })));
  } catch (err) { return sendError(res, err.message); }
};

exports.getFinalResultDepartments = async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      where: { collegeId: req.user.collegeId }, orderBy: { name: 'asc' },
    });
    return sendSuccess(res, departments.map((d) => ({ ...d, _id: d.id })));
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