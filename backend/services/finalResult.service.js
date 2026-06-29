const FinalResult = require('../models/FinalResult');
const FinalResultConfig = require('../models/FinalResultConfig');
const User = require('../models/User');

/**
 * Fetch published results for a config, enriched with student info,
 * sorted descending by value, with rank assigned.
 */
const getRankedResults = async (configId, filter = {}) => {
  const query = { config_id: configId, is_published: true, ...filter };
  const results = await FinalResult.find(query)
    .populate('student_id', 'name enrollment_number branch_id department_id year semester')
    .populate('branch_id', 'name code')
    .populate('department_id', 'name code')
    .sort({ value: -1 })
    .lean();

  return results.map((r, idx) => ({ ...r, rank: idx + 1 }));
};

/**
 * Upsert a single student result (coordinator save).
 */
const upsertResult = async ({ configId, studentId, branchId, departmentId, year, semester, value, submittedBy }) => {
  const result = await FinalResult.findOneAndUpdate(
    { config_id: configId, student_id: studentId },
    {
      $set: {
        branch_id: branchId,
        department_id: departmentId,
        year,
        semester,
        value,
        submitted_by: submittedBy,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return result;
};

/**
 * Publish all results for a config scoped to a branch (coordinator action).
 */
const publishResults = async (configId, branchId) => {
  const result = await FinalResult.updateMany(
    { config_id: configId, branch_id: branchId },
    { $set: { is_published: true, published_at: new Date() } }
  );
  return result;
};

/**
 * Unpublish all results for a config scoped to a branch.
 */
const unpublishResults = async (configId, branchId) => {
  const result = await FinalResult.updateMany(
    { config_id: configId, branch_id: branchId },
    { $set: { is_published: false, published_at: null } }
  );
  return result;
};

module.exports = { getRankedResults, upsertResult, publishResults, unpublishResults };