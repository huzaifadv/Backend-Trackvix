const logger = require('../config/logger');

/**
 * Website Health Score Calculation Service
 * Modular scoring system with weighted categories
 */
class HealthScoreService {
  /**
   * Score weights (must sum to 100)
   */
  static weights = {
    performance: 30,
    seo: 30,
    structure: 20,
    technical: 20,
  };

  /**
   * Calculate performance score
   */
  static calculatePerformanceScore(pageSpeedData) {
    if (!pageSpeedData || !pageSpeedData.mobile) {
      return 0;
    }

    // Use mobile performance as primary metric
    const performanceScore = pageSpeedData.mobile.scores.performance;

    // Deduct points for Core Web Vitals issues
    let deductions = 0;

    const metrics = pageSpeedData.mobile.metrics;

    // LCP penalty
    if (metrics.largestContentfulPaint > 4000) {
      deductions += 15;
    } else if (metrics.largestContentfulPaint > 2500) {
      deductions += 5;
    }

    // CLS penalty
    if (metrics.cumulativeLayoutShift > 0.25) {
      deductions += 10;
    } else if (metrics.cumulativeLayoutShift > 0.1) {
      deductions += 5;
    }

    return Math.max(0, performanceScore - deductions);
  }

  /**
   * Calculate SEO score
   */
  static calculateSEOScore(crawlData, pageSpeedData) {
    let score = 100;

    if (!crawlData || !crawlData.seoData) {
      return 0;
    }

    const seo = crawlData.seoData;

    // Title penalties
    if (!seo.title) {
      score -= 20;
    } else if (seo.title.length > 60 || seo.title.length < 30) {
      score -= 5;
    }

    // Meta description penalties
    if (!seo.metaDescription) {
      score -= 20;
    } else if (seo.metaDescription.length > 160 || seo.metaDescription.length < 120) {
      score -= 5;
    }

    // H1 penalties
    if (seo.headings.h1.length === 0) {
      score -= 15;
    } else if (seo.headings.h1.length > 1) {
      score -= 5;
    }

    // Canonical penalty
    if (!seo.canonical) {
      score -= 5;
    }

    // PageSpeed SEO score contribution
    if (pageSpeedData && pageSpeedData.mobile) {
      const pageSpeedSEO = pageSpeedData.mobile.scores.seo;
      score = (score * 0.7) + (pageSpeedSEO * 0.3); // 70/30 weight
    }

    return Math.max(0, Math.round(score));
  }

  /**
   * Calculate structure score
   */
  static calculateStructureScore(crawlData) {
    let score = 100;

    if (!crawlData || !crawlData.seoData) {
      return 0;
    }

    const seo = crawlData.seoData;

    // H1 structure
    if (seo.headings.h1.length === 0) {
      score -= 25;
    } else if (seo.headings.h1.length > 1) {
      score -= 10;
    }

    // H2 structure
    if (seo.headings.h2.length === 0) {
      score -= 10;
    }

    // Image alt attributes
    if (seo.images.total > 0) {
      const altPercentage = ((seo.images.total - seo.images.withoutAlt) / seo.images.total) * 100;
      if (altPercentage < 50) {
        score -= 20;
      } else if (altPercentage < 80) {
        score -= 10;
      }
    }

    // Internal linking
    if (seo.links.internal < 5) {
      score -= 15;
    }

    // Open Graph
    if (!seo.openGraph.title || !seo.openGraph.description) {
      score -= 10;
    }

    return Math.max(0, Math.round(score));
  }

  /**
   * Calculate technical score
   */
  static calculateTechnicalScore(crawlData, pageSpeedData) {
    let score = 100;

    // HTTP status penalty
    if (crawlData && crawlData.statusCode >= 400) {
      score -= 50;
    }

    // Accessibility score from PageSpeed
    if (pageSpeedData && pageSpeedData.mobile) {
      const accessibilityScore = pageSpeedData.mobile.scores.accessibility;
      score = (score * 0.5) + (accessibilityScore * 0.5); // 50/50 weight
    }

    // Best practices score
    if (pageSpeedData && pageSpeedData.mobile) {
      const bestPracticesScore = pageSpeedData.mobile.scores.bestPractices;
      score = (score * 0.7) + (bestPracticesScore * 0.3); // 70/30 weight
    }

    return Math.max(0, Math.round(score));
  }

  /**
   * Calculate overall health score
   */
  static calculateOverallScore(crawlData, pageSpeedData) {
    try {
      const performanceScore = this.calculatePerformanceScore(pageSpeedData);
      const seoScore = this.calculateSEOScore(crawlData, pageSpeedData);
      const structureScore = this.calculateStructureScore(crawlData);
      const technicalScore = this.calculateTechnicalScore(crawlData, pageSpeedData);

      // Weighted average
      const overallScore = Math.round(
        (performanceScore * this.weights.performance +
          seoScore * this.weights.seo +
          structureScore * this.weights.structure +
          technicalScore * this.weights.technical) / 100
      );

      return {
        overallScore: Math.max(0, Math.min(100, overallScore)),
        breakdown: {
          performance: performanceScore,
          seo: seoScore,
          structure: structureScore,
          technical: technicalScore,
        },
      };
    } catch (error) {
      logger.error('Error calculating health score:', error);
      return {
        overallScore: 0,
        breakdown: {
          performance: 0,
          seo: 0,
          structure: 0,
          technical: 0,
        },
      };
    }
  }

  /**
   * Combine all issues and prioritize
   */
  static prioritizeIssues(crawlIssues = [], pageSpeedIssues = []) {
    const allIssues = [...crawlIssues, ...pageSpeedIssues];

    // Sort by priority
    const priorityOrder = { critical: 1, warning: 2, info: 3 };

    allIssues.sort((a, b) => {
      return priorityOrder[a.type] - priorityOrder[b.type];
    });

    // Extract priority issues (critical and warnings)
    const priorityIssues = allIssues.filter(issue =>
      issue.type === 'critical' || issue.type === 'warning'
    );

    return {
      allIssues,
      priorityIssues,
      issueCount: allIssues.length,
      criticalCount: allIssues.filter(i => i.type === 'critical').length,
      warningCount: allIssues.filter(i => i.type === 'warning').length,
    };
  }

  /**
   * Generate health summary
   */
  static generateHealthSummary(crawlData, pageSpeedData) {
    const scoreData = this.calculateOverallScore(crawlData, pageSpeedData);

    const crawlIssues = crawlData?.issues || [];
    const pageSpeedIssues = pageSpeedData?.mobile
      ? require('./pagespeed.service').extractIssues(pageSpeedData.mobile)
      : [];

    const issueData = this.prioritizeIssues(crawlIssues, pageSpeedIssues);

    // Health status
    let status = 'excellent';
    if (scoreData.overallScore < 40) status = 'critical';
    else if (scoreData.overallScore < 60) status = 'poor';
    else if (scoreData.overallScore < 80) status = 'fair';
    else if (scoreData.overallScore < 90) status = 'good';

    return {
      ...scoreData,
      ...issueData,
      status,
    };
  }
}

module.exports = HealthScoreService;
