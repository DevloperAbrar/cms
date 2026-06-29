const express = require('express');
const passport = require('passport');
const { superAdminLogin, googleCallback, logout, getMe } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// POST /api/auth/superadmin/login
router.post('/superadmin/login', superAdminLogin);

// GET /api/auth/google — initiates Google OAuth
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

// GET /api/auth/google/callback — Google returns here
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.CLIENT_URL}/auth/error` }),
  googleCallback
);

// POST /api/auth/logout
router.post('/logout', logout);

// GET /api/auth/me
router.get('/me', authenticate, getMe);

module.exports = router;