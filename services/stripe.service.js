const Stripe = require('stripe');
const User = require('../models/User');
const Plan = require('../models/Plan');
const logger = require('../config/logger');

/**
 * Stripe Integration Service
 * Handles subscriptions, payments, and webhooks
 */
class StripeService {
  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY;

    if (!apiKey) {
      logger.warn('Stripe API key not configured');
      this.stripe = null;
    } else {
      this.stripe = new Stripe(apiKey, {
        apiVersion: '2024-12-18.acacia',
      });
    }
  }

  /**
   * Check if Stripe is configured
   */
  isConfigured() {
    return this.stripe !== null;
  }

  /**
   * Create Stripe customer
   */
  async createCustomer(user) {
    if (!this.isConfigured()) {
      throw new Error('Stripe not configured');
    }

    try {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: user._id.toString(),
        },
      });

      logger.info(`Stripe customer created: ${customer.id}`);

      return customer;
    } catch (error) {
      logger.error('Stripe customer creation failed:', error);
      throw new Error('Failed to create customer');
    }
  }

  /**
   * Create checkout session for Pro plan
   */
  async createCheckoutSession(userId, successUrl, cancelUrl) {
    if (!this.isConfigured()) {
      throw new Error('Stripe not configured');
    }

    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new Error('User not found');
      }

      // Get Pro plan
      const proPlan = await Plan.getByName('pro');

      if (!proPlan || !proPlan.stripePriceId) {
        throw new Error('Pro plan not configured');
      }

      // Create or get Stripe customer
      let customerId = user.stripeCustomerId;

      if (!customerId) {
        const customer = await this.createCustomer(user);
        customerId = customer.id;

        // Update user with Stripe customer ID
        user.stripeCustomerId = customerId;
        await user.save();
      }

      // Create checkout session
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: proPlan.stripePriceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId: user._id.toString(),
        },
      });

      logger.info(`Checkout session created: ${session.id}`);

      return session;
    } catch (error) {
      logger.error('Checkout session creation failed:', error);
      throw new Error('Failed to create checkout session');
    }
  }

  /**
   * Create subscription directly (for admin)
   */
  async createSubscription(userId) {
    if (!this.isConfigured()) {
      throw new Error('Stripe not configured');
    }

    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new Error('User not found');
      }

      const proPlan = await Plan.getByName('pro');

      if (!proPlan || !proPlan.stripePriceId) {
        throw new Error('Pro plan not configured');
      }

      // Create customer if needed
      let customerId = user.stripeCustomerId;

      if (!customerId) {
        const customer = await this.createCustomer(user);
        customerId = customer.id;
        user.stripeCustomerId = customerId;
        await user.save();
      }

      // Create subscription
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: proPlan.stripePriceId }],
        metadata: {
          userId: user._id.toString(),
        },
      });

      // Upgrade user
      await user.upgradeToPro(subscription.id);

      logger.info(`Subscription created: ${subscription.id}`);

      return subscription;
    } catch (error) {
      logger.error('Subscription creation failed:', error);
      throw new Error('Failed to create subscription');
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId) {
    if (!this.isConfigured()) {
      throw new Error('Stripe not configured');
    }

    try {
      const user = await User.findById(userId);

      if (!user || !user.stripeSubscriptionId) {
        throw new Error('No active subscription found');
      }

      // Cancel at period end (don't end immediately)
      const subscription = await this.stripe.subscriptions.update(
        user.stripeSubscriptionId,
        {
          cancel_at_period_end: true,
        }
      );

      // Update user
      user.subscriptionStatus = 'canceled';
      user.subscriptionEndsAt = new Date(subscription.current_period_end * 1000);
      await user.save();

      logger.info(`Subscription canceled: ${user.stripeSubscriptionId}`);

      return subscription;
    } catch (error) {
      logger.error('Subscription cancellation failed:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  /**
   * Handle invoice.paid webhook
   */
  async handleInvoicePaid(invoice) {
    try {
      const subscriptionId = invoice.subscription;

      if (!subscriptionId) return;

      const user = await User.findOne({ stripeSubscriptionId: subscriptionId });

      if (!user) {
        logger.warn(`User not found for subscription: ${subscriptionId}`);
        return;
      }

      // Upgrade user if not already pro
      if (user.currentPlan !== 'pro') {
        await user.upgradeToPro(subscriptionId);
        logger.info(`User ${user._id} upgraded to Pro`);
      }

      // Ensure status is active
      if (user.subscriptionStatus !== 'active') {
        user.subscriptionStatus = 'active';
        user.subscriptionEndsAt = null;
        await user.save();
      }

    } catch (error) {
      logger.error('Handle invoice paid error:', error);
    }
  }

  /**
   * Handle invoice.payment_failed webhook
   */
  async handlePaymentFailed(invoice) {
    try {
      const subscriptionId = invoice.subscription;

      if (!subscriptionId) return;

      const user = await User.findOne({ stripeSubscriptionId: subscriptionId });

      if (!user) return;

      // Mark subscription as past_due
      user.subscriptionStatus = 'past_due';
      await user.save();

      logger.warn(`Payment failed for user ${user._id}`);

    } catch (error) {
      logger.error('Handle payment failed error:', error);
    }
  }

  /**
   * Handle customer.subscription.deleted webhook
   */
  async handleSubscriptionDeleted(subscription) {
    try {
      const user = await User.findOne({ stripeSubscriptionId: subscription.id });

      if (!user) return;

      // Downgrade to basic
      await user.downgradeToBasic();

      logger.info(`User ${user._id} downgraded to Basic`);

    } catch (error) {
      logger.error('Handle subscription deleted error:', error);
    }
  }

  /**
   * Handle customer.subscription.updated webhook
   */
  async handleSubscriptionUpdated(subscription) {
    try {
      const user = await User.findOne({ stripeSubscriptionId: subscription.id });

      if (!user) return;

      // Update subscription status
      const statusMap = {
        'active': 'active',
        'past_due': 'past_due',
        'canceled': 'canceled',
        'incomplete': 'incomplete',
      };

      user.subscriptionStatus = statusMap[subscription.status] || 'active';

      if (subscription.cancel_at_period_end) {
        user.subscriptionStatus = 'canceled';
        user.subscriptionEndsAt = new Date(subscription.current_period_end * 1000);
      }

      await user.save();

      logger.info(`Subscription updated for user ${user._id}: ${subscription.status}`);

    } catch (error) {
      logger.error('Handle subscription updated error:', error);
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    if (!this.isConfigured()) {
      throw new Error('Stripe not configured');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error('Webhook secret not configured');
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      logger.error('Webhook signature verification failed:', error);
      throw new Error('Invalid signature');
    }
  }
}

module.exports = new StripeService();
