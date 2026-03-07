const express = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authLimiter } = require('../middlewares/security.middleware');
const {
  signupValidation,
  loginValidation,
  refreshTokenValidation,
  validate,
} = require('../validators/auth.validator');

const router = express.Router();

/**
 * Authentication Routes
 * Base: /api/v1/auth
 */

// Public routes with rate limiting
router.post(
  '/signup',
  authLimiter,
  signupValidation,
  validate,
  authController.signup
);

router.post(
  '/login',
  authLimiter,
  loginValidation,
  validate,
  authController.login
);

router.post(
  '/refresh',
  authLimiter,
  refreshTokenValidation,
  validate,
  authController.refreshToken
);

// Protected routes
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, authController.updateProfile);
router.post('/logout', authenticate, authController.logout);

// Email verification routes (protected)
router.post('/verify-email', authenticate, authController.verifyEmail);
router.post('/resend-verification', authenticate, authController.resendVerification);

module.exports = router;
