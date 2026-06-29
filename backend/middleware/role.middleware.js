const { sendForbidden } = require('../utils/apiResponse');

/**
 * Restricts route access to one or more roles.
 * Usage: router.get('/route', authenticate, authorize('superadmin', 'hod'), controller)
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendForbidden(res, 'Access denied.');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendForbidden(
        res,
        `Access denied. Required role(s): ${allowedRoles.join(', ')}.`
      );
    }

    next();
  };
};

module.exports = { authorize };