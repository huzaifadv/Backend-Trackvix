const express = require('express');
const router = express.Router();
const ScanController = require('../controllers/scan.controller');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * Scan Routes
 * Protected endpoints for website health scanning
 */

/**
 * @route   POST /api/v1/websites/:id/scan
 * @desc    Initiate website scan (async)
 * @access  Private
 */
router.post(
  '/:id/scan',
  authenticate,
  ScanController.initiateScan
);

/**
 * @route   GET /api/v1/scans/:jobId/status
 * @desc    Get scan job status
 * @access  Private
 */
router.get(
  '/scans/:jobId/status',
  authenticate,
  ScanController.getScanStatus
);

/**
 * @route   GET /api/v1/websites/:id/health
 * @desc    Get latest health data for website
 * @access  Private
 */
router.get(
  '/:id/health',
  authenticate,
  ScanController.getHealth
);

/**
 * @route   GET /api/v1/websites/:id/health/history
 * @desc    Get health history for website
 * @access  Private
 */
router.get(
  '/:id/health/history',
  authenticate,
  ScanController.getHealthHistory
);

/**
 * @route   GET /api/v1/websites/:id/needs-scan
 * @desc    Check if website needs rescan
 * @access  Private
 */
router.get(
  '/:id/needs-scan',
  authenticate,
  ScanController.needsRescan
);

module.exports = router;
