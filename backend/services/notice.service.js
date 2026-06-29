const Notice = require('../models/Notice');
const { NOTICE_TARGET_TYPE } = require('../config/constants');

/**
 * Retrieves notices visible to a given user based on their role + scope.
 * @param {object} user - { _id, role, department_id, branch_id, year }
 * @returns {Array} notices
 */
const getNoticesForUser = async (user) => {
  const now = new Date();

  const orConditions = [
    { target_type: NOTICE_TARGET_TYPE.ALL },
    { target_type: NOTICE_TARGET_TYPE.INDIVIDUAL, target_ids: user._id },
  ];

  if (user.department_id) {
    orConditions.push({
      target_type: NOTICE_TARGET_TYPE.DEPARTMENT,
      target_ids: user.department_id,
    });
  }

  if (user.branch_id) {
    orConditions.push({ target_type: NOTICE_TARGET_TYPE.BRANCH, target_ids: user.branch_id });
  }

  if (user.year) {
    orConditions.push({ target_type: NOTICE_TARGET_TYPE.YEAR, target_ids: user.year });
  }

  const notices = await Notice.find({
    $or: orConditions,
    $and: [
      { $or: [{ schedule_at: null }, { schedule_at: { $lte: now } }] },
      { $or: [{ expires_at: null }, { expires_at: { $gte: now } }] },
    ],
  })
    .populate('posted_by', 'name role')
    .sort({ created_at: -1 })
    .lean();

  // Attach read status
  return notices.map((n) => ({
    ...n,
    is_read: n.read_by?.some((id) => id.toString() === user._id?.toString()) || false,
  }));
};

/**
 * Marks a notice as read by the user.
 */
const markAsRead = async (noticeId, userId) => {
  await Notice.findByIdAndUpdate(noticeId, { $addToSet: { read_by: userId } });
};

module.exports = { getNoticesForUser, markAsRead };