const logger = require('../config/logger');
const ApiResponse = require('../utils/response');

/**
 * Global Error Handling Middleware
 * Catches all errors and returns consistent response format
 */

/**
 * 404 Not Found Handler
 * Must be placed after all routes
 */
const notFoundHandler = (req, res, next) => {
  return ApiResponse.notFound(res, `Route ${req.originalUrl} not found`);
};

/**
 * Global Error Handler
 * Must be placed after notFoundHandler
 */
const errorHandler = (err, req, res, next) => {
  // Log error details
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.userId || 'unauthenticated',
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(error => ({
      field: error.path,
      message: error.message,
    }));
    return ApiResponse.validationError(res, errors, 'Validation failed');
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return ApiResponse.conflict(res, `${field} already exists`);
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return ApiResponse.badRequest(res, 'Invalid resource ID');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return ApiResponse.unauthorized(res, 'Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    return ApiResponse.unauthorized(res, 'Token expired');
  }

  // CSRF token errors
  if (err.code === 'EBADCSRFTOKEN') {
    return ApiResponse.forbidden(res, 'Invalid CSRF token');
  }

  // Custom operational errors
  if (err.isOperational) {
    return ApiResponse.error(res, err.statusCode || 500, err.message);
  }

  // Default to 500 Internal Server Error
  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  return ApiResponse.internalError(res, message);
};

/**
 * Async Error Handler Wrapper
 * Wraps async route handlers to catch errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Custom Error Class for Operational Errors
 */
class OperationalError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  notFoundHandler,
  errorHandler,
  asyncHandler,
  OperationalError,
};
