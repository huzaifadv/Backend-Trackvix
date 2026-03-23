const express = require('express');
const router = express.Router();
const AIAnalyzerController = require('../controllers/aiAnalyzer.controller');
const { authenticate, requireEmailVerification, requireNotSuspended } = require('../middlewares/auth.middleware');

/**
 * AI Analyzer Routes
 * Protected endpoints for AI-powered website analysis
 */

// All routes require authentication + email verified + not suspended
router.use(authenticate, requireEmailVerification, requireNotSuspended);

/**
 * @route   POST /api/v1/ai-analyzer/analyze/:websiteId
 * @desc    Trigger AI analysis for a website
 * @access  Private (verified, not suspended)
 */
router.post('/analyze/:websiteId', AIAnalyzerController.analyzeWebsite);

/**
 * @route   GET /api/v1/ai-analyzer/latest/:websiteId
 * @desc    Get latest analysis result for a website
 * @access  Private (verified, not suspended)
 */
router.get('/latest/:websiteId', AIAnalyzerController.getLatestAnalysis);

/**
 * @route   GET /api/v1/ai-analyzer/history/:websiteId
 * @desc    Get analysis history for a website
 * @access  Private (verified, not suspended)
 */
router.get('/history/:websiteId', AIAnalyzerController.getAnalysisHistory);

module.exports = router;
