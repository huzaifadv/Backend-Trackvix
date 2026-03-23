const AIAnalyzerService = require('../services/aiAnalyzer.service');
const Website = require('../models/Website');
const ApiResponse = require('../utils/response');
const logger = require('../config/logger');

/**
 * AI Website Analyzer Controller
 * Handles AI-powered website analysis requests
 */
class AIAnalyzerController {
  /**
   * Trigger website analysis
   * POST /api/v1/ai-analyzer/analyze/:websiteId
   */
  static async analyzeWebsite(req, res) {
    try {
      const { websiteId } = req.params;

      // Verify website exists and user owns it
      const website = await Website.findOne({
        _id: websiteId,
        userId: req.user._id,
      });

      if (!website) {
        return ApiResponse.notFound(res, 'Website not found');
      }

      // Check if analysis is already in progress
      const inProgress = await AIAnalyzerService.isAnalysisInProgress(websiteId);
      if (inProgress) {
        return ApiResponse.error(res, 409, 'Analysis already in progress, please wait');
      }

      // Use domain directly (already a full HTTPS URL)
      const url = website.domain;

      // Run analysis (async - but we wait for it since user expects results)
      const analysis = await AIAnalyzerService.runAnalysis(websiteId, url);

      return ApiResponse.success(res, 'Analysis completed', {
        analysis,
        cached: false,
      });
    } catch (error) {
      logger.error('AI Analysis error:', error);

      if (error.message.includes('could not be crawled') || error.message.includes('Failed to fetch') || error.message.includes('HTTP 4')) {
        return ApiResponse.error(res, 422, 'Website could not be crawled. The website may be blocking automated requests or is not accessible.');
      }

      if (error.message.includes('GEMINI_API_KEY')) {
        return ApiResponse.error(res, 500, 'AI analysis service is not configured');
      }

      return ApiResponse.error(res, 500, 'Analysis failed: ' + error.message);
    }
  }

  /**
   * Get latest analysis for a website
   * GET /api/v1/ai-analyzer/latest/:websiteId
   */
  static async getLatestAnalysis(req, res) {
    try {
      const { websiteId } = req.params;

      // Verify website exists and user owns it
      const website = await Website.findOne({
        _id: websiteId,
        userId: req.user._id,
      });

      if (!website) {
        return ApiResponse.notFound(res, 'Website not found');
      }

      const analysis = await AIAnalyzerService.getLatestAnalysis(websiteId);

      if (!analysis) {
        return ApiResponse.success(res, 'No analysis available', {
          analysis: null,
          needsAnalysis: true,
        });
      }

      const isExpired = analysis.expiresAt && new Date() > analysis.expiresAt;

      return ApiResponse.success(res, 'Latest analysis retrieved', {
        analysis,
        cached: !isExpired,
        isExpired,
      });
    } catch (error) {
      logger.error('Get latest analysis error:', error);
      return ApiResponse.error(res, 500, 'Failed to retrieve analysis');
    }
  }

  /**
   * Get analysis history for a website
   * GET /api/v1/ai-analyzer/history/:websiteId
   */
  static async getAnalysisHistory(req, res) {
    try {
      const { websiteId } = req.params;
      const { limit = 10 } = req.query;

      // Verify website exists and user owns it
      const website = await Website.findOne({
        _id: websiteId,
        userId: req.user._id,
      });

      if (!website) {
        return ApiResponse.notFound(res, 'Website not found');
      }

      const history = await AIAnalyzerService.getAnalysisHistory(websiteId, parseInt(limit));

      return ApiResponse.success(res, 'Analysis history retrieved', {
        history,
        total: history.length,
      });
    } catch (error) {
      logger.error('Get analysis history error:', error);
      return ApiResponse.error(res, 500, 'Failed to retrieve analysis history');
    }
  }
}

module.exports = AIAnalyzerController;
