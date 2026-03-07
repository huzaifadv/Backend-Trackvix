const ApiResponse = require('../utils/response');
const database = require('../config/database');
const { asyncHandler } = require('../middlewares/error.middleware');

/**
 * Health Check Controller
 * System health and status endpoints
 */

class HealthController {
  /**
   * Basic health check
   * GET /api/v1/health
   */
  healthCheck = asyncHandler(async (req, res) => {
    return ApiResponse.success(res, 200, 'Service is healthy', {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
    });
  });

  /**
   * Detailed health check
   * GET /api/v1/health/detailed
   */
  detailedHealth = asyncHandler(async (req, res) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      memory: {
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      },
      database: {
        connected: database.isConnected(),
      },
    };

    return ApiResponse.success(res, 200, 'Detailed health check', health);
  });
}

module.exports = new HealthController();
