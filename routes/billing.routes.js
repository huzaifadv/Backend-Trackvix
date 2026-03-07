const express = require('express');
const router = express.Router();
const BillingController = require('../controllers/billing.controller');
const { authenticate, requireEmailVerification } = require('../middlewares/auth.middleware');
const { requireNotSuspended } = require('../middlewares/plan.middleware');
const { body } = require('express-validator');
const { validate } = require('../validators/auth.validator');

/**
 * Billing Routes
 * Handles subscriptions and payments
 */

// Validation
const checkoutValidation = [
  body('successUrl').isURL().withMessage('Valid success URL required'),
  body('cancelUrl').isURL().withMessage('Valid cancel URL required'),
];

/**
 * @route   POST /api/v1/billing/create-checkout
 * @desc    Create Stripe checkout session for Pro plan
 * @access  Private
 */
router.post(
  '/create-checkout',
  authenticate,
  requireEmailVerification,
  requireNotSuspended,
  checkoutValidation,
  validate,
  BillingController.createCheckout
);

/**
 * @route   POST /api/v1/billing/cancel
 * @desc    Cancel subscription
 *
router.post(
  '/cancel',
  authenticate,
  requireEmailVerification,
  BillingController.cancelSubscription
);

/**
 * @route   GET /api/v1/billing/status
 * @desc    Get current billing status
 * @access  Private
 */
router.get(
  '/status',
  authenticate,
  requireEmailVerification,
  BillingController.getBillingStatus
);

/**
 * @route   GET /api/v1/billing/plans
 * @desc    Get available plans
 * @access  Public
 */
router.get(
  '/plans',
  BillingController.getPlans
);

/**
 * @route   POST /api/v1/billing/webhook
 * @desc    Handle Stripe webhooks
 * @access  Public (Stripe signature verified)
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }), // Raw body for signature verification
  BillingController.handleWebhook
);

module.exports = router;
