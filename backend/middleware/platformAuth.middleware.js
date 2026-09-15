const jwt = require('jsonwebtoken');

/**
 * Verifies a Platform Owner JWT. This is a completely separate auth track
 * from the college-scoped `auth.middleware.js` — platform owner has no
 * college_id and must never be treated as a tenant user.
 */
function platformAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Platform auth token missing' });
  }

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.PLATFORM_JWT_SECRET);
    if (payload.scope !== 'platform_owner') {
      return res.status(403).json({ success: false, message: 'Not a platform-level token' });
    }
    req.platformOwner = { email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired platform token' });
  }
}

module.exports = platformAuth;