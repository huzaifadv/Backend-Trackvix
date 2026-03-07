const express = require('express');
const eventController = require('../controllers/event.controller');
const { authenticate, requireEmailVerification } = require('../middlewares/auth.middleware');

const router = express.Router();

/**
 * Analytics Routes
 * Base: /api/v1/analytics
 * All routes require authentication and email verification
 */

// Apply authentication and email verification to all routes
router.use(authenticate);
router.use(requireEmailVerification);

// Website analytics endpoints
router.get('/websites/:websiteId/events', eventController.getEvents);
router.get('/websites/:websiteId/analytics', eventController.getAnalytics);
router.get('/websites/:websiteId/realtime', eventController.getRealtimeStats);

module.exports = router;
