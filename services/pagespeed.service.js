const axios = require('axios');
const logger = require('../config/logger');

/**
 * Google PageSpeed Insights API Service
 * Analyzes website performance, accessibility, and SEO
 */
class PageSpeedService {
  /**
   * Get PageSpeed API key from environment
   */
  static getApiKey() {
    return process.env.PAGESPEED_API_KEY || '';
  }

  /**
   * Call PageSpeed Insights API with retry logic
   */
  static async analyzeUrl(url, strategy = 'mobile', retries = 2) {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      logger.warn('PageSpeed API key not configured, skipping analysis');
      return null;
    }

    const apiUrl = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

    const params = {
      url: url,
      key: apiKey,
      strategy: strategy, // 'mobile' or 'desktop'
      category: ['performance', 'accessibility', 'seo', 'best-practices'],
    };

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        logger.info(`PageSpeed API call for ${url} (attempt ${attempt + 1})`);

        const response = await axios.get(apiUrl, {
          params,
          timeout: 60000, // 60 seconds
        });

        return this.parsePageSpeedResponse(response.data);
      } catch (error) {
        logger.error(`PageSpeed API error (attempt ${attempt + 1}):`, error.message);

        // Check if we should retry
        if (attempt < retries) {
          // Wait before retry (exponential backoff)
          await this.sleep(Math.pow(2, attempt) * 1000);
          continue;
        }

        // All retries failed
        if (error.response) {
          if (error.response.status === 429) {
            throw new Error('PageSpeed API rate limit exceeded');
          }
          throw new Error(`PageSpeed API error: ${error.response.status}`);
        }

        throw new Error('PageSpeed API request failed');
      }
    }
  }

  /**
   * Parse PageSpeed API response
   */
  static parsePageSpeedResponse(data) {
    try {
      const lighthouse = data.lighthouseResult;
      const categories = lighthouse.categories;
      const audits = lighthouse.audits;

      // Extract scores (0-1 scale, convert to 0-100)
      const scores = {
        performance: Math.round((categories.performance?.score || 0) * 100),
        accessibility: Math.round((categories.accessibility?.score || 0) * 100),
        seo: Math.round((categories.seo?.score || 0) * 100),
        bestPractices: Math.round((categories['best-practices']?.score || 0) * 100),
      };

      // Extract Core Web Vitals
      const metrics = {
        firstContentfulPaint: audits['first-contentful-paint']?.numericValue || 0,
        largestContentfulPaint: audits['largest-contentful-paint']?.numericValue || 0,
        totalBlockingTime: audits['total-blocking-time']?.numericValue || 0,
        cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue || 0,
        speedIndex: audits['speed-index']?.numericValue || 0,
      };

      // Extract opportunities (improvements)
      const opportunities = [];
      Object.keys(audits).forEach(key => {
        const audit = audits[key];
        if (audit.score !== null && audit.score < 0.9 && audit.details?.overallSavingsMs > 100) {
          opportunities.push({
            id: key,
            title: audit.title,
            description: audit.description,
            score: Math.round((audit.score || 0) * 100),
            savingsMs: audit.details.overallSavingsMs,
          });
        }
      });

      // Sort opportunities by impact
      opportunities.sort((a, b) => b.savingsMs - a.savingsMs);

      return {
        scores,
        metrics,
        opportunities: opportunities.slice(0, 10), // Top 10
        analyzedAt: new Date(),
      };
    } catch (error) {
      logger.error('Error parsing PageSpeed response:', error);
      throw new Error('Failed to parse PageSpeed data');
    }
  }

  /**
   * Analyze both mobile and desktop
   */
  static async analyzeAll(url) {
    try {
      const [mobile, desktop] = await Promise.allSettled([
        this.analyzeUrl(url, 'mobile'),
        this.analyzeUrl(url, 'desktop'),
      ]);

      return {
        mobile: mobile.status === 'fulfilled' ? mobile.value : null,
        desktop: desktop.status === 'fulfilled' ? desktop.value : null,
      };
    } catch (error) {
      logger.error('PageSpeed analysis failed:', error);
      return { mobile: null, desktop: null };
    }
  }

  /**
   * Sleep utility for retry backoff
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Extract performance issues from PageSpeed data
   */
  static extractIssues(pageSpeedData) {
    const issues = [];

    if (!pageSpeedData) {
      return issues;
    }

    const { scores, metrics, opportunities } = pageSpeedData;

    // Performance score issues
    if (scores.performance < 50) {
      issues.push({
        type: 'critical',
        category: 'performance',
        issue: 'Poor performance score',
        recommendation: 'Website loads very slowly, affecting user experience',
      });
    } else if (scores.performance < 90) {
      issues.push({
        type: 'warning',
        category: 'performance',
        issue: 'Below-average performance',
        recommendation: 'Optimize loading speed for better user experience',
      });
    }

    // LCP (Largest Contentful Paint)
    if (metrics.largestContentfulPaint > 4000) {
      issues.push({
        type: 'critical',
        category: 'performance',
        issue: 'Slow Largest Contentful Paint (LCP)',
        recommendation: 'Optimize main content loading (target: under 2.5s)',
      });
    } else if (metrics.largestContentfulPaint > 2500) {
      issues.push({
        type: 'warning',
        category: 'performance',
        issue: 'LCP needs improvement',
        recommendation: 'Reduce LCP to under 2.5 seconds',
      });
    }

    // CLS (Cumulative Layout Shift)
    if (metrics.cumulativeLayoutShift > 0.25) {
      issues.push({
        type: 'warning',
        category: 'performance',
        issue: 'High layout shift (CLS)',
        recommendation: 'Reduce layout shifts (target: under 0.1)',
      });
    }

    // Accessibility
    if (scores.accessibility < 90) {
      issues.push({
        type: 'warning',
        category: 'accessibility',
        issue: 'Accessibility improvements needed',
        recommendation: 'Improve accessibility for users with disabilities',
      });
    }

    // SEO score
    if (scores.seo < 90) {
      issues.push({
        type: 'warning',
        category: 'seo',
        issue: 'SEO optimization needed',
        recommendation: 'Fix technical SEO issues identified by PageSpeed',
      });
    }

    return issues;
  }
}

module.exports = PageSpeedService;
