const express = require('express');
const router = express.Router();
const {
  getTrafficSummary,
  getVisitorTrend,
  getLocationBreakdown,
  getDeviceBreakdown
} = require('../controllers/trafficController');
const { authenticate, requireEmailVerification, requireNotSuspended } = require('../middlewares/auth.middleware');

/**
 * Traffic Analytics Routes
 * All routes require authentication and email verification
 */

// GET /api/v1/analytics/traffic/:websiteId/summary
router.get(
  '/:websiteId/summary',
  authenticate,
  requireEmailVerification,
  requireNotSuspended,
  getTrafficSummary
);

// GET /api/v1/analytics/traffic/:websiteId/trend
router.get(
  '/:websiteId/trend',
  authenticate,
  requireEmailVerification,
  requireNotSuspended,
  getVisitorTrend
);

// GET /api/v1/analytics/traffic/:websiteId/locations
router.get(
  '/:websiteId/locations',
  authenticate,
  requireEmailVerification,
  requireNotSuspended,
  getLocationBreakdown
);

// GET /api/v1/analytics/traffic/:websiteId/devices
router.get(
  '/:websiteId/devices',
  authenticate,
  requireEmailVerification,
  requireNotSuspended,
  getDeviceBreakdown
);

module.exports = router;
