const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Website Model Schema
 * Tracks monitored websites with API key authentication
 */
const websiteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    domain: {
      type: String,
      required: [true, 'Domain is required'],
      trim: true,
      lowercase: true,
      match: [
        /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/,
        'Please provide a valid domain',
      ],
    },
    apiKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: false, // Start as pending until first event received
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'inactive'],
      default: 'pending',
    },
    metadata: {
      lastEventAt: {
        type: Date,
      },
      totalEvents: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * Compound index for efficient queries
 * Optimized for multi-tenant isolation
 */
websiteSchema.index({ userId: 1, domain: 1 }, { unique: true });
websiteSchema.index({ createdAt: -1 });
websiteSchema.index({ status: 1 }); // Filter by status
websiteSchema.index({ userId: 1, status: 1 }); // User's websites by status

/**
 * Pre-save middleware to generate API key
 */
websiteSchema.pre('save', function (next) {
  // Generate API key only for new documents
  if (this.isNew && !this.apiKey) {
    this.apiKey = this.generateApiKey();
  }
  next();
});

/**
 * Method to generate secure API key
 */
websiteSchema.methods.generateApiKey = function () {
  const length = parseInt(process.env.API_KEY_LENGTH) || 32;
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Method to regenerate API key
 */
websiteSchema.methods.regenerateApiKey = function () {
  this.apiKey = this.generateApiKey();
  return this.save();
};

/**
 * Static method to find website by API key
 * Accepts both active and pending websites (will be activated on first event)
 */
websiteSchema.statics.findByApiKey = async function (apiKey) {
  const website = await this.findOne({ apiKey });

  if (!website) {
    throw new Error('Invalid API key');
  }

  return website;
};

/**
 * Method to update event metadata
 */
websiteSchema.methods.incrementEventCount = function () {
  this.metadata.totalEvents += 1;
  this.metadata.lastEventAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Website', websiteSchema);
