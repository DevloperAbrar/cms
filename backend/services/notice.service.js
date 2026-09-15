const prisma = require('../config/prismaClient');

const getNoticesForUser = async (user) => {
  const now = new Date();

  const orConditions = [
    { targetType: 'all' },
    { targetType: 'individual', targetIds: { has: user.id || user._id?.toString() } },
  ];

  if (user.departmentId || user.department_id) {
    orConditions.push({
      targetType: 'department',
      targetIds: { has: (user.departmentId || user.department_id)?.toString() },
    });
  }

  if (user.branchId || user.branch_id) {
    orConditions.push({
      targetType: 'branch',
      targetIds: { has: (user.branchId || user.branch_id)?.toString() },
    });
  }

  if (user.year) {
    orConditions.push({
      targetType: 'year',
      targetIds: { has: String(user.year) },
    });
  }

  const notices = await prisma.notice.findMany({
    where: {
      collegeId: user.collegeId,
      OR: orConditions,
      AND: [
        { OR: [{ scheduleAt: null }, { scheduleAt: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
      ],
    },
    include: {
      postedBy: { select: { name: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const userId = (user.id || user._id)?.toString();
  return notices.map((n) => ({
    ...n,
    _id: n.id,
    posted_by: n.postedBy ? { _id: n.postedById, name: n.postedBy.name, role: n.postedBy.role } : null,
    is_read: n.readBy?.includes(userId) || false,
    target_type: n.targetType,
    target_ids: n.targetIds,
    schedule_at: n.scheduleAt,
    expires_at: n.expiresAt,
    created_at: n.createdAt,
    updated_at: n.updatedAt,
  }));
};

const markAsRead = async (noticeId, userId) => {
  const notice = await prisma.notice.findUnique({ where: { id: noticeId } });
  if (!notice) return;

  if (!notice.readBy.includes(userId.toString())) {
    await prisma.notice.update({
      where: { id: noticeId },
      data: { readBy: { push: userId.toString() } },
    });
  }
};

module.exports = { getNoticesForUser, markAsRead };