const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Model Schema
 * Handles user authentication and plan management
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid email',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Don't return password by default
    },
    // Email Verification
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationCode: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    // Subscription & Billing
    currentPlan: {
      type: String,
      enum: ['basic', 'pro'],
      default: 'basic',
    },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'canceled', 'past_due', 'incomplete'],
      default: 'active',
    },
    subscriptionEndsAt: {
      type: Date,
      default: null,
    },
    stripeCustomerId: {
      type: String,
      default: null,
    },
    stripeSubscriptionId: {
      type: String,
      default: null,
    },
    // User Management
    websites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Website',
      },
    ],
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isSuspended: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * Indexes for performance optimization
 * Optimized for 50k+ users
 */
userSchema.index({ createdAt: -1 });
userSchema.index({ stripeCustomerId: 1 });
userSchema.index({ currentPlan: 1 }); // Plan-based queries
userSchema.index({ subscriptionStatus: 1 }); // Subscription filtering
userSchema.index({ currentPlan: 1, subscriptionStatus: 1 }); // Combined plan queries
userSchema.index({ role: 1 }); // Admin queries
userSchema.index({ isSuspended: 1 }); // Filter suspended users
userSchema.index({ isEmailVerified: 1 }); // Email verification status

/**
 * Pre-save middleware to hash password
 */
userSchema.pre('save', async function (next) {
  // Only hash password if it's modified
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Method to compare password for login
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

/**
 * Method to get public user data (exclude sensitive fields)
 */
userSchema.methods.toPublicJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

/**
 * Static method to find user by credentials
 */
userSchema.statics.findByCredentials = async function (email, password) {
  const user = await this.findOne({ email, isActive: true }).select('+password');

  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isPasswordMatch = await user.comparePassword(password);

  if (!isPasswordMatch) {
    throw new Error('Invalid credentials');
  }

  return user;
};

/**
 * Virtual for website count
 */
userSchema.virtual('websiteCount').get(function () {
  return this.websites ? this.websites.length : 0;
});

/**
 * Method to check if user is on pro plan
 */
userSchema.methods.isPro = function() {
  return this.currentPlan === 'pro' && this.subscriptionStatus === 'active';
};

/**
 * Method to check if user can add websites
 */
userSchema.methods.canAddWebsite = async function() {
  const Plan = mongoose.model('Plan');
  const plan = await Plan.getByName(this.currentPlan);

  if (!plan) return false;

  const websiteCount = await mongoose.model('Website').countDocuments({ userId: this._id });
  return websiteCount < plan.websiteLimit;
};

/**
 * Method to upgrade to pro
 */
userSchema.methods.upgradeToPro = function(stripeSubscriptionId) {
  this.currentPlan = 'pro';
  this.subscriptionStatus = 'active';
  this.stripeSubscriptionId = stripeSubscriptionId;
  this.subscriptionEndsAt = null;
  return this.save();
};

/**
 * Method to downgrade to basic
 */
userSchema.methods.downgradeToBasic = function() {
  this.currentPlan = 'basic';
  this.subscriptionStatus = 'active';
  this.stripeSubscriptionId = null;
  this.subscriptionEndsAt = null;
  return this.save();
};

/**
 * Method to suspend user
 */
userSchema.methods.suspend = function() {
  this.isSuspended = true;
  return this.save();
};

/**
 * Method to unsuspend user
 */
userSchema.methods.unsuspend = function() {
  this.isSuspended = false;
  return this.save();
};

/**
 * Generate email verification code
 */
userSchema.methods.generateVerificationCode = function() {
  const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
  this.emailVerificationCode = code;
  this.emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return code;
};

/**
 * Verify email with code
 */
userSchema.methods.verifyEmail = function(code) {
  if (!this.emailVerificationCode || !this.emailVerificationExpires) {
    return false;
  }

  if (this.emailVerificationCode !== code) {
    return false;
  }

  if (new Date() > this.emailVerificationExpires) {
    return false; // Expired
  }

  this.isEmailVerified = true;
  this.emailVerificationCode = undefined;
  this.emailVerificationExpires = undefined;
  return true;
};

module.exports = mongoose.model('User', userSchema);
