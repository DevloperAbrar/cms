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
          email: adminEmail.toLowerCase(),
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

  await prisma.college.update({ where: { id: collegeId }, data: { lifecycleStatus: 'purged' } });

  return res.json({ success: true, message: 'College purged' });
}

async function updateCollege(req, res) {
  const { collegeId } = req.params;
  const { name, code, contactEmail, contactPhone, subscriptionPlan } = req.body;

  const college = await prisma.college.findUnique({ where: { id: collegeId } });
  if (!college) return res.status(404).json({ success: false, message: 'College not found' });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.college.update({
        where: { id: collegeId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(code !== undefined ? { code: code.toLowerCase().trim() } : {}),
          ...(contactEmail !== undefined ? { contactEmail } : {}),
          ...(contactPhone !== undefined ? { contactPhone } : {}),
          ...(subscriptionPlan !== undefined ? { subscriptionPlan } : {}),
        },
      });
      await tx.subscriptionEvent.create({
        data: { collegeId, action: 'details_updated', actor: 'platform_owner' },
      });
      return c;
    });

    return res.json({ success: true, data: updated });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'That college code is already in use' });
    }
    console.error(err);
    return res.status(500).json({ success: false, message: 'Failed to update college' });
  }
}

async function listColleges(req, res) {
  const colleges = await prisma.college.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { users: true } } },
  });
  return res.json({ success: true, data: colleges });
}

// ---------- CREDENTIALS ----------

function generateRandomPassword(length = 14) {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let pwd = '';
  for (let i = 0; i < length; i++) {
    pwd += charset[Math.floor(Math.random() * charset.length)];
  }
  return pwd;
}

/**
 * Resets a college's SuperAdmin email/password. If newPassword isn't given,
 * a random one is generated and returned ONCE in the response, it is never
 * stored or logged in plaintext anywhere.
 */
async function regenerateSuperAdminPassword(req, res) {
  const { collegeId } = req.params;
  const { newPassword, newEmail } = req.body;

  try {
    const superadmin = await prisma.user.findFirst({ where: { collegeId, role: 'superadmin' } });
    if (!superadmin) {
      return res.status(404).json({ success: false, message: 'No SuperAdmin found for this college' });
    }

    const passwordToSet = newPassword || generateRandomPassword();
    const passwordHash = await bcrypt.hash(passwordToSet, 12);

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: superadmin.id },
        data: {
          passwordHash,
          ...(newEmail ? { email: newEmail.toLowerCase() } : {}),
        },
      });
      await tx.subscriptionEvent.create({
        data: {
          collegeId,
          action: 'credentials_regenerated',
          actor: 'platform_owner',
          note: newEmail ? 'Email and password reset' : 'Password reset',
        },
      });
      return u;
    });

    return res.json({
      success: true,
      data: {
        email: updated.email,
        generatedPassword: newPassword ? undefined : passwordToSet,
      },
      message: 'Credentials regenerated. Store this password now, it will not be shown again.',
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'That email is already in use by another college' });
    }
    console.error(err);
    return res.status(500).json({ success: false, message: 'Failed to regenerate credentials' });
  }
}

module.exports = {
  login,
  createCollege,
  updateCollege,
  renewSubscription,
  suspendCollege,
  softDeleteCollege,
  reactivateCollege,
  purgeCollege,
  listColleges,
  regenerateSuperAdminPassword,
};