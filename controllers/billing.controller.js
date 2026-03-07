const StripeService = require('../services/stripe.service');
const Plan = require('../models/Plan');
const ApiResponse = require('../utils/response');
const logger = require('../config/logger');

/**
 * Billing Controller
 * Handles subscription and payment operations
 */
class BillingController {
  /**
   * Create checkout session for Pro plan
   * POST /api/v1/billing/create-checkout
   */
  static async createCheckout(req, res) {
    try {
      const userId = req.user._id;
      const { successUrl, cancelUrl } = req.body;

      // Check if already on Pro
      if (req.user.isPro()) {
        return ApiResponse.badRequest(res, 'Already subscribed to Pro plan');
      }

      // Validate URLs
      if (!successUrl || !cancelUrl) {
        return ApiResponse.badRequest(res, 'Success and cancel URLs required');
      }

      // Create checkout session
      const session = await StripeService.createCheckoutSession(
        userId,
        successUrl,
        cancelUrl
      );

      return ApiResponse.success(res, 'Checkout session created', {
        sessionId: session.id,
        url: session.url,
      });

    } catch (error) {
      logger.error('Create checkout error:', error);
      return ApiResponse.error(res, error.message || 'Failed to create checkout session');
    }
  }

  /**
   * Cancel subscription
   * POST /api/v1/billing/cancel
   */
  static async cancelSubscription(req, res) {
    try {
      const userId = req.user._id;

      // Check if user has active subscription
      if (!req.user.stripeSubscriptionId) {
        return ApiResponse.badRequest(res, 'No active subscription found');
      }

      // Cancel subscription
      const subscription = await StripeService.cancelSubscription(userId);

      return ApiResponse.success(res, 'Subscription canceled', {
        subscriptionId: subscription.id,
        endsAt: new Date(subscription.current_period_end * 1000),
      });

    } catch (error) {
      logger.error('Cancel subscription error:', error);
      return ApiResponse.error(res, error.message || 'Failed to cancel subscription');
    }
  }

  /**
   * Get billing status
   * GET /api/v1/billing/status
   */
  static async getBillingStatus(req, res) {
    try {
      const user = req.user;

      // Get plan details
      const plan = await Plan.getByName(user.currentPlan);

      const status = {
        currentPlan: user.currentPlan,
        planDisplayName: plan ? plan.displayName : 'Unknown',
        price: plan ? plan.price : 0,
        websiteLimit: plan ? plan.websiteLimit : 0,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionEndsAt: user.subscriptionEndsAt,
        stripeCustomerId: user.stripeCustomerId,
        hasActiveSubscription: user.isPro(),
      };

      return ApiResponse.success(res, 'Billing status retrieved', status);

    } catch (error) {
      logger.error('Get billing status error:', error);
      return ApiResponse.error(res, 'Failed to retrieve billing status');
    }
  }

  /**
   * Get available plans
   * GET /api/v1/billing/plans
   */
  static async getPlans(req, res) {
    try {
      const plans = await Plan.find({ isActive: true }).select('-stripePriceId');

      return ApiResponse.success(res, 'Plans retrieved', plans);

    } catch (error) {
      logger.error('Get plans error:', error);
      return ApiResponse.error(res, 'Failed to retrieve plans');
    }
  }

  /**
   * Handle Stripe webhooks
   * POST /api/v1/billing/webhook
   */
  static async handleWebhook(req, res) {
    try {
      const signature = req.headers['stripe-signature'];

      if (!signature) {
        return res.status(400).send('Missing signature');
      }

      // Verify webhook signature
      const event = StripeService.verifyWebhookSignature(
        req.rawBody,
        signature
      );

      logger.info(`Webhook received: ${event.type}`);

      // Handle different event types
      switch (event.type) {
        case 'invoice.paid':
          await StripeService.handleInvoicePaid(event.data.object);
          break;

        case 'invoice.payment_failed':
          await StripeService.handlePaymentFailed(event.data.object);
          break;

        case 'customer.subscription.deleted':
          await StripeService.handleSubscriptionDeleted(event.data.object);
          break;

        case 'customer.subscription.updated':
          await StripeService.handleSubscriptionUpdated(event.data.object);
          break;

        default:
          logger.info(`Unhandled event type: ${event.type}`);
      }

      // Return 200 to acknowledge receipt
      return res.status(200).json({ received: true });

    } catch (error) {
      logger.error('Webhook handler error:', error);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }
  }
}

module.exports = BillingController;
