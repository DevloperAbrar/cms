const jwt = require('jsonwebtoken');
const User = require('../models/User');
const prisma = require('../config/prismaClient');
const { sendUnauthorized } = require('../utils/apiResponse');
const { USER_STATUS, ROLES } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Verifies JWT from httpOnly cookie.
 * Attaches req.user on success.
 * SuperAdmin now comes from Postgres (per-college row) — no longer synthetic.
 */
const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return sendUnauthorized(res, 'Authentication required. Please log in.');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return sendUnauthorized(res, 'Session expired or invalid. Please log in again.');
    }

    if (decoded.role === ROLES.SUPERADMIN) {
      const superadmin = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: { college: true },
      });

      if (!superadmin || superadmin.status !== 'active') {
        return sendUnauthorized(res, 'SuperAdmin account no longer exists or is inactive.');
      }

      if (superadmin.college.lifecycleStatus === 'purged' || superadmin.college.lifecycleStatus === 'soft_deleted') {
        return sendUnauthorized(res, 'This college account has been deactivated by the platform administrator.');
      }

      req.user = {
        _id: superadmin.id,
        role: ROLES.SUPERADMIN,
        name: superadmin.name,
        email: superadmin.email,
        status: superadmin.status,
        collegeId: superadmin.collegeId,
      };
      req.isSuperAdmin = true;
      return next();
    }

    // All other roles — unchanged, still MongoDB
    const user = await User.findById(decoded.id)
      .select('name email role status department_id branch_id year coordinator_branches')
      .populate('coordinator_branches.branch_id', '_id name')
      .lean();

    if (!user) {
      return sendUnauthorized(res, 'User no longer exists.');
    }

    if (user.status !== USER_STATUS.ACTIVE) {
      return sendUnauthorized(res, 'Your account is inactive. Contact your administrator.');
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error(`Auth middleware error: ${error.message}`);
    return sendUnauthorized(res, 'Authentication failed.');
  }
};

module.exports = { authenticate };