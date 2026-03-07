const ApiResponse = require('../utils/response');

/**
 * Admin Access Control Middleware
 * Role-based access control for admin operations
 */

/**
 * Require admin role
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return ApiResponse.unauthorized(res, 'Authentication required');
  }

  if (req.user.role !== 'admin') {
    return ApiResponse.forbidden(
      res,
      'Admin access required'
    );
  }

  next();
};

/**
 * Require admin or self (for user-specific routes)
 */
const requireAdminOrSelf = (req, res, next) => {
  if (!req.user) {
    return ApiResponse.unauthorized(res, 'Authentication required');
  }

  const targetUserId = req.params.id || req.params.userId;

  // Allow if admin OR accessing own data
  if (req.user.role === 'admin' || req.user._id.toString() === targetUserId) {
    return next();
  }

  return ApiResponse.forbidden(
    res,
    'Access denied'
  );
};

module.exports = {
  requireAdmin,
  requireAdminOrSelf,
};
