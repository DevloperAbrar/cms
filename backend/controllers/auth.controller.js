const jwt = require('jsonwebtoken');
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
 * Authenticates SuperAdmin using env credentials.
 */
const superAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendBadRequest(res, 'Email and password are required.');
    }

    if (
      email.toLowerCase() !== process.env.SUPERADMIN_EMAIL.toLowerCase() ||
      password !== process.env.SUPERADMIN_PASSWORD
    ) {
      return sendUnauthorized(res, 'Invalid credentials.');
    }

    const token = jwt.sign(
      { role: ROLES.SUPERADMIN, email: process.env.SUPERADMIN_EMAIL },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || '7d' }
    );

    res.cookie('token', token, COOKIE_OPTIONS);

    logger.info(`SuperAdmin logged in from IP: ${req.ip}`);

    return sendSuccess(res, {
      role: ROLES.SUPERADMIN,
      name: 'Super Admin',
      email: process.env.SUPERADMIN_EMAIL,
    });
  } catch (error) {
    logger.error(`SuperAdmin login error: ${error.message}`);
    return sendUnauthorized(res, 'Login failed.');
  }
};

/**
 * GET /api/auth/google/callback (handled by Passport)
 * After successful OAuth, issues JWT and redirects to frontend.
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

    // Redirect to frontend — role-specific dashboard
    return res.redirect(`${process.env.CLIENT_URL}/auth/callback?role=${user.role}`);
  } catch (error) {
    logger.error(`Google callback error: ${error.message}`);
    return res.redirect(`${process.env.CLIENT_URL}/auth/error`);
  }
};

/**
 * POST /api/auth/logout
 * Clears the auth cookie.
 */
const logout = (_req, res) => {
  res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
  return sendSuccess(res, null, 'Logged out successfully.');
};

/**
 * GET /api/auth/me
 * Returns current authenticated user info.
 */
const getMe = (req, res) => {
  const { _id, name, email, role, department_id, branch_id, year, coordinator_branches } = req.user;
  return sendSuccess(res, { _id, name, email, role, department_id, branch_id, year, coordinator_branches });
};

module.exports = { superAdminLogin, googleCallback, logout, getMe };