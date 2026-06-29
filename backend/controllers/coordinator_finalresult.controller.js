const FinalResultConfig = require('../models/FinalResultConfig');
const FinalResult = require('../models/FinalResult');
const User = require('../models/User');
const Branch = require('../models/Branch');
const { upsertResult, publishResults, unpublishResults, getRankedResults } = require('../services/finalResult.service');
const {
  sendSuccess, sendError, sendBadRequest, sendNotFound,
} = require('../utils/apiResponse');

exports.getFinalResultConfigs = async (req, res) => {
  try {
    const coordinatorBranches = req.user.coordinator_branches || [];
    const years = [...new Set(coordinatorBranches.map((b) => b.year))];
    const configs = await FinalResultConfig.find({ year: { $in: years }, is_active: true })
      .sort({ year: 1, semester: 1 })
      .lean();
    return sendSuccess(res, configs);
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.getFinalResultStudents = async (req, res) => {
  try {
    const { config_id, branch_id } = req.query;
    if (!config_id || !branch_id) return sendBadRequest(res, 'config_id and branch_id are required.');

    const config = await FinalResultConfig.findById(config_id).lean();
    if (!config) return sendNotFound(res, 'Config not found.');

    const cb = (req.user.coordinator_branches || []).find(
      (b) => (b.branch_id?._id || b.branch_id)?.toString() === branch_id && b.year === config.year
    );
    if (!cb) return sendBadRequest(res, 'You do not manage this branch for this year.');

    const students = await User.find({
      branch_id,
      year: config.year,
      semester: config.semester,
      role: 'student',
      status: 'active',
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

exports.submitFinalResults = async (req, res) => {
  try {
    const { config_id, branch_id, entries } = req.body;
    if (!config_id || !branch_id || !Array.isArray(entries) || entries.length === 0) {
      return sendBadRequest(res, 'config_id, branch_id, and entries[] are required.');
    }

    const config = await FinalResultConfig.findById(config_id).lean();
    if (!config) return sendNotFound(res, 'Config not found.');

    const cb = (req.user.coordinator_branches || []).find(
      (b) => (b.branch_id?._id || b.branch_id)?.toString() === branch_id && b.year === config.year
    );
    if (!cb) return sendBadRequest(res, 'You do not manage this branch for this year.');

    const branch = await Branch.findById(branch_id).lean();
    if (!branch) return sendNotFound(res, 'Branch not found.');

    for (const e of entries) {
      if (e.value < 0 || e.value > config.max_value) {
        return sendBadRequest(res, `Value ${e.value} exceeds max ${config.max_value} for config "${config.label}".`);
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

exports.publishFinalResults = async (req, res) => {
  try {
    const { config_id, branch_id } = req.body;
    if (!config_id || !branch_id) return sendBadRequest(res, 'config_id and branch_id are required.');

    const config = await FinalResultConfig.findById(config_id).lean();
    if (!config) return sendNotFound(res, 'Config not found.');

    const cb = (req.user.coordinator_branches || []).find(
      (b) => (b.branch_id?._id || b.branch_id)?.toString() === branch_id && b.year === config.year
    );
    if (!cb) return sendBadRequest(res, 'You do not manage this branch for this year.');

    const result = await publishResults(config_id, branch_id);
    return sendSuccess(res, { modified: result.modifiedCount }, 'Results published successfully.');
  } catch (err) {
    return sendError(res, err.message);
  }
};

exports.unpublishFinalResults = async (req, res) => {
  try {
    const { config_id, branch_id } = req.body;
    if (!config_id || !branch_id) return sendBadRequest(res, 'config_id and branch_id are required.');

    const config = await FinalResultConfig.findById(config_id).lean();
    if (!config) return sendNotFound(res, 'Config not found.');

    const cb = (req.user.coordinator_branches || []).find(
      (b) => (b.branch_id?._id || b.branch_id)?.toString() === branch_id && b.year === config.year
    );
    if (!cb) return sendBadRequest(res, 'You do not manage this branch for this year.');

    const result = await unpublishResults(config_id, branch_id);
    return sendSuccess(res, { modified: result.modifiedCount }, 'Results unpublished.');
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

    const config = await FinalResultConfig.findById(config_id).lean();
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

    return sendSuccess(res, { config, results: ranked });
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
    // Step 1: get coordinator's assigned branch docs to find their department_id(s)
    const coordinator = await User.findById(req.user._id)
      .populate('coordinator_branches.branch_id', 'department_id')
      .lean();

    if (!coordinator) return sendNotFound(res, 'Coordinator not found');

    const deptIds = [
      ...new Set(
        (coordinator.coordinator_branches || [])
          .map((cb) => cb.branch_id?.department_id)
          .filter(Boolean)
          .map(String)
      ),
    ];

    // Step 2: fetch ALL branches in those departments (same as HOD's getDeptBranches)
    const branches = await Branch.find({ department_id: { $in: deptIds } })
      .select('name code department_id')
      .populate('department_id', 'name code')
      .sort({ name: 1 })
      .lean();

    // Step 3: extract unique departments from those branches
    const deptSeen = new Set();
    const departments = [];
    branches.forEach((b) => {
      const d = b.department_id;
      if (d && !deptSeen.has(String(d._id))) {
        deptSeen.add(String(d._id));
        departments.push(d);
      }
    });

    return sendSuccess(res, { branches, departments });
  } catch (err) {
    return sendError(res, err);
  }
};