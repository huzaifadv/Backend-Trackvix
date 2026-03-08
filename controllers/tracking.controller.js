const TrackingService = require('../services/tracking.service');
const ApiResponse = require('../utils/response');
const logger = require('../config/logger');

/**
 * Tracking Controller
 * Handles event collection endpoints
 */
class TrackingController {
  /**
   * Collect event data
   * POST /api/v1/events/log
   */
  static async collectEvent(req, res) {
    // Set CORS headers for public endpoint
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

    try {
      const { apiKey, ...eventData } = req.body;

      // Log incoming request for debugging
      logger.info('Event collection request:', {
        apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'missing',
        eventType: eventData.eventType,
        url: eventData.url,
        device: eventData.device,
        source: eventData.source,
        visitorId: eventData.visitorId ? eventData.visitorId.substring(0, 15) + '...' : 'missing',
        isNewVisitor: eventData.isNewVisitor
      });

      // Validate API key
      if (!apiKey) {
        logger.warn('Event collection attempted without API key');
        return res.status(200).json({
          success: false,
          message: 'API key required',
        });
      }

      // Log all headers for debugging
      logger.info('Request headers:', {
        'cf-connecting-ip': req.headers['cf-connecting-ip'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip'],
        'x-client-ip': req.headers['x-client-ip'],
        'remoteAddress': req.socket?.remoteAddress,
        'req.ip': req.ip
      });

      // Get client IP (considering proxies and Cloudflare)
      // Priority: Cloudflare > X-Forwarded-For > X-Real-IP > Express req.ip
      let ip = req.headers['cf-connecting-ip'] || // Cloudflare
               req.headers['x-real-ip'] || // Nginx
               req.headers['x-client-ip'] || // Apache
               req.ip || // Express built-in (works with trust proxy)
               req.headers['x-forwarded-for']?.split(',')[0]?.trim() || // Standard proxy (last resort)
               req.connection?.remoteAddress ||
               req.socket?.remoteAddress;

      // Clean IPv6 prefix
      ip = ip?.replace(/^::ffff:/, '') || '127.0.0.1';

      // Get user agent
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Log final detected IP
      logger.info('Detected client IP:', ip);

      // Process event
      const result = await TrackingService.processEvent(apiKey, eventData, ip, userAgent);

      // Return minimal response (fast) - Always 200 for tracking
      return res.status(200).json({
        success: true,
        message: 'Event tracked successfully',
        data: result,
      });

    } catch (error) {
      logger.error('Event collection error:', error);

      // Always return 200 to avoid breaking client-side tracking
      // Log errors server-side but don't expose them
      return res.status(200).json({
        success: false,
        message: 'Event tracking failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  /**
   * Serve tracker.js script
   * GET /tracker.js
   */
  static serveTrackerScript(req, res) {
    try {
      res.set({
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*', // Allow all origins to load script
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'X-Content-Type-Options': 'nosniff',
      });

      res.sendFile('tracker.js', { root: './public' });
    } catch (error) {
      logger.error('Error serving tracker script:', error);
      return ApiResponse.error(res, 'Failed to load tracker script');
    }
  }

  /**
   * Get stats for a website
   * GET /api/v1/events/stats/:websiteId
   * Requires authentication
   */
  static async getStats(req, res) {
    try {
      const { websiteId } = req.params;
      const { days = 30 } = req.query;

      // Verify user owns this website
      const Website = require('../models/Website');
      const website = await Website.findOne({
        _id: websiteId,
        userId: req.user._id
      });

      if (!website) {
        return ApiResponse.notFound(res, 'Website not found');
      }

      // Get stats
      const stats = await TrackingService.getStatsSummary(websiteId, parseInt(days));

      return ApiResponse.success(res, 'Stats retrieved', stats);

    } catch (error) {
      logger.error('Get stats error:', error);
      return ApiResponse.error(res, 'Failed to retrieve stats');
    }
  }

  /**
   * Get traffic stats
   * GET /api/v1/events/traffic/:websiteId
   * Requires authentication
   */
  static async getTrafficStats(req, res) {
    try {
      const { websiteId } = req.params;
      const { startDate, endDate } = req.query;

      // Verify user owns this website
      const Website = require('../models/Website');
      const website = await Website.findOne({
        _id: websiteId,
        userId: req.user._id
      });

      if (!website) {
        return ApiResponse.notFound(res, 'Website not found');
      }

      // Get traffic stats
      const stats = await TrackingService.getTrafficStats(
        websiteId,
        startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate || new Date()
      );

      return ApiResponse.success(res, 'Traffic stats retrieved', stats);

    } catch (error) {
      logger.error('Get traffic stats error:', error);
      return ApiResponse.error(res, 'Failed to retrieve traffic stats');
    }
  }

  /**
   * Get leads stats
   * GET /api/v1/events/leads/:websiteId
   * Requires authentication
   */
  static async getLeadsStats(req, res) {
    try {
      const { websiteId } = req.params;
      const { startDate, endDate } = req.query;

      // Verify user owns this website
      const Website = require('../models/Website');
      const website = await Website.findOne({
        _id: websiteId,
        userId: req.user._id
      });

      if (!website) {
        return ApiResponse.notFound(res, 'Website not found');
      }

      // Get leads stats
      const stats = await TrackingService.getLeadsStats(
        websiteId,
        startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate || new Date()
      );

      return ApiResponse.success(res, 'Leads stats retrieved', stats);

    } catch (error) {
      logger.error('Get leads stats error:', error);
      return ApiResponse.error(res, 'Failed to retrieve leads stats');
    }
  }
}

module.exports = TrackingController;
