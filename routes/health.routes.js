const express = require('express');
const healthController = require('../controllers/health.controller');

const router = express.Router();

/**
 * Health Check Routes
 * Base: /api/v1/health
 * Public endpoints
 */

router.get('/', healthController.healthCheck);
router.get('/detailed', healthController.detailedHealth);

module.exports = router;
