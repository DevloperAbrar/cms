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
    orderBy: { createdAt: 'desc' },
  });

  // Manual poster join (Notice has no @relation to User in schema)
  const posterIds = [...new Set(notices.map((n) => n.postedById).filter(Boolean))];
  const posters = posterIds.length
    ? await prisma.user.findMany({ where: { id: { in: posterIds } }, select: { id: true, name: true, role: true } })
    : [];
  const posterMap = Object.fromEntries(posters.map((p) => [p.id, p]));

  const userId = (user.id || user._id)?.toString();
  return notices.map((n) => {
    const poster = n.postedById ? posterMap[n.postedById] : null;
    return {
      ...n,
      _id: n.id,
      posted_by: poster ? { _id: n.postedById, name: poster.name, role: poster.role } : null,
      is_read: n.readBy?.includes(userId) || false,
      target_type: n.targetType,
      target_ids: n.targetIds,
      schedule_at: n.scheduleAt,
      expires_at: n.expiresAt,
      created_at: n.createdAt,
      updated_at: n.updatedAt,
    };
  });
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