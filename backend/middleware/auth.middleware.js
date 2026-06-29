const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendUnauthorized } = require('../utils/apiResponse');
const { USER_STATUS, ROLES } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Verifies JWT from httpOnly cookie.
 * Attaches req.user on success.
 * SuperAdmin identity comes from env — no DB lookup needed.
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

    // SuperAdmin is a synthetic user from env — not stored in DB
    if (decoded.role === ROLES.SUPERADMIN) {
      req.user = {
        _id: 'superadmin',
        role: ROLES.SUPERADMIN,
        name: 'Super Admin',
        email: process.env.SUPERADMIN_EMAIL,
        status: USER_STATUS.ACTIVE,
      };
      req.isSuperAdmin = true;
      return next();
    }

    // All other roles — DB lookup
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