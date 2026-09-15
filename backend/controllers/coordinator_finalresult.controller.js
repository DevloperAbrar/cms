const prisma = require('../config/prismaClient');
const { upsertResult, publishResults, unpublishResults, getRankedResults } = require('../services/finalResult.service');
const { sendSuccess, sendError, sendBadRequest, sendNotFound } = require('../utils/apiResponse');

// Same workaround as coordinator.controller.js — coordinatorBranches isn't a DB column yet,
// it must be populated onto req.user by auth middleware as [{ branch_id, year }, ...]
const getCoordinatorBranches = (user) => user.coordinatorBranches || user.coordinator_branches || [];

exports.getFinalResultConfigs = async (req, res) => {
  try {
    const coordinatorBranches = getCoordinatorBranches(req.user);
    const years = [...new Set(coordinatorBranches.map((b) => b.year).filter((y) => y != null))];

    const where = { isActive: true, collegeId: req.user.collegeId };
    if (years.length > 0) where.year = { in: years };

    const configs = await prisma.finalResultConfig.findMany({
      where,
      orderBy: [{ year: 'asc' }, { semester: 'asc' }],
    });

    return sendSuccess(res, configs.map((c) => ({
      ...c, _id: c.id, is_active: c.isActive, metric_type: c.metricType,
      max_value: c.maxValue, passing_value: c.passingValue,
    })));
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.getFinalResultStudents = async (req, res) => {
  try {
    const { config_id, branch_id } = req.query;
    if (!config_id || !branch_id) return sendBadRequest(res, 'config_id and branch_id are required.');

    const config = await prisma.finalResultConfig.findUnique({ where: { id: config_id } });
    if (!config) return sendNotFound(res, 'Config not found.');

    const coordinatorBranches = getCoordinatorBranches(req.user);
    const cb = coordinatorBranches.find((b) => {
      const bid = b.branch_id?._id || b.branch_id || b.branchId;
      return bid?.toString() === branch_id && b.year === config.year;
    });
    if (!cb) return sendBadRequest(res, 'You do not manage this branch for this year.');

    const students = await prisma.user.findMany({
      where: {
        branchId: branch_id,
        year: config.year,
        semester: config.semester,
        role: 'student',
        status: 'active',
      },
      select: { id: true, name: true, enrollmentNumber: true, year: true, semester: true, branchId: true, departmentId: true },
      orderBy: { name: 'asc' },
    });

    const studentIds = students.map((s) => s.id);
    const existingResults = await prisma.finalResult.findMany({
      where: { configId: config_id, studentId: { in: studentIds } },
    });

    const resultMap = {};
    existingResults.forEach((r) => { resultMap[r.studentId] = r; });

    const enriched = students.map((s) => ({
      _id: s.id, ...s, enrollment_number: s.enrollmentNumber,
      result: resultMap[s.id] || null,
    }));

    return sendSuccess(res, {
      config: { ...config, _id: config.id, is_active: config.isActive, metric_type: config.metricType, max_value: config.maxValue },
      students: enriched,
    });
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.submitFinalResults = async (req, res) => {
  try {
    const { config_id, branch_id, entries } = req.body;
    if (!config_id || !branch_id || !Array.isArray(entries) || entries.length === 0) {
      return sendBadRequest(res, 'config_id, branch_id, and entries[] are required.');
    }

    const config = await prisma.finalResultConfig.findUnique({ where: { id: config_id } });
    if (!config) return sendNotFound(res, 'Config not found.');

    const coordinatorBranches = getCoordinatorBranches(req.user);
    const cb = coordinatorBranches.find((b) => {
      const bid = b.branch_id?._id || b.branch_id || b.branchId;
      return bid?.toString() === branch_id && b.year === config.year;
    });
    if (!cb) return sendBadRequest(res, 'You do not manage this branch for this year.');

    const branch = await prisma.branch.findUnique({ where: { id: branch_id } });
    if (!branch) return sendNotFound(res, 'Branch not found.');

    for (const e of entries) {
      if (e.value < 0 || e.value > config.maxValue) {
        return sendBadRequest(res, `Value ${e.value} exceeds max ${config.maxValue} for config "${config.label}".`);
      }
    }

    const saved = await Promise.all(
      entries.map((e) => upsertResult({
        collegeId: req.user.collegeId,
        configId: config_id,
        studentId: e.student_id,
        branchId: branch_id,
        departmentId: branch.departmentId,
        year: config.year,
        semester: config.semester,
        value: Number(e.value),
        submittedBy: req.user.id,
      }))
    );

    return sendSuccess(res, { saved: saved.length }, `${saved.length} results saved.`);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.publishFinalResults = async (req, res) => {
  try {
    const { config_id, branch_id } = req.body;
    if (!config_id || !branch_id) return sendBadRequest(res, 'config_id and branch_id are required.');

    const config = await prisma.finalResultConfig.findUnique({ where: { id: config_id } });
    if (!config) return sendNotFound(res, 'Config not found.');

    const coordinatorBranches = getCoordinatorBranches(req.user);
    const cb = coordinatorBranches.find((b) => {
      const bid = b.branch_id?._id || b.branch_id || b.branchId;
      return bid?.toString() === branch_id && b.year === config.year;
    });
    if (!cb) return sendBadRequest(res, 'You do not manage this branch for this year.');

    const result = await publishResults(config_id, branch_id);
    return sendSuccess(res, { modified: result.count }, 'Results published successfully.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.unpublishFinalResults = async (req, res) => {
  try {
    const { config_id, branch_id } = req.body;
    if (!config_id || !branch_id) return sendBadRequest(res, 'config_id and branch_id are required.');

    const config = await prisma.finalResultConfig.findUnique({ where: { id: config_id } });
    if (!config) return sendNotFound(res, 'Config not found.');

    const coordinatorBranches = getCoordinatorBranches(req.user);
    const cb = coordinatorBranches.find((b) => {
      const bid = b.branch_id?._id || b.branch_id || b.branchId;
      return bid?.toString() === branch_id && b.year === config.year;
    });
    if (!cb) return sendBadRequest(res, 'You do not manage this branch for this year.');

    const result = await unpublishResults(config_id, branch_id);
    return sendSuccess(res, { modified: result.count }, 'Results unpublished.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * GET /coordinator/final-results/rankings?config_id=&scope=&branch_id=&department_id=&top=
 * Same signature as shared_finalresult.controller so FinalResultsRankings component works as-is.
 */
exports.getFinalResultRankings = async (req, res) => {
  try {
    const { config_id, scope = 'institute', branch_id, department_id, top } = req.query;
    if (!config_id) return sendBadRequest(res, 'config_id is required.');

    const config = await prisma.finalResultConfig.findUnique({ where: { id: config_id } });
    if (!config) return sendNotFound(res, 'Config not found.');

    const filter = {};
    if (scope === 'branch' && branch_id) {
      filter.branch_id = branch_id;
    } else if (scope === 'department' && department_id) {
      filter.department_id = department_id;
    }
    // scope === 'institute' or no id => no extra filter => all published results

    let ranked = await getRankedResults(config_id, filter);
    if (top) ranked = ranked.slice(0, Number(top));

    return sendSuccess(res, { config: { ...config, _id: config.id }, results: ranked });
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * GET /coordinator/final-results/branches
 * Returns ALL branches in the coordinator's department(s) — not just assigned ones.
 * This gives the Analytics tab the same scope HOD sees.
 */
exports.getFinalResultBranchesForCoord = async (req, res) => {
  try {
    const coordinatorBranches = getCoordinatorBranches(req.user);
    const assignedBranchIds = [
      ...new Set(
        coordinatorBranches
          .map((cb) => cb.branch_id?._id || cb.branch_id || cb.branchId)
          .filter(Boolean)
          .map(String)
      ),
    ];

    if (assignedBranchIds.length === 0) {
      return sendSuccess(res, { branches: [], departments: [] });
    }

    // Step 1: resolve the coordinator's assigned branches to their department ids
    const assignedBranches = await prisma.branch.findMany({
      where: { id: { in: assignedBranchIds } },
      select: { departmentId: true },
    });
    const deptIds = [...new Set(assignedBranches.map((b) => b.departmentId).filter(Boolean))];

    // Step 2: fetch ALL branches in those departments (same as HOD's getDeptBranches)
    const branches = await prisma.branch.findMany({
      where: { departmentId: { in: deptIds } },
      include: { department: { select: { id: true, name: true, code: true } } },
      orderBy: { name: 'asc' },
    });

    // Step 3: extract unique departments from those branches
    const deptSeen = new Set();
    const departments = [];
    branches.forEach((b) => {
      const d = b.department;
      if (d && !deptSeen.has(d.id)) {
        deptSeen.add(d.id);
        departments.push({ _id: d.id, ...d });
      }
    });

    return sendSuccess(res, {
      branches: branches.map((b) => ({
        _id: b.id, name: b.name, code: b.code,
        department_id: b.department ? { _id: b.departmentId, name: b.department.name, code: b.department.code } : b.departmentId,
      })),
      departments,
    });
  } catch (err) {
    return sendError(res, err.message);
  }
};