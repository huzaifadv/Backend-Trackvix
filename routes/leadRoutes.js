const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const { protect } = require('../middlewares/auth');
const { requireEmailVerification, requireNotSuspended } = require('../middlewares/verification');

// Apply authentication and verification middleware to all routes
router.use(protect);
router.use(requireEmailVerification);
router.use(requireNotSuspended);

// Lead statistics (must come before /:id route)
router.get('/stats', leadController.getLeadStats);

// Get all leads
router.get('/', leadController.getLeads);

// Get single lead
router.get('/:id', leadController.getLeadById);

// Get visitor journey
router.get('/:id/journey', leadController.getVisitorJourney);

// Update lead status
router.patch('/:id/status', leadController.updateLeadStatus);

// Mark as read
router.patch('/:id/read', leadController.markLeadAsRead);

// Add note
router.post('/:id/notes', leadController.addNote);

// Delete lead
router.delete('/:id', leadController.deleteLead);

module.exports = router;
