const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prismaClient');
const { sendSuccess, sendUnauthorized, sendBadRequest } = require('../utils/apiResponse');
const { ROLES } = require('../config/constants');
const logger = require('../utils/logger');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * POST /api/auth/superadmin/login
 * Each college now has its own SuperAdmin row in Postgres — no longer a
 * single global env-based account.
 */
const superAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendBadRequest(res, 'Email and password are required.');
    }

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), role: ROLES.SUPERADMIN },
      include: { college: true },
    });

    if (!user || !user.passwordHash) {
      return sendUnauthorized(res, 'Invalid credentials.');
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return sendUnauthorized(res, 'Invalid credentials.');
    }

    if (user.status !== 'active') {
      return sendUnauthorized(res, 'Your account is inactive. Contact the platform administrator.');
    }

    if (user.college.lifecycleStatus === 'purged' || user.college.lifecycleStatus === 'soft_deleted') {
      return sendUnauthorized(res, 'This college account has been deactivated. Contact the platform administrator.');
    }

    const token = jwt.sign(
      { id: user.id, role: ROLES.SUPERADMIN, collegeId: user.collegeId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || '7d' }
    );

    res.cookie('token', token, COOKIE_OPTIONS);

    logger.info(`SuperAdmin logged in from IP: ${req.ip} (college: ${user.collegeId})`);

    return sendSuccess(res, {
      role: ROLES.SUPERADMIN,
      name: user.name,
      email: user.email,
      collegeId: user.collegeId,
      collegeName: user.college.name,
    });
  } catch (error) {
    logger.error(`SuperAdmin login error: ${error.message}`);
    return sendUnauthorized(res, 'Login failed.');
  }
};

/**
 * GET /api/auth/google/callback (handled by Passport)
 * Unchanged — hod/coordinator/faculty/student/parent still authenticate
 * via MongoDB exactly as before.
 */
const googleCallback = (req, res) => {
  try {
    const user = req.user;

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || '7d' }
    );

    res.cookie('token', token, COOKIE_OPTIONS);
    logger.info(`${user.role} logged in via Google: ${user.email}`);

    return res.redirect(`${process.env.CLIENT_URL}/auth/callback?role=${user.role}`);
  } catch (error) {
    logger.error(`Google callback error: ${error.message}`);
    return res.redirect(`${process.env.CLIENT_URL}/auth/error`);
  }
};

/**
 * POST /api/auth/logout
 */
const logout = (_req, res) => {
  res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
  return sendSuccess(res, null, 'Logged out successfully.');
};

/**
 * GET /api/auth/me
 */
const getMe = (req, res) => {
  const { _id, name, email, role, department_id, branch_id, year, coordinator_branches, collegeId } = req.user;
  return sendSuccess(res, { _id, name, email, role, department_id, branch_id, year, coordinator_branches, collegeId });
};

module.exports = { superAdminLogin, googleCallback, logout, getMe };