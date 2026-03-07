const ScanService = require('../services/scan.service');
const Website = require('../models/Website');
const ApiResponse = require('../utils/response');
const logger = require('../config/logger');

/**
 * Website Scan Controller
 * Handles scan requests and health retrieval
 */
class ScanController {
  /**
   * Initiate website scan
   * POST /api/v1/websites/:id/scan
   */
  static async initiateScan(req, res) {
    try {
      const { id } = req.params;
      const { priority = 'normal' } = req.body;

      // Verify website exists and user owns it
      const website = await Website.findOne({
        _id: id,
        userId: req.user._id,
      });

      if (!website) {
        return ApiResponse.notFound(res, 'Website not found');
      }

      // Build URL
      const url = `https://${website.domain}`;

      // Enqueue scan (async)
      const result = await ScanService.enqueueScan(website._id, url, priority);

      return ApiResponse.success(res, 'Scan initiated', result, 202);

    } catch (error) {
      logger.error('Scan initiation error:', error);
      return ApiResponse.error(res, 'Failed to initiate scan');
    }
  }

  /**
   * Get scan status
   * GET /api/v1/scans/:jobId/status
   */
  static async getScanStatus(req, res) {
    try {
      const { jobId } = req.params;

      const status = await ScanService.getScanStatus(jobId);

      if (!status) {
        return ApiResponse.notFound(res, 'Scan job not found');
      }

      return ApiResponse.success(res, 'Scan status retrieved', status);

    } catch (error) {
      logger.error('Get scan status error:', error);
      return ApiResponse.error(res, 'Failed to retrieve scan status');
    }
  }

  /**
   * Get latest health for website
   * GET /api/v1/websites/:id/health
   */
  static async getHealth(req, res) {
    try {
      const { id } = req.params;

      // Verify website exists and user owns it
      const website = await Website.findOne({
        _id: id,
        userId: req.user._id,
      });

      if (!website) {
        return ApiResponse.notFound(res, 'Website not found');
      }

      const health = await ScanService.getLatestHealth(website._id);

      if (!health) {
        return ApiResponse.success(res, 'No health data available', {
          message: 'Website has not been scanned yet',
          needsScan: true,
        });
      }

      return ApiResponse.success(res, 'Health data retrieved', health);

    } catch (error) {
      logger.error('Get health error:', error);
      return ApiResponse.error(res, 'Failed to retrieve health data');
    }
  }

  /**
   * Get health history for website
   * GET /api/v1/websites/:id/health/history
   */
  static async getHealthHistory(req, res) {
    try {
      const { id } = req.params;
      const { limit = 10 } = req.query;

      // Verify website exists and user owns it
      const website = await Website.findOne({
        _id: id,
        userId: req.user._id,
      });

      if (!website) {
        return ApiResponse.notFound(res, 'Website not found');
      }

      const history = await ScanService.getHealthHistory(website._id, parseInt(limit));

      return ApiResponse.success(res, 'Health history retrieved', history);

    } catch (error) {
      logger.error('Get health history error:', error);
      return ApiResponse.error(res, 'Failed to retrieve health history');
    }
  }

  /**
   * Check if website needs rescan
   * GET /api/v1/websites/:id/needs-scan
   */
  static async needsRescan(req, res) {
    try {
      const { id } = req.params;

      // Verify website exists and user owns it
      const website = await Website.findOne({
        _id: id,
        userId: req.user._id,
      });

      if (!website) {
        return ApiResponse.notFound(res, 'Website not found');
      }

      const needsScan = await ScanService.needsRescan(website._id);

      return ApiResponse.success(res, 'Scan status checked', {
        websiteId: website._id,
        needsScan,
      });

    } catch (error) {
      logger.error('Check rescan error:', error);
      return ApiResponse.error(res, 'Failed to check scan status');
    }
  }
}

module.exports = ScanController;
