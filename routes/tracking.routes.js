const express = require('express');
const router = express.Router();
const TrackingController = require('../controllers/tracking.controller');
const { eventCollectionRules, handleValidationErrors } = require('../validators/tracking.validator');
const { authenticate } = require('../middlewares/auth.middleware');
const { createLimiter, publicCorsConfig } = require('../middlewares/security.middleware');

/**
 * Tracking Routes
 * Public event collection + Protected stats endpoints
 */

// Rate limiter for event collection
// Development: 10000 requests per minute (very high for testing)
// Production: Lower to 100-200 based on traffic
const eventCollectionLimiter = createLimiter(60 * 1000, 10000); // 10000 requests per minute (testing)

/**
 * @route   POST /api/v1/events/log
 * @desc    Log event data (PUBLIC - uses API key)
 * @access  Public with valid API key
 * @note    Renamed from /collect to bypass AdBlock filters
 */
router.post(
  '/log',
  publicCorsConfig, // Allow all origins for tracking
  eventCollectionLimiter,
  eventCollectionRules,
  handleValidationErrors,
  TrackingController.collectEvent
);

// Handle OPTIONS preflight for event logging
router.options('/log', publicCorsConfig);

/**
 * @route   GET /api/v1/events/stats/:websiteId
 * @desc    Get aggregated stats for website
 * @access  Private (JWT auth)
 */
router.get(
  '/stats/:websiteId',
  authenticate,
  TrackingController.getStats
);

/**
 * @route   GET /api/v1/events/traffic/:websiteId
 * @desc    Get traffic stats for website
 * @access  Private (JWT auth)
 */
router.get(
  '/traffic/:websiteId',
  authenticate,
  TrackingController.getTrafficStats
);

/**
 * @route   GET /api/v1/events/leads/:websiteId
 * @desc    Get leads stats for website
 * @access  Private (JWT auth)
 */
router.get(
  '/leads/:websiteId',
  authenticate,
  TrackingController.getLeadsStats
);

/**
 * @route   GET /api/v1/events/leads/:websiteId/locations
 * @desc    Get leads location breakdown (countries & cities)
 * @access  Private (JWT auth)
 */
router.get(
  '/leads/:websiteId/locations',
  authenticate,
  TrackingController.getLeadsLocations
);

module.exports = router;
