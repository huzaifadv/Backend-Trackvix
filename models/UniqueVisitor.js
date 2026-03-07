const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Unique Visitor Model
 * Tracks unique visitors using hashed IP addresses
 * Automatically expires after 30 days (for privacy)
 */
const uniqueVisitorSchema = new mongoose.Schema(
  {
    websiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
      required: true,
      index: true,
    },
    visitorHash: {
      type: String,
      required: true,
      index: true,
    },
    firstSeen: {
      type: Date,
      default: Date.now,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    visitCount: {
      type: Number,
      default: 1,
    },
    country: {
      type: String,
      uppercase: true,
    },
    city: {
      type: String,
    },
    device: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
// Optimized for multi-tenant isolation
uniqueVisitorSchema.index({ websiteId: 1, visitorHash: 1 }, { unique: true });

// TTL index - automatically delete visitors after 30 days
uniqueVisitorSchema.index({ lastSeen: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

// Additional indexes for analytics queries
uniqueVisitorSchema.index({ websiteId: 1, lastSeen: -1 }); // Recent visitors per website
uniqueVisitorSchema.index({ websiteId: 1, firstSeen: -1 }); // New visitors per website

/**
 * Static method to create visitor hash from IP + User Agent
 */
uniqueVisitorSchema.statics.createVisitorHash = function(ip, userAgent) {
  const data = `${ip}-${userAgent}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Static method to record or update visitor
 * IP-based tracking: Each unique IP = unique visitor per session
 * Creates hash from IP + UserAgent for privacy
 */
uniqueVisitorSchema.statics.recordVisitor = async function(websiteId, ip, userAgent, geoData, device) {
  // Create hash from IP + User Agent for unique identification
  const visitorHash = this.createVisitorHash(ip, userAgent);

  const result = await this.findOneAndUpdate(
    { websiteId, visitorHash },
    {
      $set: {
        lastSeen: new Date(),
        country: geoData.country,
        city: geoData.city,
        device: device,
      },
      $inc: { visitCount: 1 },
      $setOnInsert: {
        firstSeen: new Date(),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  return result;
};

/**
 * Static method to get unique visitor count for a date range
 */
uniqueVisitorSchema.statics.getUniqueCount = async function(websiteId, startDate, endDate) {
  const query = { websiteId };

  if (startDate || endDate) {
    query.lastSeen = {};
    if (startDate) query.lastSeen.$gte = new Date(startDate);
    if (endDate) query.lastSeen.$lte = new Date(endDate);
  }

  return this.countDocuments(query);
};

module.exports = mongoose.model('UniqueVisitor', uniqueVisitorSchema);
