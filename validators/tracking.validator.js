const { body, validationResult } = require('express-validator');
const ApiResponse = require('../utils/response');

/**
 * Tracking Validation Middleware
 * Validates incoming event data
 */

const eventCollectionRules = [
  body('eventType')
    .trim()
    .notEmpty()
    .withMessage('Event type is required')
    .isIn(['visitor', 'tel_click', 'whatsapp_click', 'cta_click', 'form_submit'])
    .withMessage('Invalid event type'),

  body('apiKey')
    .trim()
    .notEmpty()
    .withMessage('API key is required')
    .isLength({ min: 64, max: 64 })
    .withMessage('Invalid API key format'),

  body('url')
    .trim()
    .notEmpty()
    .withMessage('URL is required')
    .isURL({ require_protocol: true, require_tld: false })
    .withMessage('Invalid URL format'),

  body('device')
    .optional()
    .isIn(['desktop', 'mobile', 'tablet'])
    .withMessage('Invalid device type'),

  body('source')
    .optional()
    .isIn(['Google', 'Facebook', 'Instagram', 'YouTube', 'Direct', 'Other'])
    .withMessage('Invalid traffic source'),

  body('visitorId')
    .optional()
    .trim(),

  body('isNewVisitor')
    .optional()
    .isBoolean()
    .withMessage('isNewVisitor must be boolean'),

  body('referrer')
    .optional()
    .trim(),

  body('userAgent')
    .optional()
    .trim(),

  // UTM parameters (optional)
  body('utm_source').optional().trim(),
  body('utm_medium').optional().trim(),
  body('utm_campaign').optional().trim(),
  body('utm_term').optional().trim(),
  body('utm_content').optional().trim(),

  // Tel click specific
  body('phoneNumber')
    .if(body('eventType').equals('tel_click'))
    .optional()
    .trim(),

  // WhatsApp click specific
  body('phoneNumber')
    .if(body('eventType').equals('whatsapp_click'))
    .optional()
    .trim(),

  // CTA click specific
  body('ctaId')
    .if(body('eventType').equals('cta_click'))
    .optional()
    .trim(),

  body('ctaText')
    .if(body('eventType').equals('cta_click'))
    .optional()
    .trim(),

  // Form submit specific
  body('formId')
    .if(body('eventType').equals('form_submit'))
    .optional()
    .trim(),
];

/**
 * Validation error handler
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => err.msg);
    const logger = require('../config/logger');

    // Log validation errors for debugging
    logger.warn('Validation failed:', {
      errors: errorMessages,
      body: req.body
    });

    // Return 200 for tracking endpoints to avoid breaking client
    return res.status(200).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
  }

  next();
};

module.exports = {
  eventCollectionRules,
  handleValidationErrors,
};
