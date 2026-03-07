const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/admin.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireAdmin } = require('../middlewares/admin.middleware');

/**
 * Admin Routes
 * Protected endpoints for administrative operations
 * All routes require admin role
 */

// Apply authentication and admin check to all routes
router.use(authenticate);
router.use(requireAdmin);

/**
 * @route   GET /api/v1/admin/users
 * @desc    Get all users with pagination and filters
 * @access  Admin
 */
router.get('/users', AdminController.getAllUsers);

/**
 * @route   GET /api/v1/admin/websites
 * @desc    Get all websites
 * @access  Admin
 */
router.get('/websites', AdminController.getAllWebsites);

/**
 * @route   GET /api/v1/admin/stats
 * @desc    Get platform statistics
 * @access  Admin
 */
router.get('/stats', AdminController.getStats);

/**
 * @route   POST /api/v1/admin/users/:id/suspend
 * @desc    Suspend user account
 * @access  Admin
 */
router.post('/users/:id/suspend', AdminController.suspendUser);

/**
 * @route   POST /api/v1/admin/users/:id/unsuspend
 * @desc    Unsuspend user account
 * @access  Admin
 */
router.post('/users/:id/unsuspend', AdminController.unsuspendUser);

/**
 * @route   POST /api/v1/admin/users/:id/upgrade
 * @desc    Manually upgrade user to Pro
 * @access  Admin
 */
router.post('/users/:id/upgrade', AdminController.upgradeUser);

/**
 * @route   POST /api/v1/admin/users/:id/downgrade
 * @desc    Manually downgrade user to Basic
 * @access  Admin
 */
router.post('/users/:id/downgrade', AdminController.downgradeUser);

module.exports = router;
