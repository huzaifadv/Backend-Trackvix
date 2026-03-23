const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const cors = require('cors');
const config = require('./config/environment');
const logger = require('./config/logger');
const routes = require('./routes');
const TrackingController = require('./controllers/tracking.controller');
const {
  helmetConfig,
  corsConfig,
  // generalLimiter, // Disabled for better user experience
  sanitizeInput,
} = require('./middlewares/security.middleware');
const {
  notFoundHandler,
  errorHandler,
} = require('./middlewares/error.middleware');

/**
 * Express Application Configuration
 * Production-ready setup with security and performance optimizations
 */

const app = express();

// ===========================
// Security Middleware
// ===========================
// Skip Helmet and CORS for public tracking endpoints
app.use((req, res, next) => {
  // Skip for tracker.js and event logging endpoint
  if (req.path === '/tracker.js' || req.path.includes('/api/v1/events/log')) {
    return next();
  }
  helmetConfig(req, res, next);
});

app.use((req, res, next) => {
  // Skip for tracker.js and event logging endpoint (they have their own CORS)
  if (req.path === '/tracker.js' || req.path.includes('/api/v1/events/log')) {
    return next();
  }
  corsConfig(req, res, next);
});

// Handle OPTIONS preflight requests
app.options('*', (req, res, next) => {
  // Use public CORS for tracking endpoints
  if (req.path.includes('/api/v1/events/log') || req.path === '/tracker.js') {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    return res.sendStatus(200);
  }
  // Use restricted CORS for other endpoints
  corsConfig(req, res, next);
});

// Rate limiting disabled for better user experience
// app.use(generalLimiter);
app.use(sanitizeInput);

// ===========================
// Raw Body for Stripe Webhooks
// ===========================
app.use('/api/*/billing/webhook', express.raw({ type: 'application/json' }));

// ===========================
// Standard Middleware
// ===========================
app.use(compression()); // Compress responses
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies

// ===========================
// Logging Middleware
// ===========================
if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: logger.stream }));
}

// ===========================
// Trust Proxy (for rate limiting and IP detection)
// ===========================
// Trust first proxy hop (AWS ALB/Nginx) - number value required by express-rate-limit v7+
app.set('trust proxy', 1);

// ===========================
// Serve Static Files (public folder)
// ===========================
app.use(express.static('public'));

// ===========================
// Serve tracker.js (publicly accessible)
// ===========================
app.get('/tracker.js', TrackingController.serveTrackerScript);

// ===========================
// Health Check (before rate limiting)
// ===========================
app.get('/ping', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===========================
// API Routes (with versioning)
// ===========================
app.use(`/api/${config.apiVersion}`, routes);

// ===========================
// Root Endpoint
// ===========================
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Webtrackly API Server',
    version: config.apiVersion,
    environment: config.env,
    documentation: `/api/${config.apiVersion}`,
  });
});

// ===========================
// Error Handling
// ===========================
app.use(notFoundHandler); // 404 handler
app.use(errorHandler); // Global error handler

module.exports = app;
