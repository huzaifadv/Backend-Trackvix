const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const logger = require('../config/logger');

/**
 * SEO Crawler Service
 * Safe HTML crawling with SSRF protection and timeout limits
 */
class CrawlerService {
  /**
   * Validate domain to prevent SSRF attacks
   */
  static isValidDomain(urlString) {
    try {
      const url = new URL(urlString);

      // Only allow HTTP/HTTPS
      if (!['http:', 'https:'].includes(url.protocol)) {
        return false;
      }

      // Block internal/private IPs
      const hostname = url.hostname.toLowerCase();

      const blockedPatterns = [
        /^localhost$/i,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^192\.168\./,
        /^169\.254\./,
        /^::1$/,
        /^fe80:/,
        /^fc00:/,
        /^fd00:/,
      ];

      if (blockedPatterns.some(pattern => pattern.test(hostname))) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Fetch HTML with safety limits
   */
  static async fetchHTML(url) {
    if (!this.isValidDomain(url)) {
      throw new Error('Invalid or blocked domain');
    }

    try {
      const response = await axios.get(url, {
        timeout: 15000, // 15 seconds
        maxRedirects: 3,
        maxContentLength: 5 * 1024 * 1024, // 5MB limit
        headers: {
          'User-Agent': 'WebsiteTracker-Bot/1.0 (SEO Crawler)',
        },
        validateStatus: (status) => status >= 200 && status < 400,
      });

      return {
        html: response.data,
        statusCode: response.status,
        finalUrl: response.request.res.responseUrl || url,
      };
    } catch (error) {
      logger.error(`Fetch error for ${url}:`, error.message);

      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout');
      }

      if (error.response) {
        throw new Error(`HTTP ${error.response.status}`);
      }

      throw new Error('Failed to fetch website');
    }
  }

  /**
   * Extract SEO elements from HTML
   */
  static extractSEOData(html, baseUrl) {
    const $ = cheerio.load(html);

    // Title
    const title = $('title').first().text().trim();

    // Meta tags
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const metaRobots = $('meta[name="robots"]').attr('content') || '';
    const canonical = $('link[rel="canonical"]').attr('href') || '';

    // Open Graph
    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    const ogDescription = $('meta[property="og:description"]').attr('content') || '';
    const ogImage = $('meta[property="og:image"]').attr('content') || '';

    // Headings
    const h1Tags = [];
    $('h1').each((i, el) => {
      h1Tags.push($(el).text().trim());
    });

    const h2Tags = [];
    $('h2').each((i, el) => {
      h2Tags.push($(el).text().trim());
    });

    // Images
    const images = [];
    $('img').each((i, el) => {
      const src = $(el).attr('src');
      const alt = $(el).attr('alt') || '';
      if (src) {
        images.push({ src, alt, hasAlt: !!alt });
      }
    });

    // Links
    const internalLinks = [];
    const externalLinks = [];

    $('a[href]').each((i, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      try {
        const linkUrl = new URL(href, baseUrl);
        const baseUrlObj = new URL(baseUrl);

        if (linkUrl.hostname === baseUrlObj.hostname) {
          internalLinks.push(linkUrl.href);
        } else {
          externalLinks.push(linkUrl.href);
        }
      } catch (error) {
        // Skip invalid URLs
      }
    });

    return {
      title,
      metaDescription,
      metaRobots,
      canonical,
      openGraph: {
        title: ogTitle,
        description: ogDescription,
        image: ogImage,
      },
      headings: {
        h1: h1Tags,
        h2: h2Tags,
      },
      images: {
        total: images.length,
        withoutAlt: images.filter(img => !img.hasAlt).length,
        list: images.slice(0, 20), // Limit stored images
      },
      links: {
        internal: internalLinks.length,
        external: externalLinks.length,
        internalList: internalLinks.slice(0, 50), // Sample only
      },
    };
  }

  /**
   * Detect SEO issues
   */
  static detectIssues(seoData) {
    const issues = [];

    // Title issues
    if (!seoData.title) {
      issues.push({
        type: 'critical',
        category: 'seo',
        issue: 'Missing title tag',
        recommendation: 'Add a descriptive title tag (50-60 characters)',
      });
    } else if (seoData.title.length > 60) {
      issues.push({
        type: 'warning',
        category: 'seo',
        issue: 'Title too long',
        recommendation: 'Keep title under 60 characters to avoid truncation',
      });
    }

    // Meta description
    if (!seoData.metaDescription) {
      issues.push({
        type: 'critical',
        category: 'seo',
        issue: 'Missing meta description',
        recommendation: 'Add meta description (150-160 characters)',
      });
    } else if (seoData.metaDescription.length > 160) {
      issues.push({
        type: 'warning',
        category: 'seo',
        issue: 'Meta description too long',
        recommendation: 'Keep meta description under 160 characters',
      });
    }

    // H1 issues
    if (seoData.headings.h1.length === 0) {
      issues.push({
        type: 'critical',
        category: 'structure',
        issue: 'No H1 heading found',
        recommendation: 'Add one H1 heading with primary keyword',
      });
    } else if (seoData.headings.h1.length > 1) {
      issues.push({
        type: 'warning',
        category: 'structure',
        issue: 'Multiple H1 headings',
        recommendation: 'Use only one H1 per page',
      });
    }

    // Image alt attributes
    if (seoData.images.withoutAlt > 0) {
      issues.push({
        type: 'warning',
        category: 'accessibility',
        issue: `${seoData.images.withoutAlt} images missing alt attributes`,
        recommendation: 'Add descriptive alt text to all images',
      });
    }

    // Canonical
    if (!seoData.canonical) {
      issues.push({
        type: 'info',
        category: 'seo',
        issue: 'No canonical URL specified',
        recommendation: 'Add canonical tag to prevent duplicate content',
      });
    }

    return issues;
  }

  /**
   * Check for broken internal links (sample check)
   */
  static async checkBrokenLinks(internalLinks) {
    const brokenLinks = [];
    const sampleSize = Math.min(internalLinks.length, 10); // Check max 10 links

    for (let i = 0; i < sampleSize; i++) {
      const link = internalLinks[i];

      try {
        const response = await axios.head(link, {
          timeout: 5000,
          maxRedirects: 3,
        });

        if (response.status >= 400) {
          brokenLinks.push(link);
        }
      } catch (error) {
        if (error.response && error.response.status >= 400) {
          brokenLinks.push(link);
        }
      }
    }

    return brokenLinks;
  }

  /**
   * Main crawl function
   */
  static async crawlWebsite(url) {
    try {
      logger.info(`Starting crawl for: ${url}`);

      // Fetch HTML
      const { html, statusCode, finalUrl } = await this.fetchHTML(url);

      // Extract SEO data
      const seoData = this.extractSEOData(html, finalUrl);

      // Detect issues
      const issues = this.detectIssues(seoData);

      // Check sample of internal links for 404s
      const brokenLinks = await this.checkBrokenLinks(seoData.links.internalList);

      if (brokenLinks.length > 0) {
        issues.push({
          type: 'warning',
          category: 'technical',
          issue: `${brokenLinks.length} broken internal links detected`,
          recommendation: 'Fix or remove broken links',
        });
      }

      logger.info(`Crawl completed for: ${url} - Found ${issues.length} issues`);

      return {
        success: true,
        url: finalUrl,
        statusCode,
        seoData,
        issues,
        crawledAt: new Date(),
      };
    } catch (error) {
      logger.error(`Crawl failed for ${url}:`, error.message);

      return {
        success: false,
        error: error.message,
        crawledAt: new Date(),
      };
    }
  }
}

module.exports = CrawlerService;
