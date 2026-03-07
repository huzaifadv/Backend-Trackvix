const ApiResponse = require('../utils/response');
const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const logger = require('../config/logger');

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.unauthorized(res, 'No token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      return ApiResponse.unauthorized(res, error.message);
    }

    // Find user and attach to request
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return ApiResponse.unauthorized(res, 'User not found or inactive');
    }

    // Attach user to request object
    req.user = user;
    req.userId = user._id;

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return ApiResponse.internalError(res, 'Authentication failed');
  }
};

/**
 * Role-based authorization middleware
 * @param  {...String} allowedRoles - Roles that are allowed to access
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return ApiResponse.unauthorized(res, 'Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return ApiResponse.forbidden(res, 'Insufficient permissions');
    }

    next();
  };
};

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    try {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.userId);

      if (user && user.isActive) {
        req.user = user;
        req.userId = user._id;
      }
    } catch (error) {
      // Token invalid but continue anyway
      logger.debug('Optional auth failed, continuing without user');
    }

    next();
  } catch (error) {
    next();
  }
};

/**
 * Require email verification middleware
 * Must be used after authenticate middleware
 */
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return ApiResponse.unauthorized(res, 'Authentication required');
  }

  if (!req.user.isEmailVerified) {
    return ApiResponse.forbidden(
      res,
      'Email verification required. Please verify your email to access this resource.'
    );
  }

  next();
};

/**
 * Require not suspended middleware
 * Must be used after authenticate middleware
 */
const requireNotSuspended = (req, res, next) => {
  if (!req.user) {
    return ApiResponse.unauthorized(res, 'Authentication required');
  }

  if (req.user.isSuspended) {
    return ApiResponse.forbidden(
      res,
      'Your account has been suspended. Please contact support for assistance.'
    );
  }

  next();
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth,
  requireEmailVerification,
  requireNotSuspended,
};
