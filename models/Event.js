const mongoose = require('mongoose');

/**
 * Event Model Schema
 * Stores tracking events from monitored websites
 */
const eventSchema = new mongoose.Schema(
  {
    websiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
      required: [true, 'Website ID is required'],
      index: true,
    },
    type: {
      type: String,
      enum: ['visitor', 'pageview', 'call_click', 'form_submit', 'cta_click', 'whatsapp_click'],
      required: [true, 'Event type is required'],
      index: true,
    },
    source: {
      type: String,
      trim: true,
      maxlength: [500, 'Source cannot exceed 500 characters'],
    },
    country: {
      type: String,
      trim: true,
      maxlength: [100, 'Country name cannot exceed 100 characters'],
    },
    city: {
      type: String,
      trim: true,
      maxlength: [100, 'City name cannot exceed 100 characters'],
    },
    device: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown',
    },
    visitorId: {
      type: String,
      trim: true,
      index: true,
      maxlength: [100, 'Visitor ID cannot exceed 100 characters'],
    },
    isNewVisitor: {
      type: Boolean,
      default: false,
    },
    metadata: {
      userAgent: String,
      ip: String,
      referrer: String,
      path: String,
      language: String,
      screenResolution: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * Indexes for query optimization
 * Critical for analytics queries with time ranges
 * Optimized for multi-tenant isolation and 50k+ users
 */
// Core time-series indexes
eventSchema.index({ websiteId: 1, createdAt: -1 });
eventSchema.index({ websiteId: 1, type: 1, createdAt: -1 });
eventSchema.index({ createdAt: -1 });

// Visitor tracking
eventSchema.index({ websiteId: 1, visitorId: 1 });
eventSchema.index({ visitorId: 1, createdAt: -1 });

// Location analytics - CRITICAL for performance
eventSchema.index({ websiteId: 1, country: 1, createdAt: -1 });
eventSchema.index({ websiteId: 1, city: 1, createdAt: -1 });
eventSchema.index({ country: 1 });

// Device analytics
eventSchema.index({ websiteId: 1, device: 1, createdAt: -1 });

// Type-based queries (admin analytics, event filtering)
eventSchema.index({ type: 1, createdAt: -1 });
eventSchema.index({ websiteId: 1, type: 1 }); // Type filtering without dates

// New visitor analytics
eventSchema.index({ isNewVisitor: 1, createdAt: -1 });
eventSchema.index({ websiteId: 1, isNewVisitor: 1, createdAt: -1 });

/**
 * TTL index for automatic data cleanup (optional)
 * Automatically delete events older than 90 days
 * Uncomment if you want automatic cleanup
 */
// eventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

/**
 * Static method to get event statistics
 */
eventSchema.statics.getStatsByWebsite = async function (websiteId, startDate, endDate) {
  const match = {
    websiteId: mongoose.Types.ObjectId(websiteId),
  };

  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
      },
    },
  ]);
};

/**
 * Static method to get events by country
 */
eventSchema.statics.getEventsByCountry = async function (websiteId, startDate, endDate) {
  const match = {
    websiteId: mongoose.Types.ObjectId(websiteId),
    country: { $exists: true, $ne: null },
  };

  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$country',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);
};

/**
 * Static method to get events by device
 */
eventSchema.statics.getEventsByDevice = async function (websiteId, startDate, endDate) {
  const match = {
    websiteId: mongoose.Types.ObjectId(websiteId),
  };

  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$device',
        count: { $sum: 1 },
      },
    },
  ]);
};

module.exports = mongoose.model('Event', eventSchema);
