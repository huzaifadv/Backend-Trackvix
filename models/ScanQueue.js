const mongoose = require('mongoose');

/**
 * Scan Queue Model
 * Manages async website scan jobs
 * Ready for Redis queue migration
 */
const scanQueueSchema = new mongoose.Schema(
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
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high'],
      default: 'normal',
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    result: {
      overallScore: Number,
      issueCount: Number,
      error: String,
    },
    startedAt: Date,
    completedAt: Date,
    failedAt: Date,
    error: String,
  },
  {
    timestamps: true,
  }
);

// Indexes for queue processing
scanQueueSchema.index({ status: 1, priority: -1, createdAt: 1 });
scanQueueSchema.index({ websiteId: 1, status: 1 });
scanQueueSchema.index({ createdAt: 1 }); // For cleanup

// Static method to enqueue scan
scanQueueSchema.statics.enqueue = async function(websiteId, url, priority = 'normal') {
  // Check if already pending/processing
  const existing = await this.findOne({
    websiteId,
    status: { $in: ['pending', 'processing'] },
  });

  if (existing) {
    return existing;
  }

  return this.create({
    websiteId,
    url,
    priority,
    status: 'pending',
  });
};

// Static method to dequeue next job
scanQueueSchema.statics.dequeue = async function() {
  return this.findOneAndUpdate(
    {
      status: 'pending',
    },
    {
      status: 'processing',
      startedAt: new Date(),
      $inc: { attempts: 1 },
    },
    {
      sort: { priority: -1, createdAt: 1 }, // High priority first, then FIFO
      new: true,
    }
  );
};

// Instance method to mark completed
scanQueueSchema.methods.markCompleted = function(result) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.result = result;
  return this.save();
};

// Instance method to mark failed
scanQueueSchema.methods.markFailed = function(error) {
  this.status = this.attempts >= this.maxAttempts ? 'failed' : 'pending';
  this.failedAt = new Date();
  this.error = error;
  return this.save();
};

// Static method to cleanup old jobs (run periodically)
scanQueueSchema.statics.cleanup = async function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return this.deleteMany({
    status: { $in: ['completed', 'failed'] },
    createdAt: { $lt: cutoffDate },
  });
};

module.exports = mongoose.model('ScanQueue', scanQueueSchema);
