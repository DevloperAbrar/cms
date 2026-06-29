const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const ParentToken = require('../models/ParentToken');
const { PARENT_TOKEN_EXPIRY_OPTIONS } = require('../config/constants');

/**
 * Generates a new parent token for a student.
 * Revokes any existing active token.
 * @param {ObjectId} studentId
 * @param {ObjectId} createdBy
 * @param {string} expiry - '30d' | '90d' | 'permanent'
 * @returns {string} raw JWT token
 */
const generateParentToken = async (studentId, createdBy, expiry = '30d') => {
  // Revoke existing tokens for this student
  await ParentToken.updateMany({ student_id: studentId }, { $set: { revoked: true } });

  let expiresAt = null;
  let jwtExpiry;

  if (expiry === PARENT_TOKEN_EXPIRY_OPTIONS.PERMANENT) {
    jwtExpiry = undefined; // no expiry in JWT
  } else {
    const days = expiry === PARENT_TOKEN_EXPIRY_OPTIONS.NINETY_DAYS ? 90 : 30;
    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    jwtExpiry = expiry;
  }

  const payload = { student_id: studentId.toString(), type: 'parent' };
  const tokenOptions = jwtExpiry ? { expiresIn: jwtExpiry } : {};
  const rawToken = jwt.sign(payload, process.env.PARENT_TOKEN_SECRET, tokenOptions);

  await ParentToken.create({
    student_id: studentId,
    token: rawToken,
    expires_at: expiresAt,
    revoked: false,
    created_by: createdBy,
  });

  return rawToken;
};

/**
 * Verifies a parent token and returns the student_id.
 * @param {string} rawToken
 * @returns {{ valid: boolean, studentId: string|null, error: string|null }}
 */
const verifyParentToken = async (rawToken) => {
  try {
    const decoded = jwt.verify(rawToken, process.env.PARENT_TOKEN_SECRET);

    if (decoded.type !== 'parent') {
      return { valid: false, studentId: null, error: 'Invalid token type.' };
    }

    const record = await ParentToken.findOne({ token: rawToken, revoked: false });
    if (!record) {
      return { valid: false, studentId: null, error: 'Token revoked or not found.' };
    }

    if (record.expires_at && record.expires_at < new Date()) {
      return { valid: false, studentId: null, error: 'Token expired.' };
    }

    return { valid: true, studentId: decoded.student_id, error: null };
  } catch (err) {
    return { valid: false, studentId: null, error: 'Invalid or expired token.' };
  }
};

/**
 * Revokes a parent token.
 */
const revokeParentToken = async (studentId) => {
  await ParentToken.updateMany({ student_id: studentId }, { $set: { revoked: true } });
};

module.exports = { generateParentToken, verifyParentToken, revokeParentToken };