const Website = require('../models/Website');
const User = require('../models/User');
const logger = require('../config/logger');
const { OperationalError } = require('../middlewares/error.middleware');
const crypto = require('crypto');

/**
 * Website Service
 * Business logic for website management
 */

class WebsiteService {
  /**
   * Create a new website
   * @param {String} userId - User ID
   * @param {String} domain - Website domain
   * @returns {Object} Created website
   */
  async createWebsite(userId, domain) {
    try {
      // Check if website already exists for this user
      const existingWebsite = await Website.findOne({ userId, domain });

      if (existingWebsite) {
        throw new OperationalError('Website already registered', 409);
      }

      // Create website with explicit API key generation
      const apiKeyLength = parseInt(process.env.API_KEY_LENGTH) || 32;
      const apiKey = crypto.randomBytes(apiKeyLength).toString('hex');

      const website = new Website({
        userId,
        domain,
        apiKey,
      });

      await website.save();

      // Add website to user's websites array
      await User.findByIdAndUpdate(userId, {
        $push: { websites: website._id },
      });

      logger.info(`New website created: ${domain} for user ${userId}`);

      return website;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('Create website error:', error);
      throw new OperationalError('Failed to create website', 500);
    }
  }

  /**
   * Get all websites for a user (including pending, active, and inactive)
   * @param {String} userId - User ID
   * @returns {Array} List of websites
   */
  async getUserWebsites(userId) {
    try {
      // Fetch all websites regardless of status (pending, active, inactive)
      const websites = await Website.find({ userId })
        .sort({ createdAt: -1 });

      return websites;
    } catch (error) {
      logger.error('Get user websites error:', error);
      throw new OperationalError('Failed to fetch websites', 500);
    }
  }

  /**
   * Get website by ID
   * @param {String} websiteId - Website ID
   * @param {String} userId - User ID (for authorization)
   * @returns {Object} Website data
   */
  async getWebsiteById(websiteId, userId) {
    try {
      const website = await Website.findOne({
        _id: websiteId,
        userId,
      });

      if (!website) {
        throw new OperationalError('Website not found', 404);
      }

      return website;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('Get website error:', error);
      throw new OperationalError('Failed to fetch website', 500);
    }
  }

  /**
   * Update website
   * @param {String} websiteId - Website ID
   * @param {String} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Updated website
   */
  async updateWebsite(websiteId, userId, updateData) {
    try {
      // Only allow updating domain
      const allowedUpdates = ['domain'];
      const updates = {};

      Object.keys(updateData).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          updates[key] = updateData[key];
        }
      });

      const website = await Website.findOneAndUpdate(
        { _id: websiteId, userId },
        updates,
        { new: true, runValidators: true }
      );

      if (!website) {
        throw new OperationalError('Website not found', 404);
      }

      logger.info(`Website updated: ${websiteId}`);

      return website;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('Update website error:', error);
      throw new OperationalError('Failed to update website', 500);
    }
  }

  /**
   * Delete website (hard delete - permanently removes from database)
   * Cascades deletion to all related data: events, stats, visitors, health records
   * @param {String} websiteId - Website ID
   * @param {String} userId - User ID
   * @returns {Boolean} Success status
   */
  async deleteWebsite(websiteId, userId) {
    try {
      // Verify website exists and belongs to user
      const website = await Website.findOne({
        _id: websiteId,
        userId,
      });

      if (!website) {
        throw new OperationalError('Website not found', 404);
      }

      logger.info(`Starting cascade deletion for website: ${websiteId} (${website.domain})`);

      // Import all related models
      const Event = require('../models/Event');
      const TrafficDailyStats = require('../models/TrafficDailyStats');
      const LeadsDailyStats = require('../models/LeadsDailyStats');
      const UniqueVisitor = require('../models/UniqueVisitor');
      const WebsiteHealth = require('../models/WebsiteHealth');
      const ScanQueue = require('../models/ScanQueue');

      // Cascade delete all related data in parallel for better performance
      const deletionResults = await Promise.allSettled([
        // Delete all events
        Event.deleteMany({ websiteId }),

        // Delete all traffic stats
        TrafficDailyStats.deleteMany({ websiteId }),

        // Delete all leads stats
        LeadsDailyStats.deleteMany({ websiteId }),

        // Delete all unique visitors
        UniqueVisitor.deleteMany({ websiteId }),

        // Delete all health scan records
        WebsiteHealth.deleteMany({ websiteId }),

        // Delete all pending/processing scan queue jobs
        ScanQueue.deleteMany({ websiteId }),
      ]);

      // Log deletion results
      let totalDeleted = 0;
      deletionResults.forEach((result, index) => {
        const modelNames = ['Events', 'TrafficDailyStats', 'LeadsDailyStats', 'UniqueVisitors', 'WebsiteHealth', 'ScanQueue'];
        if (result.status === 'fulfilled') {
          const count = result.value.deletedCount || 0;
          totalDeleted += count;
          logger.info(`Deleted ${count} ${modelNames[index]} for website ${websiteId}`);
        } else {
          logger.error(`Failed to delete ${modelNames[index]}:`, result.reason);
        }
      });

      // Finally, delete the website itself
      await Website.findByIdAndDelete(websiteId);

      // Remove from user's websites array
      await User.findByIdAndUpdate(userId, {
        $pull: { websites: websiteId },
      });

      logger.info(`Website permanently deleted: ${websiteId} (${website.domain}) - Total related records deleted: ${totalDeleted}`);

      return true;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('Delete website error:', error);
      throw new OperationalError('Failed to delete website', 500);
    }
  }

  /**
   * Toggle website active status
   * @param {String} websiteId - Website ID
   * @param {String} userId - User ID
   * @returns {Object} Updated website
   */
  async toggleWebsiteStatus(websiteId, userId) {
    try {
      const website = await Website.findOne({
        _id: websiteId,
        userId,
      });

      if (!website) {
        throw new OperationalError('Website not found', 404);
      }

      // Toggle isActive and update status
      website.isActive = !website.isActive;
      website.status = website.isActive ? 'active' : 'inactive';
      await website.save();

      logger.info(`Website status toggled: ${websiteId} - now ${website.status}`);

      return website;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('Toggle website status error:', error);
      throw new OperationalError('Failed to toggle website status', 500);
    }
  }

  /**
   * Regenerate API key for website
   * @param {String} websiteId - Website ID
   * @param {String} userId - User ID
   * @returns {Object} Website with new API key
   */
  async regenerateApiKey(websiteId, userId) {
    try {
      const website = await Website.findOne({
        _id: websiteId,
        userId,
        isActive: true,
      });

      if (!website) {
        throw new OperationalError('Website not found', 404);
      }

      await website.regenerateApiKey();

      logger.info(`API key regenerated for website: ${websiteId}`);

      return website;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('Regenerate API key error:', error);
      throw new OperationalError('Failed to regenerate API key', 500);
    }
  }
}

module.exports = new WebsiteService();
