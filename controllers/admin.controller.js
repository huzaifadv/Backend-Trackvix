const User = require('../models/User');
const Website = require('../models/Website');
const TrafficDailyStats = require('../models/TrafficDailyStats');
const LeadsDailyStats = require('../models/LeadsDailyStats');
const Plan = require('../models/Plan');
const StripeService = require('../services/stripe.service');
const ApiResponse = require('../utils/response');
const logger = require('../config/logger');

/**
 * Admin Controller
 * Handles administrative operations
 */
class AdminController {
  /**
   * Get all users with pagination
   * GET /api/v1/admin/users
   */
  static async getAllUsers(req, res) {
    try {
      const { page = 1, limit = 20, search = '', plan = '' } = req.query;

      const query = {};

      // Search filter
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }

      // Plan filter
      if (plan) {
        query.currentPlan = plan;
      }

      const users = await User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));

      const total = await User.countDocuments(query);

      return ApiResponse.success(res, 'Users retrieved', {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      });

    } catch (error) {
      logger.error('Get all users error:', error);
      return ApiResponse.error(res, 'Failed to retrieve users');
    }
  }

  /**
   * Get all websites
   * GET /api/v1/admin/websites
   */
  static async getAllWebsites(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;

      const websites = await Website.find()
        .populate('userId', 'name email currentPlan')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));

      const total = await Website.countDocuments();

      return ApiResponse.success(res, 'Websites retrieved', {
        websites,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      });

    } catch (error) {
      logger.error('Get all websites error:', error);
      return ApiResponse.error(res, 'Failed to retrieve websites');
    }
  }

  /**
   * Get platform statistics
   * GET /api/v1/admin/stats
   */
  static async getStats(req, res) {
    try {
      const [
        totalUsers,
        totalWebsites,
        proUsers,
        basicUsers,
        suspendedUsers,
      ] = await Promise.all([
        User.countDocuments(),
        Website.countDocuments(),
        User.countDocuments({ currentPlan: 'pro' }),
        User.countDocuments({ currentPlan: 'basic' }),
        User.countDocuments({ isSuspended: true }),
      ]);

      // Calculate total events (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const trafficStats = await TrafficDailyStats.aggregate([
        { $match: { date: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, totalVisits: { $sum: '$totalVisits' } } },
      ]);

      const leadStats = await LeadsDailyStats.aggregate([
        { $match: { date: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: null,
            totalCallClicks: { $sum: '$callClicks' },
            totalFormSubmissions: { $sum: '$formSubmissions' },
          },
        },
      ]);

      // Revenue calculation (Pro users * $15)
      const monthlyRecurringRevenue = proUsers * 15;

      const stats = {
        users: {
          total: totalUsers,
          pro: proUsers,
          basic: basicUsers,
          suspended: suspendedUsers,
        },
        websites: {
          total: totalWebsites,
        },
        events: {
          totalVisits: trafficStats[0]?.totalVisits || 0,
          totalCallClicks: leadStats[0]?.totalCallClicks || 0,
          totalFormSubmissions: leadStats[0]?.totalFormSubmissions || 0,
        },
        revenue: {
          monthlyRecurringRevenue,
          annualRecurringRevenue: monthlyRecurringRevenue * 12,
        },
      };

      return ApiResponse.success(res, 'Statistics retrieved', stats);

    } catch (error) {
      logger.error('Get stats error:', error);
      return ApiResponse.error(res, 'Failed to retrieve statistics');
    }
  }

  /**
   * Suspend user
   * POST /api/v1/admin/users/:id/suspend
   */
  static async suspendUser(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);

      if (!user) {
        return ApiResponse.notFound(res, 'User not found');
      }

      if (user.role === 'admin') {
        return ApiResponse.forbidden(res, 'Cannot suspend admin users');
      }

      await user.suspend();

      logger.info(`User ${id} suspended by admin ${req.user._id}`);

      return ApiResponse.success(res, 'User suspended', {
        userId: user._id,
        isSuspended: user.isSuspended,
      });

    } catch (error) {
      logger.error('Suspend user error:', error);
      return ApiResponse.error(res, 'Failed to suspend user');
    }
  }

  /**
   * Unsuspend user
   * POST /api/v1/admin/users/:id/unsuspend
   */
  static async unsuspendUser(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);

      if (!user) {
        return ApiResponse.notFound(res, 'User not found');
      }

      await user.unsuspend();

      logger.info(`User ${id} unsuspended by admin ${req.user._id}`);

      return ApiResponse.success(res, 'User unsuspended', {
        userId: user._id,
        isSuspended: user.isSuspended,
      });

    } catch (error) {
      logger.error('Unsuspend user error:', error);
      return ApiResponse.error(res, 'Failed to unsuspend user');
    }
  }

  /**
   * Manually upgrade user to Pro
   * POST /api/v1/admin/users/:id/upgrade
   */
  static async upgradeUser(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);

      if (!user) {
        return ApiResponse.notFound(res, 'User not found');
      }

      if (user.isPro()) {
        return ApiResponse.badRequest(res, 'User already on Pro plan');
      }

      // Create Stripe subscription if configured
      if (StripeService.isConfigured()) {
        await StripeService.createSubscription(id);
      } else {
        // Manual upgrade without Stripe
        await user.upgradeToPro(null);
      }

      logger.info(`User ${id} upgraded to Pro by admin ${req.user._id}`);

      return ApiResponse.success(res, 'User upgraded to Pro', {
        userId: user._id,
        currentPlan: user.currentPlan,
      });

    } catch (error) {
      logger.error('Upgrade user error:', error);
      return ApiResponse.error(res, 'Failed to upgrade user');
    }
  }

  /**
   * Manually downgrade user to Basic
   * POST /api/v1/admin/users/:id/downgrade
   */
  static async downgradeUser(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);

      if (!user) {
        return ApiResponse.notFound(res, 'User not found');
      }

      if (user.currentPlan === 'basic') {
        return ApiResponse.badRequest(res, 'User already on Basic plan');
      }

      // Cancel Stripe subscription if exists
      if (user.stripeSubscriptionId && StripeService.isConfigured()) {
        await StripeService.cancelSubscription(id);
      } else {
        await user.downgradeToBasic();
      }

      logger.info(`User ${id} downgraded to Basic by admin ${req.user._id}`);

      return ApiResponse.success(res, 'User downgraded to Basic', {
        userId: user._id,
        currentPlan: user.currentPlan,
      });

    } catch (error) {
      logger.error('Downgrade user error:', error);
      return ApiResponse.error(res, 'Failed to downgrade user');
    }
  }
}

module.exports = AdminController;
