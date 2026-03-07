const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const config = require('../config/environment');
const ApiResponse = require('../utils/response');

/**
 * Security Middleware Configuration
 * Production-ready security setup
 */

/**
 * Helmet Security Headers
 * Protects against common vulnerabilities
 */
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for example.html
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: {
    action: 'deny',
  },
  noSniff: true,
  xssFilter: true,
});

/**
 * CORS Configuration
 * Allows controlled cross-origin requests
 * Supports local development, production frontend, and Cloudflare tunnels
 */
const corsConfig = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Get allowed origins from environment config
    const allowedOrigins = config.cors.origin || ['http://localhost:3000'];

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }

    // Allow any Cloudflare tunnel URL (*.trycloudflare.com)
    // This allows development without updating .env every time tunnel restarts
    if (origin.endsWith('.trycloudflare.com')) {
      return callback(null, true);
    }

    // Reject all other origins
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204,
});

/**
 * Public CORS Configuration (for tracking endpoints)
 * Allows ALL origins to send tracking events
 */
const publicCorsConfig = cors({
  origin: '*', // Allow all origins for tracking
  credentials: false,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key'],
  exposedHeaders: [],
  maxAge: 86400, // 24 hours
});

/**
 * General Rate Limiter
 * Protects all endpoints from abuse
 */
const generalLimiter = rateLimit({
  windowMs: config.security.rateLimitWindow,
  max: config.security.rateLimitMax,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return ApiResponse.tooManyRequests(
      res,
      'Too many requests from this IP, please try again later'
    );
  },
});

/**
 * Auth Route Rate Limiter
 * Stricter limits for authentication endpoints
 */
const authLimiter = rateLimit({
  windowMs: config.security.authRateLimitWindow,
  max: config.security.authRateLimitMax,
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    return ApiResponse.tooManyRequests(
      res,
      'Too many authentication attempts, please try again later'
    );
  },
});

/**
 * IP-based Rate Limiter for specific endpoints
 */
const createLimiter = (windowMs, max) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      return ApiResponse.tooManyRequests(
        res,
        'Rate limit exceeded, please try again later'
      );
    },
  });
};

/**
 * Sanitize input middleware
 * Prevents NoSQL injection by removing dangerous keys
 * Note: Only sanitizes object KEYS, not VALUES (to preserve emails with dots, etc.)
 */
const sanitizeInput = (req, res, next) => {
  // Remove any keys starting with $ or containing . (NoSQL operators)
  const sanitize = (obj) => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      Object.keys(obj).forEach((key) => {
        // Remove dangerous keys that could be NoSQL injection attempts
        if (key.startsWith('$') || key.includes('.')) {
          delete obj[key];
        } else if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          // Recursively sanitize nested objects (but skip arrays and primitive values)
          sanitize(obj[key]);
        }
      });
    }
  };

  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);

  next();
};

/**
 * API Key Validation Middleware
 * For tracking endpoints that use API keys
 */
const validateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return ApiResponse.unauthorized(res, 'API key required');
    }

    // Validate API key format (64 characters hex)
    if (!/^[a-f0-9]{64}$/i.test(apiKey)) {
      return ApiResponse.unauthorized(res, 'Invalid API key format');
    }

    // Find website by API key
    const Website = require('../models/Website');
    const website = await Website.findByApiKey(apiKey);

    if (!website) {
      return ApiResponse.unauthorized(res, 'Invalid API key');
    }

    // Attach website to request
    req.website = website;
    req.websiteId = website._id;

    next();
  } catch (error) {
    return ApiResponse.unauthorized(res, 'API key validation failed');
  }
};

module.exports = {
  helmetConfig,
  corsConfig,
  publicCorsConfig,
  generalLimiter,
  authLimiter,
  createLimiter,
  sanitizeInput,
  validateApiKey,
};
