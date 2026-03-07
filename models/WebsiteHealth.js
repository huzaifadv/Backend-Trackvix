const mongoose = require('mongoose');

/**
 * Website Health Model
 * Stores SEO, performance, and health analysis results
 */
const websiteHealthSchema = new mongoose.Schema(
  {
    websiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
      required: true,
      index: true,
    },
    // Overall health
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    status: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor', 'critical'],
      required: true,
    },
    // Score breakdown
    scores: {
      performance: { type: Number, min: 0, max: 100, default: 0 },
      seo: { type: Number, min: 0, max: 100, default: 0 },
      structure: { type: Number, min: 0, max: 100, default: 0 },
      technical: { type: Number, min: 0, max: 100, default: 0 },
    },
    // Issue counts
    issueCount: {
      type: Number,
      default: 0,
    },
    criticalCount: {
      type: Number,
      default: 0,
    },
    warningCount: {
      type: Number,
      default: 0,
    },
    // Issues array
    issues: [
      {
        type: {
          type: String,
          enum: ['critical', 'warning', 'info'],
        },
        category: {
          type: String,
          enum: ['performance', 'seo', 'structure', 'technical', 'accessibility'],
        },
        issue: String,
        recommendation: String,
      }
    ],
    // Priority issues (subset)
    priorityIssues: [
      {
        type: {
          type: String,
          enum: ['critical', 'warning'],
        },
        category: String,
        issue: String,
        recommendation: String,
      }
    ],
    // AI recommendations
    aiRecommendations: [
      {
        title: String,
        description: String,
        priority: {
          type: String,
          enum: ['High', 'Medium', 'Low'],
        },
        impact: String,
        category: {
          type: String,
          enum: ['performance', 'seo', 'structure', 'technical'],
        },
      }
    ],
    // SEO data snapshot
    seoData: {
      title: String,
      metaDescription: String,
      h1Count: Number,
      h2Count: Number,
      imagesTotal: Number,
      imagesWithoutAlt: Number,
      internalLinks: Number,
      externalLinks: Number,
      hasCanonical: Boolean,
    },
    // PageSpeed metrics
    pageSpeed: {
      mobile: {
        performance: Number,
        accessibility: Number,
        seo: Number,
        bestPractices: Number,
        lcp: Number, // Largest Contentful Paint
        cls: Number, // Cumulative Layout Shift
      },
      desktop: {
        performance: Number,
        accessibility: Number,
        seo: Number,
        bestPractices: Number,
      },
    },
    // Scan metadata
    scanDuration: {
      type: Number, // milliseconds
    },
    scannedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    nextScanAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
websiteHealthSchema.index({ websiteId: 1, scannedAt: -1 });
websiteHealthSchema.index({ overallScore: 1 });
websiteHealthSchema.index({ status: 1 });
websiteHealthSchema.index({ nextScanAt: 1 });

// Static method to get latest health for website
websiteHealthSchema.statics.getLatest = async function(websiteId) {
  return this.findOne({ websiteId })
    .sort({ scannedAt: -1 })
    .limit(1);
};

// Static method to get health history
websiteHealthSchema.statics.getHistory = async function(websiteId, limit = 10) {
  return this.find({ websiteId })
    .sort({ scannedAt: -1 })
    .limit(limit)
    .select('overallScore scores scannedAt status');
};

// Instance method to check if scan is needed
websiteHealthSchema.methods.needsRescan = function() {
  if (!this.nextScanAt) return true;
  return new Date() >= this.nextScanAt;
};

// Pre-save hook to set next scan date
websiteHealthSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('scannedAt')) {
    // Schedule next scan in 7 days
    const nextScan = new Date(this.scannedAt);
    nextScan.setDate(nextScan.getDate() + 7);
    this.nextScanAt = nextScan;
  }
  next();
});

module.exports = mongoose.model('WebsiteHealth', websiteHealthSchema);
