const FinalResultConfig = require('../models/FinalResultConfig');
const FinalResult = require('../models/FinalResult');
const { getRankedResults } = require('../services/finalResult.service');
const {
  sendSuccess, sendError, sendBadRequest, sendNotFound,
} = require('../utils/apiResponse');


exports.getPublishedConfigs = async (req, res) => {
  try {
    const filter = { is_active: true };
    if (req.query.year) filter.year = Number(req.query.year);
    if (req.query.semester) filter.semester = Number(req.query.semester);

    const configs = await FinalResultConfig.find(filter).sort({ year: 1, semester: 1 }).lean();

    // Only return configs that have at least one published result
    const configIds = configs.map((c) => c._id);
    const publishedConfigIds = await FinalResult.distinct('config_id', {
      config_id: { $in: configIds },
      is_published: true,
    });

    const publishedSet = new Set(publishedConfigIds.map((id) => id.toString()));
    const available = configs.filter((c) => publishedSet.has(c._id.toString()));

    return sendSuccess(res, available);
  } catch (err) {
    return sendError(res, err.message);
  }
};


exports.getFinalResultRankings = async (req, res) => {
  try {
    const { config_id, scope = 'institute', branch_id, department_id, top } = req.query;
    if (!config_id) return sendBadRequest(res, 'config_id is required.');

    const config = await FinalResultConfig.findById(config_id).lean();
    if (!config) return sendNotFound(res, 'Config not found.');

    // Build filter — all fields are optional; omitting them = broader scope
    const filter = {};
    if (scope === 'branch' && branch_id) {
      filter.branch_id = branch_id;
    } else if (scope === 'department' && department_id) {
      filter.department_id = department_id;
    }
    // scope === 'institute' OR scope with no id → no extra filter → all published results

    let ranked = await getRankedResults(config_id, filter);

    if (top) {
      ranked = ranked.slice(0, Number(top));
    }

    return sendSuccess(res, { config, results: ranked });
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * GET /student/final-results/mine?config_id=
 * Returns the student's own result + their rank in branch/dept/institute.
 */
exports.getStudentOwnResult = async (req, res) => {
  try {
    const { config_id } = req.query;
    if (!config_id) return sendBadRequest(res, 'config_id is required.');

    const studentId = req.user._id;

    const myResult = await FinalResult.findOne({
      config_id,
      student_id: studentId,
      is_published: true,
    })
      .populate('branch_id', 'name code')
      .populate('department_id', 'name code')
      .lean();

    if (!myResult) return sendNotFound(res, 'No published result found for you in this config.');

    // Compute ranks
    const [branchRank, deptRank, instituteRank] = await Promise.all([
      FinalResult.countDocuments({ config_id, branch_id: myResult.branch_id._id, value: { $gt: myResult.value }, is_published: true }),
      FinalResult.countDocuments({ config_id, department_id: myResult.department_id._id, value: { $gt: myResult.value }, is_published: true }),
      FinalResult.countDocuments({ config_id, value: { $gt: myResult.value }, is_published: true }),
    ]);

    const [branchTotal, deptTotal, instituteTotal] = await Promise.all([
      FinalResult.countDocuments({ config_id, branch_id: myResult.branch_id._id, is_published: true }),
      FinalResult.countDocuments({ config_id, department_id: myResult.department_id._id, is_published: true }),
      FinalResult.countDocuments({ config_id, is_published: true }),
    ]);

    return sendSuccess(res, {
      result: myResult,
      ranks: {
        branch: { rank: branchRank + 1, total: branchTotal },
        department: { rank: deptRank + 1, total: deptTotal },
        institute: { rank: instituteRank + 1, total: instituteTotal },
      },
    });
  } catch (err) {
    return sendError(res, err.message);
  }
};