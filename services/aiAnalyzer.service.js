const { GoogleGenerativeAI } = require('@google/generative-ai');
const WebsiteAnalysis = require('../models/WebsiteAnalysis');
const Event = require('../models/Event');
const TrafficDailyStats = require('../models/TrafficDailyStats');
const LeadsDailyStats = require('../models/LeadsDailyStats');
const logger = require('../config/logger');

/**
 * AI Website Analyzer Service
 * Combines crawl data, PageSpeed, analytics, and Gemini AI for website analysis
 */
class AIAnalyzerService {
  /**
   * Get cached analysis if fresh (within 24 hours)
   */
  static async getCachedAnalysis(websiteId) {
    // Expire any stale pending analyses first
    await WebsiteAnalysis.expireStale(websiteId);
    return WebsiteAnalysis.getCached(websiteId);
  }

  /**
   * Check if analysis is already in progress
   */
  static async isAnalysisInProgress(websiteId) {
    return WebsiteAnalysis.isInProgress(websiteId);
  }

  /**
   * Get analytics data from MongoDB (last 30 days)
   */
  static async getAnalyticsData(websiteId) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    try {
      // Get traffic stats
      const trafficStats = await TrafficDailyStats.aggregate([
        { $match: { websiteId, date: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: null,
            totalVisitors: { $sum: '$totalVisitors' },
            totalPageviews: { $sum: '$totalPageviews' },
            totalSessions: { $sum: '$totalSessions' },
            mobileVisitors: { $sum: '$mobileVisitors' },
            desktopVisitors: { $sum: '$desktopVisitors' },
          },
        },
      ]);

      // Get lead stats
      const leadStats = await LeadsDailyStats.aggregate([
        { $match: { websiteId, date: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: null,
            totalLeads: { $sum: '$totalLeads' },
          },
        },
      ]);

      // Get top traffic source
      const topSource = await Event.aggregate([
        { $match: { websiteId, createdAt: { $gte: thirtyDaysAgo }, type: 'pageview' } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
      ]);

      const traffic = trafficStats[0] || {};
      const leads = leadStats[0] || {};
      const totalVisitors = traffic.totalVisitors || 0;
      const totalLeads = leads.totalLeads || 0;
      const mobileVisitors = traffic.mobileVisitors || 0;
      const totalSessions = traffic.totalSessions || 1;

      return {
        visitors: totalVisitors,
        leads: totalLeads,
        conversionRate: totalVisitors > 0 ? ((totalLeads / totalVisitors) * 100).toFixed(2) : '0',
        bounceRate: '0', // Would need session-level data
        topSource: topSource[0]?._id || 'direct',
        mobilePercent: totalVisitors > 0 ? ((mobileVisitors / totalVisitors) * 100).toFixed(1) : '0',
      };
    } catch (error) {
      logger.warn('Failed to get analytics data:', error.message);
      return {
        visitors: 0,
        leads: 0,
        conversionRate: '0',
        bounceRate: '0',
        topSource: 'unknown',
        mobilePercent: '0',
      };
    }
  }

  /**
   * Send data to Google Gemini API and get structured analysis
   */
  static async analyzeWithGemini(url, analyticsData) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3-flash-preview',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
      tools: [{ urlContext: {} }],
    });

    const prompt = `You are a landing page conversion expert. Visit this website and check what elements exist.

RULES:
- Visit the URL and scroll the ENTIRE page before answering
- DO NOT mark false if it exists — check very carefully
- WhatsApp floating buttons, chat widgets loaded via JavaScript COUNT as true
- A "Call Now" or "Book a Call" link/button or visible phone number = call_button true
- demo_video = true if ANY of these exist: iframe with youtube/vimeo src, HTML5 &lt;video&gt; tag, embedded video player, video thumbnail with play button, background video, product screenshots section, or any link to youtube.com/vimeo.com. Check the page HTML carefully for iframes and video elements
- Keep issue text very short

WEBSITE: ${url}

VISITOR DATA: Visitors: ${analyticsData.visitors} | Leads: ${analyticsData.leads} | Conversion: ${analyticsData.conversionRate}%

SCORING SYSTEM:
- 11 Required elements (7 points each = max 77 points)
- 9 Optional elements (2-3 points each = max 23 points)
- Total = 100 points

Check each element — mark true if EXISTS on the page, false if MISSING.
Calculate overall_score by adding points for each true item.

Return ONLY this JSON:
{
  "overall_score": <0-100 calculated from points below>,
  "required": {
    "header_nav": <true/false — header with logo and navigation>,
    "hero_section": <true/false — hero with headline, subtext, image, CTA>,
    "services_features": <true/false — services, features, or products section>,
    "testimonials": <true/false — customer testimonials or reviews>,
    "faq_section": <true/false — FAQ or frequently asked questions>,
    "contact_form": <true/false — contact form, order form, or inquiry form>,
    "call_button": <true/false — call button, book-a-call, WhatsApp, or phone number>,
    "footer": <true/false — footer with contact info or links>,
    "mobile_responsive": <true/false — viewport meta tag present>,
    "portfolio": <true/false — portfolio, case studies, gallery, or work samples>,
    "about_section": <true/false — about us, why choose us, or company story section>
  },
  "optional": {
    "pricing_section": <true/false — pricing table or plans>,
    "how_it_works": <true/false — how it works or process steps>,
    "problem_section": <true/false — problem/pain point section>,
    "social_proof_bar": <true/false — client logos, "as seen in", or partner logos>,
    "trust_badges": <true/false — trust badges, certifications, guarantees, or security seals>,
    "demo_video": <true/false — any video embed, iframe, youtube link, video player, or screenshots section>,
    "blog_resources": <true/false — blog, resources, or articles section>,
    "live_chat": <true/false — live chat widget or chatbot>,
    "exit_popup": <true/false — exit intent popup or special offer popup>
  },
  "summary": "<max 10 words — #1 improvement needed>",
  "issues": [
    {
      "category": "required|optional",
      "priority": "high|low",
      "element": "<element name>",
      "problem": "<max 8 words>",
      "fix": "<max 12 words>"
    }
  ],
  "quick_wins": ["<short fix>", "<short fix>", "<short fix>"],
  "strengths": ["<strength>", "<strength>"]
}

IMPORTANT: For each required element marked false — add as HIGH priority issue.
For each optional element marked false — add as LOW priority issue.
Give a specific, actionable fix for each missing element.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const textContent = response.text();

    if (!textContent) {
      throw new Error('Empty response from Gemini API');
    }

    // Parse JSON response (strip markdown code fences if present)
    let jsonStr = textContent.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    if (typeof parsed.overall_score !== 'number' || !Array.isArray(parsed.issues)) {
      throw new Error('Invalid response structure from Gemini API');
    }

    return parsed;
  }

  /**
   * Run full analysis pipeline
   */
  static async runAnalysis(websiteId, url) {
    // Create pending record
    const analysis = new WebsiteAnalysis({
      websiteId,
      url,
      status: 'pending',
    });
    await analysis.save();

    try {
      // Step 1: Get analytics data from MongoDB
      logger.info(`[AI Analyzer] Fetching analytics data for ${url}...`);
      const analyticsData = await this.getAnalyticsData(websiteId);

      // Step 2: Analyze with Gemini (Gemini visits the URL directly via urlContext)
      logger.info(`[AI Analyzer] Running Gemini analysis on ${url}...`);
      const geminiResult = await this.analyzeWithGemini(url, analyticsData);

      // Update analysis record with results
      analysis.status = 'completed';
      analysis.overall_score = geminiResult.overall_score;
      // Store checklist data for frontend
      analysis.crawlData = {
        required: geminiResult.required,
        optional: geminiResult.optional,
      };
      analysis.summary = geminiResult.summary;
      analysis.issues = geminiResult.issues;
      analysis.quick_wins = geminiResult.quick_wins;
      analysis.strengths = geminiResult.strengths;
      analysis.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await analysis.save();
      logger.info(`[AI Analyzer] Analysis completed for ${url} - Score: ${geminiResult.overall_score}`);

      return analysis;
    } catch (error) {
      // Mark analysis as failed
      analysis.status = 'failed';
      analysis.errorMessage = error.message;
      await analysis.save();

      logger.error(`[AI Analyzer] Analysis failed for ${url}:`, error.message);
      throw error;
    }
  }

  /**
   * Get analysis history for a website
   */
  static async getAnalysisHistory(websiteId, limit = 10) {
    return WebsiteAnalysis.find({ websiteId, status: { $in: ['completed', 'failed'] } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('overall_score seo_score conversion_score performance_score summary status createdAt expiresAt errorMessage');
  }

  /**
   * Get latest completed analysis
   */
  static async getLatestAnalysis(websiteId) {
    return WebsiteAnalysis.getLatest(websiteId);
  }
}

module.exports = AIAnalyzerService;
