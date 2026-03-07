const mongoose = require('mongoose');

/**
 * Traffic Daily Stats Model
 * Aggregated traffic statistics per website per day
 * Optimized for horizontal scaling with atomic updates
 */
const trafficDailyStatsSchema = new mongoose.Schema(
  {
    websiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    totalVisits: {
      type: Number,
      default: 0,
    },
    // Traffic sources
    sources: {
      google: { type: Number, default: 0 },
      facebook: { type: Number, default: 0 },
      twitter: { type: Number, default: 0 },
      instagram: { type: Number, default: 0 },
      linkedin: { type: Number, default: 0 },
      youtube: { type: Number, default: 0 },
      direct: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },
    // UTM campaigns
    campaigns: {
      type: Map,
      of: Number,
      default: {},
    },
    // Countries
    countries: {
      type: Map,
      of: Number,
      default: {},
    },
    // Cities
    cities: {
      type: Map,
      of: Number,
      default: {},
    },
    // Devices
    devices: {
      desktop: { type: Number, default: 0 },
      mobile: { type: Number, default: 0 },
      tablet: { type: Number, default: 0 },
    },
    // Browsers
    browsers: {
      Chrome: { type: Number, default: 0 },
      Firefox: { type: Number, default: 0 },
      Safari: { type: Number, default: 0 },
      Edge: { type: Number, default: 0 },
      Other: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient querying
// Optimized for multi-tenant isolation and fast lookups
trafficDailyStatsSchema.index({ websiteId: 1, date: 1 }, { unique: true });
trafficDailyStatsSchema.index({ date: -1 }); // Time-series queries

// Static method for atomic increment
// NOTE: totalVisits is NOT used anymore (we track visitors, not pageviews)
trafficDailyStatsSchema.statics.incrementStats = async function(websiteId, date, updates) {
  const dateObj = new Date(date);
  dateObj.setHours(0, 0, 0, 0);

  const incrementOps = {};

  // Sources
  if (updates.source) {
    incrementOps[`sources.${updates.source}`] = 1;
  }

  // Devices
  if (updates.device) {
    incrementOps[`devices.${updates.device}`] = 1;
  }

  // Browsers
  if (updates.browser) {
    incrementOps[`browsers.${updates.browser}`] = 1;
  }

  // Countries (using Map)
  const setOps = {};
  if (updates.country) {
    setOps[`countries.${updates.country}`] = 1;
  }

  // Cities (using Map)
  if (updates.city) {
    setOps[`cities.${updates.city}`] = 1;
  }

  // UTM Campaign
  if (updates.campaign) {
    setOps[`campaigns.${updates.campaign}`] = 1;
  }

  // Only update if there's something to increment
  if (Object.keys(incrementOps).length === 0 && Object.keys(setOps).length === 0) {
    return null;
  }

  const updateDoc = { $inc: incrementOps };
  if (Object.keys(setOps).length > 0) {
    updateDoc.$inc = { ...updateDoc.$inc, ...setOps };
  }

  return this.findOneAndUpdate(
    { websiteId, date: dateObj },
    updateDoc,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

module.exports = mongoose.model('TrafficDailyStats', trafficDailyStatsSchema);
