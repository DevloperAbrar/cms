const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

/**
 * Automatically creates an AuditLog entry after any mutating request.
 * Attach to routes via: router.post('/...', authenticate, auditLog('CREATE', 'User'), controller)
 *
 * @param {string} action - e.g. 'CREATE', 'UPDATE', 'DELETE', 'LOCK', 'UNLOCK', 'LOGIN'
 * @param {string} resourceType - e.g. 'User', 'Marks', 'Quiz'
 */
const auditLog = (action, resourceType) => {
  return async (req, res, next) => {
    // Store original json() to intercept the response
    const originalJson = res.json.bind(res);

    res.json = async function (body) {
      // Only log successful mutations (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        try {
          await AuditLog.create({
            actor_id: req.user._id === 'superadmin' ? null : req.user._id,
            actor_role: req.user.role,
            actor_name: req.user.name,
            action,
            resource_type: resourceType,
            resource_id: body?.data?._id || req.params?.id || null,
            ip_address: req.ip || req.connection?.remoteAddress,
            metadata: {
              method: req.method,
              path: req.path,
              body_keys: req.body ? Object.keys(req.body) : [],
            },
          });
        } catch (err) {
          // Audit failures must never break the response
          logger.error(`AuditLog write failed: ${err.message}`);
        }
      }

      return originalJson(body);
    };

    next();
  };
};

module.exports = { auditLog };