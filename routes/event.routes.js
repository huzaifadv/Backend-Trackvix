const express = require('express');
const eventController = require('../controllers/event.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validateApiKey } = require('../middlewares/security.middleware');
const { body } = require('express-validator');
const { validate } = require('../validators/auth.validator');

const router = express.Router();

/**
 * Event Routes
 * Base: /api/v1/events
 */

// Validation middleware
const trackEventValidation = [
  body('type')
    .notEmpty()
    .withMessage('Event type is required')
    .isIn(['pageview', 'call_click', 'form_submit'])
    .withMessage('Invalid event type'),
  body('source')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Source cannot exceed 500 characters'),
  body('country')
    .optional()
    .isLength({ min: 2, max: 2 })
    .withMessage('Country must be 2-letter code'),
  body('device')
    .optional()
    .isIn(['desktop', 'mobile', 'tablet', 'unknown'])
    .withMessage('Invalid device type'),
];

// Public tracking endpoint (requires API key)
router.post(
  '/track',
  validateApiKey,
  trackEventValidation,
  validate,
  eventController.trackEvent
);

module.exports = router;
