const User = require('../models/User');
const { generateTokens } = require('../utils/jwt');
const logger = require('../config/logger');
const { OperationalError } = require('../middlewares/error.middleware');
const emailService = require('./email.service');

/**
 * Authentication Service
 * Business logic for user authentication
 */

class AuthService {
  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Object} User and tokens
   */
  async signup(userData) {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });

      if (existingUser) {
        throw new OperationalError('Email already registered', 409);
      }

      // Create new user with Basic plan by default
      const user = await User.create({
        name: userData.name,
        email: userData.email,
        password: userData.password,
        currentPlan: 'basic',
        subscriptionStatus: 'active',
      });

      // Generate and send verification code
      const verificationCode = user.generateVerificationCode();
      await user.save();

      // Send verification email
      try {
        await emailService.sendVerificationCode(user.email, user.name, verificationCode);
        logger.info(`Verification code sent to ${user.email}`);
      } catch (error) {
        logger.error('Failed to send verification email:', error);
        // Don't block signup if email fails - code is logged to console
      }

      // Create Stripe customer if configured
      const StripeService = require('./stripe.service');
      if (StripeService.isConfigured()) {
        try {
          const customer = await StripeService.createCustomer(user);
          user.stripeCustomerId = customer.id;
          await user.save();
        } catch (error) {
          logger.warn('Failed to create Stripe customer:', error.message);
          // Non-blocking - user can still be created
        }
      }

      // Generate tokens (user can login but needs to verify email to access dashboard)
      const tokens = generateTokens(user);

      logger.info(`New user registered: ${user.email}`);

      return {
        user: user.toPublicJSON(),
        ...tokens,
        requiresVerification: true,
      };
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('Signup error:', error);
      throw new OperationalError('Registration failed', 500);
    }
  }

  /**
   * Login user
   * @param {String} email - User email
   * @param {String} password - User password
   * @returns {Object} User and tokens
   */
  async login(email, password) {
    try {
      // Find user by credentials
      const user = await User.findByCredentials(email, password);

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate tokens
      const tokens = generateTokens(user);

      logger.info(`User logged in: ${user.email}`);

      return {
        user: user.toPublicJSON(),
        ...tokens,
      };
    } catch (error) {
      logger.warn(`Failed login attempt for: ${email}`);
      throw new OperationalError('Invalid credentials', 401);
    }
  }

  /**
   * Refresh access token
   * @param {String} refreshToken - Refresh token
   * @returns {Object} New tokens
   */
  async refreshToken(refreshToken) {
    try {
      const { verifyRefreshToken } = require('../utils/jwt');
      const decoded = verifyRefreshToken(refreshToken);

      // Find user
      const user = await User.findById(decoded.userId);

      if (!user || !user.isActive) {
        throw new OperationalError('User not found', 404);
      }

      // Generate new tokens
      const tokens = generateTokens(user);

      return tokens;
    } catch (error) {
      logger.error('Token refresh error:', error);
      throw new OperationalError('Token refresh failed', 401);
    }
  }

  /**
   * Get current user profile
   * @param {String} userId - User ID
   * @returns {Object} User data
   */
  async getProfile(userId) {
    try {
      const user = await User.findById(userId).populate('websites');

      if (!user) {
        throw new OperationalError('User not found', 404);
      }

      return user.toPublicJSON();
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('Get profile error:', error);
      throw new OperationalError('Failed to fetch profile', 500);
    }
  }

  /**
   * Update user profile
   * @param {String} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Updated user
   */
  async updateProfile(userId, updateData) {
    try {
      // Prevent updating sensitive fields
      const allowedUpdates = ['name', 'plan'];
      const updates = {};

      Object.keys(updateData).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          updates[key] = updateData[key];
        }
      });

      const user = await User.findByIdAndUpdate(
        userId,
        updates,
        { new: true, runValidators: true }
      );

      if (!user) {
        throw new OperationalError('User not found', 404);
      }

      logger.info(`User profile updated: ${user.email}`);

      return user.toPublicJSON();
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('Update profile error:', error);
      throw new OperationalError('Failed to update profile', 500);
    }
  }

  /**
   * Verify email with code
   * @param {String} userId - User ID
   * @param {String} code - Verification code
   * @returns {Object} Result
   */
  async verifyEmail(userId, code) {
    try {
      const user = await User.findById(userId).select(
        '+emailVerificationCode +emailVerificationExpires'
      );

      if (!user) {
        throw new OperationalError('User not found', 404);
      }

      if (user.isEmailVerified) {
        throw new OperationalError('Email already verified', 400);
      }

      const isValid = user.verifyEmail(code);

      if (!isValid) {
        throw new OperationalError('Invalid or expired verification code', 400);
      }

      await user.save();

      // Send welcome email
      try {
        await emailService.sendWelcomeEmail(user.email, user.name);
      } catch (error) {
        logger.error('Failed to send welcome email:', error);
        // Non-blocking
      }

      logger.info(`Email verified for user: ${user.email}`);

      return {
        success: true,
        message: 'Email verified successfully',
        user: user.toPublicJSON(),
      };
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('Email verification error:', error);
      throw new OperationalError('Verification failed', 500);
    }
  }

  /**
   * Resend verification code
   * @param {String} userId - User ID
   * @returns {Object} Result
   */
  async resendVerificationCode(userId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new OperationalError('User not found', 404);
      }

      if (user.isEmailVerified) {
        throw new OperationalError('Email already verified', 400);
      }

      // Generate new code
      const verificationCode = user.generateVerificationCode();
      await user.save();

      // Send verification email
      try {
        await emailService.sendVerificationCode(user.email, user.name, verificationCode);
        logger.info(`Verification code resent to ${user.email}`);
      } catch (error) {
        logger.error('Failed to resend verification email:', error);
        throw new OperationalError('Failed to send verification email', 500);
      }

      return {
        success: true,
        message: 'Verification code sent successfully',
      };
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('Resend verification error:', error);
      throw new OperationalError('Failed to resend verification code', 500);
    }
  }
}

module.exports = new AuthService();
