const CrawlerService = require('./crawler.service');
const PageSpeedService = require('./pagespeed.service');
const HealthScoreService = require('./health-score.service');
const AIRecommendationService = require('./ai-recommendation.service');
const WebsiteHealth = require('../models/WebsiteHealth');
const ScanQueue = require('../models/ScanQueue');
const logger = require('../config/logger');

/**
 * Website Scan Orchestration Service
 * Coordinates crawler, PageSpeed, scoring, and AI services
 */
class ScanService {
  /**
   * Enqueue website scan (async)
   */
  static async enqueueScan(websiteId, url, priority = 'normal') {
    try {
      const job = await ScanQueue.enqueue(websiteId, url, priority);

      logger.info(`Scan enqueued for website ${websiteId}: ${url}`);

      // Trigger processing (non-blocking)
      this.processQueue().catch(err => {
        logger.error('Queue processing error:', err);
      });

      return {
        jobId: job._id,
        status: 'enqueued',
        message: 'Scan started, results will be available shortly',
      };
    } catch (error) {
      logger.error('Failed to enqueue scan:', error);
      throw error;
    }
  }

  /**
   * Process scan queue (background worker)
   */
  static async processQueue() {
    try {
      const job = await ScanQueue.dequeue();

      if (!job) {
        return; // No pending jobs
      }

      logger.info(`Processing scan job ${job._id} for ${job.url}`);

      const startTime = Date.now();

      try {
        // Execute scan
        const result = await this.executeScan(job.websiteId, job.url);

        // Mark job completed
        await job.markCompleted({
          overallScore: result.overallScore,
          issueCount: result.issueCount,
        });

        logger.info(`Scan completed for ${job.url} - Score: ${result.overallScore}`);

      } catch (error) {
        logger.error(`Scan failed for ${job.url}:`, error.message);

        // Mark job failed
        await job.markFailed(error.message);
      }

      const duration = Date.now() - startTime;
      logger.info(`Scan job ${job._id} finished in ${duration}ms`);

      // Process next job
      setImmediate(() => this.processQueue());

    } catch (error) {
      logger.error('Queue processing error:', error);
    }
  }

  /**
   * Execute complete website scan
   */
  static async executeScan(websiteId, url) {
    const scanStart = Date.now();

    try {
      // Step 1: Crawl website
      logger.info(`Step 1: Crawling ${url}`);
      const crawlResult = await CrawlerService.crawlWebsite(url);

      if (!crawlResult.success) {
        throw new Error(crawlResult.error);
      }

      // Step 2: PageSpeed analysis (parallel mobile & desktop)
      logger.info(`Step 2: Running PageSpeed analysis`);
      const pageSpeedResult = await PageSpeedService.analyzeAll(url);

      // Step 3: Calculate health scores
      logger.info(`Step 3: Calculating health scores`);
      const healthSummary = HealthScoreService.generateHealthSummary(
        crawlResult,
        pageSpeedResult
      );

      // Step 4: Generate AI recommendations
      logger.info(`Step 4: Generating AI recommendations`);
      const aiRecommendations = await AIRecommendationService.generateRecommendations(
        healthSummary
      );

      // Step 5: Save to database
      logger.info(`Step 5: Saving results to database`);

      const scanDuration = Date.now() - scanStart;

      const healthData = {
        websiteId,
        overallScore: healthSummary.overallScore,
        status: healthSummary.status,
        scores: healthSummary.breakdown,
        issueCount: healthSummary.issueCount,
        criticalCount: healthSummary.criticalCount,
        warningCount: healthSummary.warningCount,
        issues: healthSummary.allIssues,
        priorityIssues: healthSummary.priorityIssues,
        aiRecommendations,
        seoData: {
          title: crawlResult.seoData.title,
          metaDescription: crawlResult.seoData.metaDescription,
          h1Count: crawlResult.seoData.headings.h1.length,
          h2Count: crawlResult.seoData.headings.h2.length,
          imagesTotal: crawlResult.seoData.images.total,
          imagesWithoutAlt: crawlResult.seoData.images.withoutAlt,
          internalLinks: crawlResult.seoData.links.internal,
          externalLinks: crawlResult.seoData.links.external,
          hasCanonical: !!crawlResult.seoData.canonical,
        },
        pageSpeed: {
          mobile: pageSpeedResult.mobile ? {
            performance: pageSpeedResult.mobile.scores.performance,
            accessibility: pageSpeedResult.mobile.scores.accessibility,
            seo: pageSpeedResult.mobile.scores.seo,
            bestPractices: pageSpeedResult.mobile.scores.bestPractices,
            lcp: pageSpeedResult.mobile.metrics.largestContentfulPaint,
            cls: pageSpeedResult.mobile.metrics.cumulativeLayoutShift,
          } : null,
          desktop: pageSpeedResult.desktop ? {
            performance: pageSpeedResult.desktop.scores.performance,
            accessibility: pageSpeedResult.desktop.scores.accessibility,
            seo: pageSpeedResult.desktop.scores.seo,
            bestPractices: pageSpeedResult.desktop.scores.bestPractices,
          } : null,
        },
        scanDuration,
        scannedAt: new Date(),
      };

      const health = await WebsiteHealth.create(healthData);

      logger.info(`Scan complete for ${url} - Overall Score: ${health.overallScore}`);

      return {
        overallScore: health.overallScore,
        issueCount: health.issueCount,
        status: health.status,
        healthId: health._id,
      };

    } catch (error) {
      logger.error(`Scan execution failed for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Get scan status
   */
  static async getScanStatus(jobId) {
    const job = await ScanQueue.findById(jobId);

    if (!job) {
      return null;
    }

    return {
      jobId: job._id,
      status: job.status,
      attempts: job.attempts,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    };
  }

  /**
   * Get latest health for website
   */
  static async getLatestHealth(websiteId) {
    return WebsiteHealth.getLatest(websiteId);
  }

  /**
   * Get health history for website
   */
  static async getHealthHistory(websiteId, limit = 10) {
    return WebsiteHealth.getHistory(websiteId, limit);
  }

  /**
   * Check if website needs rescan
   */
  static async needsRescan(websiteId) {
    const latestHealth = await WebsiteHealth.getLatest(websiteId);

    if (!latestHealth) {
      return true; // Never scanned
    }

    return latestHealth.needsRescan();
  }
}

module.exports = ScanService;
