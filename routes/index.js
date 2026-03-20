const express = require('express');
const authRoutes = require('./auth.routes');
const websiteRoutes = require('./website.routes');
const eventRoutes = require('./event.routes');
const trackingRoutes = require('./tracking.routes');
const analyticsRoutes = require('./analytics.routes');
const trafficRoutes = require('./traffic');
const leadsRoutes = require('./leads.routes');
const healthRoutes = require('./health.routes');
const billingRoutes = require('./billing.routes');
const adminRoutes = require('./admin.routes');

const router = express.Router();

/**
 * API Routes Index
 * Centralized route registration with versioning
 */

// Mount routes
router.use('/auth', authRoutes);
router.use('/websites', websiteRoutes);
router.use('/events', trackingRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/analytics/traffic', trafficRoutes);
router.use('/leads', leadsRoutes);
router.use('/health', healthRoutes);
router.use('/billing', billingRoutes);
router.use('/admin', adminRoutes);

// API root endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Webtrackly API',
    version: process.env.API_VERSION || 'v1',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/v1/auth',
      websites: '/api/v1/websites',
      events: '/api/v1/events',
      analytics: '/api/v1/analytics',
      leads: '/api/v1/leads',
      health: '/api/v1/health',
      billing: '/api/v1/billing',
      admin: '/api/v1/admin',
    },
  });
});

module.exports = router;
