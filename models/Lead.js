const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const leadSchema = new mongoose.Schema({
  websiteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Website',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Lead contact information
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  message: {
    type: String,
    trim: true
  },
  subject: {
    type: String,
    trim: true
  },
  formName: {
    type: String,
    trim: true,
    default: 'Contact Form'
  },
  // Visitor intelligence data
  source: {
    type: String,
    enum: ['Direct', 'Google', 'Facebook', 'Instagram', 'Twitter', 'LinkedIn', 'YouTube', 'Other'],
    default: 'Direct'
  },
  device: {
    type: String,
    enum: ['Desktop', 'Mobile', 'Tablet'],
    default: 'Desktop'
  },
  browser: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  ipAddress: {
    type: String,
    trim: true
  },
  // Visitor journey tracking
  pageUrl: {
    type: String,
    trim: true
  },
  referrer: {
    type: String,
    trim: true
  },
  visitorFingerprint: {
    type: String,
    trim: true,
    index: true
  },
  pagesVisited: [{
    url: String,
    timestamp: Date
  }],
  // Lead management
  status: {
    type: String,
    enum: ['new', 'contacted', 'closed'],
    default: 'new',
    index: true
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  notes: [noteSchema],
  // Event tracking
  eventType: {
    type: String,
    enum: ['form_submit', 'call_click', 'whatsapp_click', 'cta_click'],
    default: 'form_submit'
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  // Dynamic form fields - stores any extra fields from the form
  customFields: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  strict: false  // Allow dynamic fields
});

// Compound indexes for efficient queries
leadSchema.index({ userId: 1, createdAt: -1 });
leadSchema.index({ websiteId: 1, createdAt: -1 });
leadSchema.index({ userId: 1, status: 1, createdAt: -1 });
leadSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

// Instance methods
leadSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

leadSchema.methods.markAsContacted = function() {
  this.status = 'contacted';
  this.isRead = true;
  return this.save();
};

leadSchema.methods.markAsClosed = function() {
  this.status = 'closed';
  this.isRead = true;
  return this.save();
};

leadSchema.methods.addNote = function(noteText) {
  this.notes.push({ text: noteText });
  return this.save();
};

// Static methods
leadSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({ userId, isRead: false });
};

leadSchema.statics.getLeadsByWebsite = function(websiteId, options = {}) {
  const { status, limit = 50, skip = 0 } = options;
  const query = { websiteId };

  if (status) {
    query.status = status;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('websiteId', 'domain name');
};

leadSchema.statics.getLeadsByUser = function(userId, options = {}) {
  const { status, websiteId, limit = 50, skip = 0 } = options;
  const query = { userId };

  if (status) {
    query.status = status;
  }

  if (websiteId) {
    query.websiteId = websiteId;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('websiteId', 'domain name');
};

const Lead = mongoose.model('Lead', leadSchema);

module.exports = Lead;
