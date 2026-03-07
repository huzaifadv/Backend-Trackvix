const eventService = require('../services/event.service');
const ApiResponse = require('../utils/response');
const { asyncHandler } = require('../middlewares/error.middleware');

/**
 * Event Controller
 * Handles HTTP requests for event tracking and analytics
 */

class EventController {
  /**
   * Track new event (public endpoint using API key)
   * POST /api/v1/events/track
   */
  trackEvent = asyncHandler(async (req, res) => {
    const {
      type,
      source,
      country,
      device,
      userAgent,
      referrer,
      path,
      language,
      screenResolution,
    } = req.body;

    const event = await eventService.trackEvent(req.websiteId, {
      type,
      source,
      country,
      device,
      userAgent: userAgent || req.headers['user-agent'],
      ip: req.ip,
      referrer,
      path,
      language,
      screenResolution,
    });

    return ApiResponse.created(res, 'Event tracked successfully', { eventId: event._id });
  });

  /**
   * Get events for a website
   * GET /api/v1/websites/:websiteId/events
   */
  getEvents = asyncHandler(async (req, res) => {
    const { websiteId } = req.params;
    const { page, limit, type, country, device, startDate, endDate } = req.query;

    // Verify user owns this website
    const websiteService = require('../services/website.service');
    await websiteService.getWebsiteById(websiteId, req.userId);

    const result = await eventService.getEvents(websiteId, {
      page,
      limit,
      type,
      country,
      device,
      startDate,
      endDate,
    });

    return ApiResponse.success(res, 200, 'Events fetched successfully', result);
  });

  /**
   * Get analytics for a website
   * GET /api/v1/websites/:websiteId/analytics
   */
  getAnalytics = asyncHandler(async (req, res) => {
    const { websiteId } = req.params;
    const { startDate, endDate } = req.query;

    // Verify user owns this website
    const websiteService = require('../services/website.service');
    await websiteService.getWebsiteById(websiteId, req.userId);

    const analytics = await eventService.getAnalytics(websiteId, {
      startDate,
      endDate,
    });

    return ApiResponse.success(res, 200, 'Analytics fetched successfully', analytics);
  });

  /**
   * Get real-time stats
   * GET /api/v1/websites/:websiteId/realtime
   */
  getRealtimeStats = asyncHandler(async (req, res) => {
    const { websiteId } = req.params;

    // Verify user owns this website
    const websiteService = require('../services/website.service');
    await websiteService.getWebsiteById(websiteId, req.userId);

    const stats = await eventService.getRealtimeStats(websiteId);

    return ApiResponse.success(res, 200, 'Realtime stats fetched successfully', stats);
  });
}

module.exports = new EventController();
