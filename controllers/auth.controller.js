const authService = require('../services/auth.service');
const ApiResponse = require('../utils/response');
const { asyncHandler } = require('../middlewares/error.middleware');

/**
 * Authentication Controller
 * Handles HTTP requests for authentication
 */

class AuthController {
  /**
   * Signup new user
   * POST /api/v1/auth/signup
   */
  signup = asyncHandler(async (req, res) => {
    const { name, email, password, plan } = req.body;

    const result = await authService.signup({
      name,
      email,
      password,
      plan,
    });

    return ApiResponse.created(res, 'User registered successfully', result);
  });

  /**
   * Login user
   * POST /api/v1/auth/login
   */
  login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const result = await authService.login(email, password);

    return ApiResponse.success(res, 200, 'Login successful', result);
  });

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh
   */
  refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    const tokens = await authService.refreshToken(refreshToken);

    return ApiResponse.success(res, 200, 'Token refreshed successfully', tokens);
  });

  /**
   * Get current user profile
   * GET /api/v1/auth/profile
   */
  getProfile = asyncHandler(async (req, res) => {
    const user = await authService.getProfile(req.userId);

    return ApiResponse.success(res, 200, 'Profile fetched successfully', user);
  });

  /**
   * Update user profile
   * PUT /api/v1/auth/profile
   */
  updateProfile = asyncHandler(async (req, res) => {
    const user = await authService.updateProfile(req.userId, req.body);

    return ApiResponse.success(res, 200, 'Profile updated successfully', user);
  });

  /**
   * Logout user (client-side token removal)
   * POST /api/v1/auth/logout
   */
  logout = asyncHandler(async (req, res) => {
    // In stateless JWT, logout is handled client-side
    // This endpoint can be used for logging purposes
    return ApiResponse.success(res, 200, 'Logout successful');
  });

  /**
   * Change password
   * POST /api/v1/auth/change-password
   */
  changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return ApiResponse.error(res, 400, 'Current password and new password are required');
    }

    if (newPassword.length < 8) {
      return ApiResponse.error(res, 400, 'New password must be at least 8 characters');
    }

    const result = await authService.changePassword(req.userId, currentPassword, newPassword);

    return ApiResponse.success(res, 200, result.message);
  });

  /**
   * Verify email with code
   * POST /api/v1/auth/verify-email
   */
  verifyEmail = asyncHandler(async (req, res) => {
    const { code } = req.body;

    const result = await authService.verifyEmail(req.userId, code);

    return ApiResponse.success(res, 200, result.message, result);
  });

  /**
   * Resend verification code
   * POST /api/v1/auth/resend-verification
   */
  resendVerification = asyncHandler(async (req, res) => {
    const result = await authService.resendVerificationCode(req.userId);

    return ApiResponse.success(res, 200, result.message, result);
  });
}

module.exports = new AuthController();
