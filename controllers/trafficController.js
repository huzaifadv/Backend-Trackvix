const { asyncHandler } = require('../middlewares/error.middleware');
const ApiResponse = require('../utils/response');
const trafficService = require('../services/trafficService');

/**
 * Get traffic analytics summary
 * GET /api/v1/analytics/traffic/:websiteId/summary
 */
exports.getTrafficSummary = asyncHandler(async (req, res) => {
  const { websiteId } = req.params;
  const { startDate, endDate } = req.query;

  const summary = await trafficService.getTrafficSummary(
    websiteId,
    req.user._id,
    startDate,
    endDate
  );

  ApiResponse.success(res, 'Traffic summary retrieved successfully', summary);
});

/**
 * Get visitor trend over time
 * GET /api/v1/analytics/traffic/:websiteId/trend
 */
exports.getVisitorTrend = asyncHandler(async (req, res) => {
  const { websiteId } = req.params;
  const { startDate, endDate, interval } = req.query;

  const trend = await trafficService.getVisitorTrend(
    websiteId,
    req.user._id,
    startDate,
    endDate,
    interval
  );

  ApiResponse.success(res, 'Visitor trend retrieved successfully', trend);
});

/**
 * Get location breakdown
 * GET /api/v1/analytics/traffic/:websiteId/locations
 */
exports.getLocationBreakdown = asyncHandler(async (req, res) => {
  const { websiteId } = req.params;
  const { startDate, endDate } = req.query;

  const locations = await trafficService.getLocationBreakdown(
    websiteId,
    req.user._id,
    startDate,
    endDate
  );

  ApiResponse.success(res, 'Location breakdown retrieved successfully', locations);
});

/**
 * Get device breakdown
 * GET /api/v1/analytics/traffic/:websiteId/devices
 */
exports.getDeviceBreakdown = asyncHandler(async (req, res) => {
  const { websiteId } = req.params;
  const { startDate, endDate } = req.query;

  const devices = await trafficService.getDeviceBreakdown(
    websiteId,
    req.user._id,
    startDate,
    endDate
  );

  ApiResponse.success(res, 'Device breakdown retrieved successfully', devices);
});
