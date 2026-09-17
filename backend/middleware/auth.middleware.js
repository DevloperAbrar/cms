// backend/middleware/auth.middleware.js

const jwt = require('jsonwebtoken');
const prisma = require('../config/prismaClient');

const ROLES = {
  SUPERADMIN: 'superadmin',
  HOD: 'hod',
  COORDINATOR: 'coordinator',
  FACULTY: 'faculty',
  EXAMCONTROLLER: 'examcontroller',
  STUDENT: 'student',
  PARENT: 'parent',
};

async function authenticate(req, res, next) {
  try {
    const token =
      req.cookies?.token ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null);

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Support both old Mongoose JWTs (_id) and new Prisma JWTs (id)
    const userId = decoded.id || decoded._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Invalid token payload' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { college: true },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Account is inactive' });
    }

    let coordinatorBranches = [];
    if (user.role === 'coordinator') {
      const rows = await prisma.coordinatorBranch.findMany({
        where: { userId: user.id },
        select: { branchId: true, year: true },
      });
      coordinatorBranches = rows.map((r) => ({ branch_id: r.branchId, year: r.year }));
    }

    // ── Auto-refresh cookie if token expires in less than 24 hours ──
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
    if (expiresIn < 60 * 60 * 24) {
      const newToken = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      res.cookie('token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
    // ────────────────────────────────────────────────────────────────

    req.user = {
      id: user.id,
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      collegeId: user.collegeId,
      college: user.college,
      departmentId: user.departmentId,
      branchId: user.branchId,
      year: user.year,
      semester: user.semester,
      section: user.section,
      enrollmentNumber: user.enrollmentNumber,
      coordinatorBranches,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    console.error('Auth middleware error:', err);
    return res.status(500).json({ success: false, message: 'Authentication error' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, authorize, ROLES };