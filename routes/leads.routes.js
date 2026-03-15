const express = require('express');
const leadsController = require('../controllers/leads.controller');
const { authenticate, requireEmailVerification } = require('../middlewares/auth.middleware');

const router = express.Router();

/**
 * Leads Routes
 * Base: /api/v1/leads
 * All routes require authentication and email verification
 */

// Apply authentication and email verification to all routes
router.use(authenticate);
router.use(requireEmailVerification);

// Real-time leads endpoints
router.get('/recent/:websiteId', leadsController.getRecentLeads);
router.get('/realtime/:websiteId', leadsController.getRealtimeLeadStats);
router.get('/timeline/:websiteId', leadsController.getLeadTimeline);

module.exports = router;
