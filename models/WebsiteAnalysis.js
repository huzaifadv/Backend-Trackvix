const mongoose = require('mongoose');

/**
 * Website Analysis Model
 * Stores AI-powered website analysis results with 24-hour caching
 */
const websiteAnalysisSchema = new mongoose.Schema(
  {
    websiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    // Scores
    overall_score: {
      type: Number,
      min: 0,
      max: 100,
    },
    seo_score: {
      type: Number,
      min: 0,
      max: 100,
    },
    conversion_score: {
      type: Number,
      min: 0,
      max: 100,
    },
    performance_score: {
      type: Number,
      min: 0,
      max: 100,
    },
    summary: {
      type: String,
    },
    // Analysis results
    issues: [
      {
        category: {
          type: String,
          enum: ['required', 'optional'],
        },
        priority: {
          type: String,
          enum: ['high', 'low'],
        },
        element: String,
        problem: String,
        fix: String,
      },
    ],
    quick_wins: [String],
    strengths: [String],
    // Raw data snapshots
    crawlData: {
      type: mongoose.Schema.Types.Mixed,
    },
    pagespeedData: {
      type: mongoose.Schema.Types.Mixed,
    },
    // Error info (if failed)
    errorMessage: {
      type: String,
    },
    // Cache expiry
    expiresAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
websiteAnalysisSchema.index({ websiteId: 1, createdAt: -1 });
websiteAnalysisSchema.index({ websiteId: 1, status: 1 });

// Static: get latest completed analysis for a website
websiteAnalysisSchema.statics.getLatest = async function (websiteId) {
  return this.findOne({ websiteId, status: 'completed' })
    .sort({ createdAt: -1 })
    .limit(1);
};

// Static: get cached (non-expired) analysis
websiteAnalysisSchema.statics.getCached = async function (websiteId) {
  return this.findOne({
    websiteId,
    status: 'completed',
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .limit(1);
};

// Static: check if analysis is in progress
websiteAnalysisSchema.statics.isInProgress = async function (websiteId) {
  const pending = await this.findOne({
    websiteId,
    status: 'pending',
    createdAt: { $gt: new Date(Date.now() - 2 * 60 * 1000) }, // within 2 minutes
  });
  return !!pending;
};

// Static: expire stale pending analyses (older than 2 minutes)
websiteAnalysisSchema.statics.expireStale = async function (websiteId) {
  return this.updateMany(
    {
      websiteId,
      status: 'pending',
      createdAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) },
    },
    {
      $set: { status: 'failed', errorMessage: 'Analysis timed out' },
    }
  );
};

// Pre-save: set expiresAt to 24 hours after creation
websiteAnalysisSchema.pre('save', function (next) {
  if (this.isNew && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  next();
});

module.exports = mongoose.model('WebsiteAnalysis', websiteAnalysisSchema);
