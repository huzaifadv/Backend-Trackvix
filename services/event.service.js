const Event = require('../models/Event');
const Website = require('../models/Website');
const logger = require('../config/logger');
const { OperationalError } = require('../middlewares/error.middleware');

/**
 * Event Service
 * Business logic for event tracking and analytics
 */

class EventService {
  /**
   * Track a new event
   * @param {String} websiteId - Website ID
   * @param {Object} eventData - Event data
   * @returns {Object} Created event
   */
  async trackEvent(websiteId, eventData) {
    try {
      // Create event
      const event = await Event.create({
        websiteId,
        type: eventData.type,
        source: eventData.source,
        country: eventData.country,
        device: eventData.device,
        visitorId: eventData.visitorId,
        isNewVisitor: eventData.isNewVisitor || false,
        metadata: {
          userAgent: eventData.userAgent,
          ip: eventData.ip,
          referrer: eventData.referrer,
          path: eventData.path,
          language: eventData.language,
          screenResolution: eventData.screenResolution,
        },
      });

      // Update website metadata and activate if first event (fire and forget)
      Website.findById(websiteId).then(website => {
        if (website) {
          const isFirstEvent = !website.metadata.totalEvents || website.metadata.totalEvents === 0;

          const updates = {
            $inc: { 'metadata.totalEvents': 1 },
            $set: { 'metadata.lastEventAt': new Date() },
          };

          // Activate website on first event
          if (isFirstEvent && website.status === 'pending') {
            updates.$set.status = 'active';
            updates.$set.isActive = true;
            logger.info(`Website ${websiteId} activated - first event received`);
          }

          Website.findByIdAndUpdate(websiteId, updates).catch(err =>
            logger.error('Failed to update website metadata:', err)
          );
        }
      }).catch(err => logger.error('Failed to check website:', err));

      logger.debug(`Event tracked: ${event.type} for website ${websiteId}`);

      return event;
    } catch (error) {
      logger.error('Track event error:', error);
      throw new OperationalError('Failed to track event', 500);
    }
  }

  /**
   * Get events for a website with pagination
   * @param {String} websiteId - Website ID
   * @param {Object} filters - Query filters
   * @returns {Object} Events and pagination info
   */
  async getEvents(websiteId, filters = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        type,
        country,
        device,
        startDate,
        endDate,
      } = filters;

      // Build query
      const query = { websiteId };

      if (type) query.type = type;
      if (country) query.country = country.toUpperCase();
      if (device) query.device = device;

      // Date range filter
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      // Pagination
      const skip = (page - 1) * limit;

      // Execute queries in parallel
      const [events, totalCount] = await Promise.all([
        Event.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Event.countDocuments(query),
      ]);

      return {
        events,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          limit: parseInt(limit),
        },
      };
    } catch (error) {
      logger.error('Get events error:', error);
      throw new OperationalError('Failed to fetch events', 500);
    }
  }

  /**
   * Get analytics for a website
   * @param {String} websiteId - Website ID
   * @param {Object} filters - Date filters
   * @returns {Object} Analytics data
   */
  async getAnalytics(websiteId, filters = {}) {
    try {
      const { startDate, endDate } = filters;

      // Get statistics in parallel
      const [statsByType, eventsByCountry, eventsByDevice] = await Promise.all([
        Event.getStatsByWebsite(websiteId, startDate, endDate),
        Event.getEventsByCountry(websiteId, startDate, endDate),
        Event.getEventsByDevice(websiteId, startDate, endDate),
      ]);

      // Format response
      const analytics = {
        overview: {
          totalEvents: statsByType.reduce((sum, stat) => sum + stat.count, 0),
          byType: statsByType.reduce((acc, stat) => {
            acc[stat._id] = stat.count;
            return acc;
          }, {}),
        },
        topCountries: eventsByCountry,
        deviceBreakdown: eventsByDevice.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
      };

      return analytics;
    } catch (error) {
      logger.error('Get analytics error:', error);
      throw new OperationalError('Failed to fetch analytics', 500);
    }
  }

  /**
   * Get real-time stats (last 24 hours)
   * @param {String} websiteId - Website ID
   * @returns {Object} Real-time statistics
   */
  async getRealtimeStats(websiteId) {
    try {
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const stats = await Event.aggregate([
        {
          $match: {
            websiteId: websiteId,
            createdAt: { $gte: last24Hours },
          },
        },
        {
          $group: {
            _id: {
              type: '$type',
              hour: { $hour: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { '_id.hour': 1 },
        },
      ]);

      return {
        last24Hours: stats,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Get realtime stats error:', error);
      throw new OperationalError('Failed to fetch realtime stats', 500);
    }
  }
}

module.exports = new EventService();
