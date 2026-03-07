/**
 * Standardized API Response Utility
 * Consistent response structure across all endpoints
 */

class ApiResponse {
  /**
   * Success response
   * @param {Object} res - Express response object
   * @param {Number|String} statusCodeOrMessage - HTTP status code or message (if string, statusCode defaults to 200)
   * @param {String|Object} messageOrData - Success message or data
   * @param {Object} data - Response data (optional)
   */
  static success(res, statusCodeOrMessage = 200, messageOrData = 'Success', data = null) {
    // Handle flexible parameter order: allow (res, message, data) or (res, statusCode, message, data)
    let statusCode, message;

    if (typeof statusCodeOrMessage === 'string') {
      // Called as: success(res, message, data)
      statusCode = 200;
      message = statusCodeOrMessage;
      data = messageOrData;
    } else {
      // Called as: success(res, statusCode, message, data)
      statusCode = statusCodeOrMessage;
      message = messageOrData;
    }

    const response = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    };

    return res.status(statusCode).json(response);
  }

  /**
   * Error response
   * @param {Object} res - Express response object
   * @param {Number|String} statusCodeOrMessage - HTTP status code or message (if string, statusCode defaults to 500)
   * @param {String|Object} messageOrErrors - Error message or errors object
   * @param {Object} errors - Validation errors or error details (optional)
   */
  static error(res, statusCodeOrMessage = 500, messageOrErrors = 'Internal Server Error', errors = null) {
    // Handle flexible parameter order: allow (res, message, errors) or (res, statusCode, message, errors)
    let statusCode, message;

    if (typeof statusCodeOrMessage === 'string') {
      // Called as: error(res, message, errors)
      statusCode = 500;
      message = statusCodeOrMessage;
      errors = messageOrErrors;
    } else {
      // Called as: error(res, statusCode, message, errors)
      statusCode = statusCodeOrMessage;
      message = messageOrErrors;
    }

    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString(),
    };

    if (errors) {
      response.errors = errors;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Created response (201)
   */
  static created(res, message = 'Resource created successfully', data = null) {
    return this.success(res, 201, message, data);
  }

  /**
   * No content response (204)
   */
  static noContent(res) {
    return res.status(204).send();
  }

  /**
   * Bad request response (400)
   */
  static badRequest(res, message = 'Bad request', errors = null) {
    return this.error(res, 400, message, errors);
  }

  /**
   * Unauthorized response (401)
   */
  static unauthorized(res, message = 'Unauthorized') {
    return this.error(res, 401, message);
  }

  /**
   * Forbidden response (403)
   */
  static forbidden(res, message = 'Forbidden') {
    return this.error(res, 403, message);
  }

  /**
   * Not found response (404)
   */
  static notFound(res, message = 'Resource not found') {
    return this.error(res, 404, message);
  }

  /**
   * Conflict response (409)
   */
  static conflict(res, message = 'Resource conflict') {
    return this.error(res, 409, message);
  }

  /**
   * Validation error response (422)
   */
  static validationError(res, errors, message = 'Validation failed') {
    return this.error(res, 422, message, errors);
  }

  /**
   * Too many requests response (429)
   */
  static tooManyRequests(res, message = 'Too many requests') {
    return this.error(res, 429, message);
  }

  /**
   * Internal server error response (500)
   */
  static internalError(res, message = 'Internal server error') {
    return this.error(res, 500, message);
  }
}

module.exports = ApiResponse;
