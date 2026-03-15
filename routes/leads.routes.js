const express = require('express');
const leadsController = require('../controllers/leads.controller');
const leadInboxController = require('../controllers/leadController');
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

// Lead Inbox Management (must come before /:websiteId routes)
router.get('/inbox', leadInboxController.getLeads);
router.get('/inbox/stats', leadInboxController.getLeadStats);
router.get('/inbox/:id', leadInboxController.getLeadById);
router.get('/inbox/:id/journey', leadInboxController.getVisitorJourney);
router.patch('/inbox/:id/status', leadInboxController.updateLeadStatus);
router.patch('/inbox/:id/read', leadInboxController.markLeadAsRead);
router.post('/inbox/:id/notes', leadInboxController.addNote);
router.delete('/inbox/:id', leadInboxController.deleteLead);

// Real-time leads endpoints (analytics)
router.get('/recent/:websiteId', leadsController.getRecentLeads);
router.get('/realtime/:websiteId', leadsController.getRealtimeLeadStats);
router.get('/timeline/:websiteId', leadsController.getLeadTimeline);

module.exports = router;
