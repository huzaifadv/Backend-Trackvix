const Plan = require('../models/Plan');
const Website = require('../models/Website');
const ApiResponse = require('../utils/response');

/**
 * Plan Enforcement Middleware
 * Validates subscription limits and access control
 */

/**
 * Check if user can add website based on plan limit
 */
const enforceWebsiteLimit = async (req, res, next) => {
  try {
    const user = req.user;

    // Get user's current plan
    const plan = await Plan.getByName(user.currentPlan);

    if (!plan) {
      return ApiResponse.error(res, 'Invalid plan');
    }

    // Count user's websites
    const websiteCount = await Website.countDocuments({ userId: user._id });

    // Check if limit exceeded
    if (websiteCount >= plan.websiteLimit) {
      return ApiResponse.forbidden(
        res,
        `Website limit reached. Upgrade to Pro to add more websites. Current limit: ${plan.websiteLimit}`
      );
    }

    next();
  } catch (error) {
    return ApiResponse.error(res, 'Failed to check website limit');
  }
};

/**
 * Require Pro plan for AI features
 */
const requireProPlan = (req, res, next) => {
  if (!req.user.isPro()) {
    return ApiResponse.forbidden(
      res,
      'This feature requires a Pro subscription. Please upgrade to access AI-powered recommendations.'
    );
  }

  next();
};

/**
 * Check if user subscription is active
 */
const requireActiveSubscription = (req, res, next) => {
  if (req.user.isSuspended) {
    return ApiResponse.forbidden(res, 'Account suspended. Contact support.');
  }

  if (req.user.subscriptionStatus !== 'active') {
    return ApiResponse.forbidden(
      res,
      'Subscription inactive. Please update payment method.'
    );
  }

  next();
};

/**
 * Validate user is not suspended
 */
const requireNotSuspended = (req, res, next) => {
  if (req.user.isSuspended) {
    return ApiResponse.forbidden(
      res,
      'Account suspended. Contact support for assistance.'
    );
  }

  next();
};

module.exports = {
  enforceWebsiteLimit,
  requireProPlan,
  requireActiveSubscription,
  requireNotSuspended,
};
