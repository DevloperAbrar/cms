const jwt = require('jsonwebtoken');
const prisma = require('../config/prismaClient');
const { PARENT_TOKEN_EXPIRY_OPTIONS } = require('../config/constants');

const generateParentToken = async (studentId, createdBy, expiry = '30d', collegeId) => {
  // Revoke existing tokens for this student
  await prisma.parentToken.updateMany({
    where: { studentId },
    data: { revoked: true },
  });

  let expiresAt = null;
  let jwtExpiry;

  if (expiry === PARENT_TOKEN_EXPIRY_OPTIONS.PERMANENT) {
    jwtExpiry = undefined;
  } else {
    const days = expiry === PARENT_TOKEN_EXPIRY_OPTIONS.NINETY_DAYS ? 90 : 30;
    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    jwtExpiry = expiry;
  }

  const payload = { student_id: studentId, type: 'parent' };
  const tokenOptions = jwtExpiry ? { expiresIn: jwtExpiry } : {};
  const rawToken = jwt.sign(payload, process.env.PARENT_TOKEN_SECRET, tokenOptions);

  await prisma.parentToken.create({
    data: {
      collegeId,
      studentId,
      token: rawToken,
      expiresAt,
      revoked: false,
      createdById: createdBy,
    },
  });

  return rawToken;
};

const verifyParentToken = async (rawToken) => {
  try {
    const decoded = jwt.verify(rawToken, process.env.PARENT_TOKEN_SECRET);

    if (decoded.type !== 'parent') {
      return { valid: false, studentId: null, error: 'Invalid token type.' };
    }

    const record = await prisma.parentToken.findUnique({
      where: { token: rawToken },
    });

    if (!record || record.revoked) {
      return { valid: false, studentId: null, error: 'Token revoked or not found.' };
    }

    if (record.expiresAt && record.expiresAt < new Date()) {
      return { valid: false, studentId: null, error: 'Token expired.' };
    }

    return { valid: true, studentId: decoded.student_id, error: null };
  } catch (err) {
    return { valid: false, studentId: null, error: 'Invalid or expired token.' };
  }
};

const revokeParentToken = async (studentId) => {
  await prisma.parentToken.updateMany({
    where: { studentId },
    data: { revoked: true },
  });
};

module.exports = { generateParentToken, verifyParentToken, revokeParentToken };