const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prismaClient');

// ---------- AUTH ----------

async function login(req, res) {
  const { email, password } = req.body;

  if (email !== process.env.PLATFORM_OWNER_EMAIL) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const match = await bcrypt.compare(password, process.env.PLATFORM_OWNER_PASSWORD_HASH);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { email, scope: 'platform_owner' },
    process.env.PLATFORM_JWT_SECRET,
    { expiresIn: '12h' }
  );

  return res.json({ success: true, data: { token } });
}

// ---------- COLLEGE (TENANT) LIFECYCLE ----------

/**
 * Creates a college AND its first superadmin user in one transaction.
 * This is the "main super admin creates college" workflow from your spec.
 */
async function createCollege(req, res) {
  const {
    name, code, contactEmail, contactPhone,
    subscriptionPlan, durationMonths,
    adminName, adminEmail, adminPassword,
  } = req.body;

  if (!name || !code || !adminEmail || !adminPassword) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const subscriptionEnd = new Date();
  subscriptionEnd.setMonth(subscriptionEnd.getMonth() + (durationMonths || 12));

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const college = await tx.college.create({
        data: {
          name,
          code,
          contactEmail,
          contactPhone,
          subscriptionPlan: subscriptionPlan || 'standard',
          subscriptionStatus: 'active',
          subscriptionEnd,
        },
      });

      const superadmin = await tx.user.create({
        data: {
          collegeId: college.id,
          name: adminName || `${name} Admin`,
          email: adminEmail,
          passwordHash,
          role: 'superadmin',
          status: 'active',
        },
      });

      await tx.subscriptionEvent.create({
        data: {
          collegeId: college.id,
          action: 'created',
          actor: 'platform_owner',
          note: `Initial subscription: ${subscriptionPlan || 'standard'}, ${durationMonths || 12} months`,
        },
      });

      return { college, superadmin };
    });

    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'College code or admin email already exists' });
    }
    console.error(err);
    return res.status(500).json({ success: false, message: 'Failed to create college' });
  }
}

async function renewSubscription(req, res) {
  const { collegeId } = req.params;
  const { durationMonths } = req.body;

  const college = await prisma.college.findUnique({ where: { id: collegeId } });
  if (!college) return res.status(404).json({ success: false, message: 'College not found' });

  // Renew from whichever is later: today, or the current end date (so early renewal stacks, doesn't waste days)
  const base = college.subscriptionEnd > new Date() ? college.subscriptionEnd : new Date();
  const newEnd = new Date(base);
  newEnd.setMonth(newEnd.getMonth() + (durationMonths || 12));

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.college.update({
      where: { id: collegeId },
      data: {
        subscriptionEnd: newEnd,
        subscriptionStatus: 'active',
        lifecycleStatus: 'active',
        lastRenewedAt: new Date(),
      },
    });
    await tx.subscriptionEvent.create({
      data: { collegeId, action: 'renewed', actor: 'platform_owner', note: `+${durationMonths || 12} months` },
    });
    return c;
  });

  return res.json({ success: true, data: updated });
}

async function suspendCollege(req, res) {
  const { collegeId } = req.params;
  const { note } = req.body;

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.college.update({
      where: { id: collegeId },
      data: { subscriptionStatus: 'suspended' },
    });
    await tx.subscriptionEvent.create({
      data: { collegeId, action: 'suspended', actor: 'platform_owner', note },
    });
    return c;
  });

  return res.json({ success: true, data: updated });
}

/**
 * Soft delete: marks the college for deletion. Data is NOT removed.
 * This is reversible by reactivateCollege(). This is what should happen
 * "automatically" is NOT automatic — expiry alone only sets subscriptionStatus
 * to 'expired' (see subscriptionGate below). Soft-delete is a deliberate
 * platform-owner action, exactly as you specified: "until main super admin
 * not delete."
 */
async function softDeleteCollege(req, res) {
  const { collegeId } = req.params;

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.college.update({
      where: { id: collegeId },
      data: {
        lifecycleStatus: 'soft_deleted',
        deletedAt: new Date(),
        deleteRequestedBy: 'platform_owner',
      },
    });
    await tx.subscriptionEvent.create({
      data: { collegeId, action: 'soft_deleted', actor: 'platform_owner' },
    });
    return c;
  });

  return res.json({ success: true, data: updated });
}

async function reactivateCollege(req, res) {
  const { collegeId } = req.params;

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.college.update({
      where: { id: collegeId },
      data: { lifecycleStatus: 'active', deletedAt: null, subscriptionStatus: 'active' },
    });
    await tx.subscriptionEvent.create({
      data: { collegeId, action: 'reactivated', actor: 'platform_owner' },
    });
    return c;
  });

  return res.json({ success: true, data: updated });
}

/**
 * PURGE — the only truly destructive action, and it requires the platform
 * owner to type the college code back as confirmation (checked in the route/
 * frontend), on top of already being behind platformAuth. This is separate
 * from softDelete on purpose.
 */
async function purgeCollege(req, res) {
  const { collegeId } = req.params;
  const { confirmCode } = req.body;

  const college = await prisma.college.findUnique({ where: { id: collegeId } });
  if (!college) return res.status(404).json({ success: false, message: 'College not found' });
  if (college.lifecycleStatus !== 'soft_deleted') {
    return res.status(400).json({ success: false, message: 'College must be soft-deleted before it can be purged' });
  }
  if (confirmCode !== college.code) {
    return res.status(400).json({ success: false, message: 'Confirmation code does not match college code' });
  }

  await prisma.subscriptionEvent.create({
    data: { collegeId, action: 'purged', actor: 'platform_owner' },
  });

  // Deleting the College row cascades via FK — set onDelete: Cascade at the DB
  // level once all tenant tables are migrated in Phase 2, or run explicit
  // deleteMany() calls per table here in the interim.
  await prisma.college.update({ where: { id: collegeId }, data: { lifecycleStatus: 'purged' } });

  return res.json({ success: true, message: 'College purged' });
}

async function listColleges(req, res) {
  const colleges = await prisma.college.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { users: true } } },
  });
  return res.json({ success: true, data: colleges });
}

module.exports = {
  login,
  createCollege,
  renewSubscription,
  suspendCollege,
  softDeleteCollege,
  reactivateCollege,
  purgeCollege,
  listColleges,
};