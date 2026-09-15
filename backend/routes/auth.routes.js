const express = require('express');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { superAdminLogin, googleCallback, logout, getMe } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const prisma = require('../config/prismaClient');

const router = express.Router();

// POST /api/auth/superadmin/login — kept for backward compat
router.post('/superadmin/login', superAdminLogin);

// POST /api/auth/login — unified login for all college roles (new)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password required' });
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        status: 'active',
      },
      include: {
        college: true,
        coordinatorBranches: true,
      },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Block if college is deactivated or purged
    if (user.college) {
      if (['soft_deleted', 'purged'].includes(user.college.lifecycleStatus)) {
        return res.status(402).json({
          success: false,
          message: 'College account has been deactivated. Contact the platform administrator.',
        });
      }
      if (user.college.subscriptionStatus === 'suspended') {
        return res.status(402).json({
          success: false,
          message: 'College subscription is suspended. Contact the platform administrator.',
        });
      }
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, collegeId: user.collegeId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date(), lastLoginIp: req.ip },
    });

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          _id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          collegeId: user.collegeId,
          departmentId: user.departmentId,
          branchId: user.branchId,
          year: user.year,
          semester: user.semester,
          section: user.section,
          enrollmentNumber: user.enrollmentNumber,
          coordinatorBranches: user.coordinatorBranches || [],
          college: user.college
            ? { name: user.college.name, code: user.college.code }
            : null,
        },
        token,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// GET /api/auth/google
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

// GET /api/auth/google/callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/auth/error`,
  }),
  googleCallback
);

// POST /api/auth/logout
router.post('/logout', logout);

// GET /api/auth/me
router.get('/me', authenticate, getMe);

module.exports = router;