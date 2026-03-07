const mongoose = require('mongoose');

/**
 * Leads Daily Stats Model
 * Aggregated lead statistics per website per day
 * Tracks call clicks and form submissions
 */
const leadsDailyStatsSchema = new mongoose.Schema(
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
    callClicks: {
      type: Number,
      default: 0,
    },
    formSubmissions: {
      type: Number,
      default: 0,
    },
    ctaClicks: {
      type: Number,
      default: 0,
    },
    whatsappClicks: {
      type: Number,
      default: 0,
    },
    // Breakdown by device
    deviceBreakdown: {
      callClicks: {
        desktop: { type: Number, default: 0 },
        mobile: { type: Number, default: 0 },
        tablet: { type: Number, default: 0 },
      },
      formSubmissions: {
        desktop: { type: Number, default: 0 },
        mobile: { type: Number, default: 0 },
        tablet: { type: Number, default: 0 },
      },
      ctaClicks: {
        desktop: { type: Number, default: 0 },
        mobile: { type: Number, default: 0 },
        tablet: { type: Number, default: 0 },
      },
      whatsappClicks: {
        desktop: { type: Number, default: 0 },
        mobile: { type: Number, default: 0 },
        tablet: { type: Number, default: 0 },
      },
    },
    // Form IDs tracked
    forms: {
      type: Map,
      of: Number,
      default: {},
    },
    // CTA buttons tracked
    ctaButtons: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient querying
// Optimized for multi-tenant isolation and fast lookups
leadsDailyStatsSchema.index({ websiteId: 1, date: 1 }, { unique: true });
leadsDailyStatsSchema.index({ date: -1 }); // Time-series queries

// Static method for atomic increment
leadsDailyStatsSchema.statics.incrementStats = async function(websiteId, date, updates) {
  const dateObj = new Date(date);
  dateObj.setHours(0, 0, 0, 0);

  const incrementOps = {};

  if (updates.eventType === 'tel_click') {
    incrementOps.callClicks = 1;
    if (updates.device) {
      incrementOps[`deviceBreakdown.callClicks.${updates.device}`] = 1;
    }
  }

  if (updates.eventType === 'form_submit') {
    incrementOps.formSubmissions = 1;
    if (updates.device) {
      incrementOps[`deviceBreakdown.formSubmissions.${updates.device}`] = 1;
    }
    if (updates.formId) {
      incrementOps[`forms.${updates.formId}`] = 1;
    }
  }

  if (updates.eventType === 'cta_click') {
    incrementOps.ctaClicks = 1;
    if (updates.device) {
      incrementOps[`deviceBreakdown.ctaClicks.${updates.device}`] = 1;
    }
    if (updates.ctaId) {
      incrementOps[`ctaButtons.${updates.ctaId}`] = 1;
    }
  }

  if (updates.eventType === 'whatsapp_click') {
    incrementOps.whatsappClicks = 1;
    if (updates.device) {
      incrementOps[`deviceBreakdown.whatsappClicks.${updates.device}`] = 1;
    }
  }

  return this.findOneAndUpdate(
    { websiteId, date: dateObj },
    { $inc: incrementOps },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

module.exports = mongoose.model('LeadsDailyStats', leadsDailyStatsSchema);
