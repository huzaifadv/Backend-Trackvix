const express = require('express');
const websiteController = require('../controllers/website.controller');
const scanController = require('../controllers/scan.controller');
const { authenticate, requireEmailVerification } = require('../middlewares/auth.middleware');
const { enforceWebsiteLimit, requireNotSuspended } = require('../middlewares/plan.middleware');
const { body } = require('express-validator');
const { validate } = require('../validators/auth.validator');

const router = express.Router();

/**
 * Website Routes
 * Base: /api/v1/websites
 * All routes require authentication
 */

// Validation middleware
const createWebsiteValidation = [
  body('domain')
    .notEmpty()
    .withMessage('Domain is required')
    .trim()
    .toLowerCase()
    .matches(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/)
    .withMessage('Invalid domain format (use format: example.com without http/https)'),
];

// Apply authentication and verification to all routes
router.use(authenticate);
router.use(requireEmailVerification);
router.use(requireNotSuspended);

// Website CRUD operations
// TODO: Re-enable enforceWebsiteLimit when plans are configured
router.post('/', createWebsiteValidation, validate, websiteController.createWebsite);
router.get('/', websiteController.getUserWebsites);
router.get('/:id', websiteController.getWebsiteById);
router.put('/:id', websiteController.updateWebsite);
router.delete('/:id', websiteController.deleteWebsite);

// Website status management
router.post('/:id/toggle', websiteController.toggleStatus);

// API key management
router.post('/:id/regenerate-key', websiteController.regenerateApiKey);

// Website scan endpoints
router.post('/:id/scan', scanController.initiateScan);
router.get('/:id/health', scanController.getHealth);
router.get('/:id/health/history', scanController.getHealthHistory);
router.get('/:id/needs-scan', scanController.needsRescan);

module.exports = router;
