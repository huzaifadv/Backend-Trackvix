const mongoose = require('mongoose');

/**
 * Subscription Plan Model
 * Defines pricing tiers and feature limits
 */
const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: ['basic', 'pro'],
    },
    displayName: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    websiteLimit: {
      type: Number,
      required: true,
      min: 1,
    },
    features: [
      {
        name: String,
        enabled: Boolean,
      }
    ],
    stripePriceId: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast lookups
// Note: name index already created by unique: true in schema
planSchema.index({ isActive: 1 });

// Static method to get plan by name
planSchema.statics.getByName = async function(name) {
  return this.findOne({ name, isActive: true });
};

// Static method to initialize default plans
planSchema.statics.initializePlans = async function() {
  const plans = [
    {
      name: 'basic',
      displayName: 'Basic',
      price: 0,
      websiteLimit: 1,
      features: [
        { name: 'Traffic tracking', enabled: true },
        { name: 'Traffic source detection', enabled: true },
        { name: 'Location tracking', enabled: true },
        { name: 'Event tracking (clicks, forms)', enabled: true },
        { name: 'SEO scan', enabled: true },
        { name: 'Broken link detection', enabled: true },
        { name: 'Website health monitoring', enabled: true },
        { name: 'AI improvement suggestions', enabled: false },
        { name: 'High-converting layout recommendations', enabled: false },
        { name: 'AI landing page analysis', enabled: false },
        { name: 'Advanced growth insights', enabled: false },
      ],
      stripePriceId: null,
      isActive: true,
    },
    {
      name: 'pro',
      displayName: 'Pro',
      price: 15,
      websiteLimit: 3,
      features: [
        { name: 'Traffic tracking', enabled: true },
        { name: 'Traffic source detection', enabled: true },
        { name: 'Location tracking', enabled: true },
        { name: 'Event tracking (clicks, forms)', enabled: true },
        { name: 'SEO scan', enabled: true },
        { name: 'Broken link detection', enabled: true },
        { name: 'Website health monitoring', enabled: true },
        { name: 'AI improvement suggestions', enabled: true },
        { name: 'High-converting layout recommendations', enabled: true },
        { name: 'AI landing page analysis', enabled: true },
        { name: 'Advanced growth insights', enabled: true },
      ],
      stripePriceId: process.env.STRIPE_PRO_PRICE_ID || null,
      isActive: true,
    },
  ];

  for (const planData of plans) {
    await this.findOneAndUpdate(
      { name: planData.name },
      planData,
      { upsert: true, new: true }
    );
  }

  return plans;
};

module.exports = mongoose.model('Plan', planSchema);
