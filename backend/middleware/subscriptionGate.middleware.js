const prisma = require('../config/prismaClient');

const READ_ONLY_SAFE_METHODS = new Set(['GET']);

async function subscriptionGate(req, res, next) {
  const collegeId = req.user?.collegeId;
  if (!collegeId) return next(); // not a tenant-scoped request, skip

  const college = await prisma.college.findUnique({ where: { id: collegeId } });
  if (!college) return res.status(404).json({ success: false, message: 'College not found' });

  if (college.lifecycleStatus === 'purged' || college.lifecycleStatus === 'soft_deleted') {
    return res.status(423).json({
      success: false,
      message: 'This college account has been deactivated by the platform administrator.',
    });
  }

  const now = new Date();
  const graceEnd = new Date(college.subscriptionEnd);
  graceEnd.setDate(graceEnd.getDate() + college.graceDays);

  if (college.subscriptionStatus === 'suspended') {
    return res.status(402).json({ success: false, message: 'This college account is suspended. Contact support.' });
  }

  if (now > college.subscriptionEnd) {
    // Past due. Within grace period: read-only. Past grace: fully locked, but data untouched.
    if (now <= graceEnd) {
      if (!READ_ONLY_SAFE_METHODS.has(req.method)) {
        return res.status(402).json({
          success: false,
          message: `Subscription expired ${college.subscriptionEnd.toDateString()}. Renew to regain full access. You have ${college.graceDays} grace days for read-only access.`,
        });
      }
      return next(); // allow read
    }

    return res.status(402).json({
      success: false,
      message: 'Subscription expired. All data is safely retained — contact the platform administrator to renew.',
    });
  }

  return next();
}

module.exports = subscriptionGate;