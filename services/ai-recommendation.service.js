const axios = require('axios');
const logger = require('../config/logger');

/**
 * AI Recommendation Service
 * Generates actionable improvement recommendations using AI
 * Cost-efficient with structured prompts
 */
class AIRecommendationService {
  /**
   * Get AI API configuration
   */
  static getConfig() {
    return {
      apiKey: process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '',
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      apiUrl: process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions',
    };
  }

  /**
   * Build structured prompt from website data
   */
  static buildPrompt(healthData, trafficData = null) {
    const { overallScore, breakdown, priorityIssues, criticalCount, warningCount } = healthData;

    // Build structured data object (NOT raw HTML)
    const structuredData = {
      overallScore,
      scores: breakdown,
      issuesSummary: {
        critical: criticalCount,
        warnings: warningCount,
      },
      topIssues: priorityIssues.slice(0, 10).map(issue => ({
        type: issue.type,
        category: issue.category,
        issue: issue.issue,
      })),
    };

    // Add traffic context if available
    if (trafficData) {
      structuredData.traffic = {
        totalVisits: trafficData.totalVisits,
        topSources: trafficData.topSources,
        bounceRate: trafficData.bounceRate,
      };
    }

    // Create prompt
    const prompt = `You are an SEO and website optimization expert helping small business owners improve their websites.

Website Health Analysis:
- Overall Score: ${overallScore}/100
- Performance: ${breakdown.performance}/100
- SEO: ${breakdown.seo}/100
- Structure: ${breakdown.structure}/100
- Technical: ${breakdown.technical}/100

Issues Found:
${priorityIssues.slice(0, 10).map((issue, i) =>
  `${i + 1}. [${issue.type.toUpperCase()}] ${issue.issue}`
).join('\n')}

Generate 5-10 clear, actionable recommendations to improve this website. For each recommendation:
1. Use simple, non-technical language
2. Explain WHY it matters for their business
3. Assign priority (High/Medium/Low)
4. Keep it under 2 sentences

Format as JSON array:
[
  {
    "title": "Short title",
    "description": "Clear explanation in simple terms",
    "priority": "High|Medium|Low",
    "impact": "Business impact explanation",
    "category": "performance|seo|structure|technical"
  }
]

Focus on recommendations that will have the biggest impact on their business goals (more visitors, better conversions, professional appearance).`;

    return prompt;
  }

  /**
   * Call AI API with retry logic
   */
  static async generateRecommendations(healthData, trafficData = null, retries = 2) {
    const config = this.getConfig();

    if (!config.apiKey) {
      logger.warn('AI API key not configured, using fallback recommendations');
      return this.getFallbackRecommendations(healthData);
    }

    const prompt = this.buildPrompt(healthData, trafficData);

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        logger.info(`AI recommendation request (attempt ${attempt + 1})`);

        const response = await axios.post(
          config.apiUrl,
          {
            model: config.model,
            messages: [
              {
                role: 'system',
                content: 'You are a helpful SEO expert who explains technical concepts in simple terms for small business owners.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 1000,
          },
          {
            headers: {
              'Authorization': `Bearer ${config.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 seconds
          }
        );

        const content = response.data.choices[0].message.content;

        // Parse JSON response
        const recommendations = this.parseAIResponse(content);

        logger.info(`AI recommendations generated: ${recommendations.length} items`);

        return recommendations;

      } catch (error) {
        logger.error(`AI API error (attempt ${attempt + 1}):`, error.message);

        if (attempt < retries) {
          await this.sleep(Math.pow(2, attempt) * 1000);
          continue;
        }

        // All retries failed, use fallback
        logger.warn('Using fallback recommendations');
        return this.getFallbackRecommendations(healthData);
      }
    }
  }

  /**
   * Parse AI response
   */
  static parseAIResponse(content) {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const recommendations = JSON.parse(jsonMatch[0]);

      // Validate structure
      return recommendations.filter(rec =>
        rec.title && rec.description && rec.priority && rec.category
      );
    } catch (error) {
      logger.error('Failed to parse AI response:', error);
      throw error;
    }
  }

  /**
   * Fallback recommendations based on issues
   */
  static getFallbackRecommendations(healthData) {
    const recommendations = [];
    const { breakdown, priorityIssues } = healthData;

    // Performance recommendations
    if (breakdown.performance < 70) {
      recommendations.push({
        title: 'Improve Website Loading Speed',
        description: 'Your website loads slowly, causing visitors to leave. Optimize images and reduce page size to load faster.',
        priority: 'High',
        impact: 'Faster loading = more visitors stay and convert into customers',
        category: 'performance',
      });
    }

    // SEO recommendations
    if (breakdown.seo < 70) {
      const hasMissingTitle = priorityIssues.some(i => i.issue.includes('title'));
      const hasMissingMeta = priorityIssues.some(i => i.issue.includes('meta description'));

      if (hasMissingTitle) {
        recommendations.push({
          title: 'Add Page Title',
          description: 'Your page is missing a title tag. Add a clear, descriptive title with your main keywords to appear better in Google search.',
          priority: 'High',
          impact: 'Better search rankings = more free traffic from Google',
          category: 'seo',
        });
      }

      if (hasMissingMeta) {
        recommendations.push({
          title: 'Add Meta Description',
          description: 'Write a short description of your page (150 characters). This appears in Google search results and helps people click.',
          priority: 'High',
          impact: 'More clicks from search results = more potential customers',
          category: 'seo',
        });
      }
    }

    // Structure recommendations
    if (breakdown.structure < 70) {
      recommendations.push({
        title: 'Improve Page Structure',
        description: 'Use proper headings (H1, H2) to organize your content. This helps both visitors and search engines understand your page.',
        priority: 'Medium',
        impact: 'Better organization = easier to read and better SEO',
        category: 'structure',
      });

      const hasImageIssues = priorityIssues.some(i => i.issue.includes('alt'));
      if (hasImageIssues) {
        recommendations.push({
          title: 'Add Image Descriptions',
          description: 'Add alt text to your images describing what they show. Helps visually impaired users and improves SEO.',
          priority: 'Medium',
          impact: 'Accessible website + better image search rankings',
          category: 'structure',
        });
      }
    }

    // Technical recommendations
    if (breakdown.technical < 70) {
      recommendations.push({
        title: 'Fix Technical Issues',
        description: 'Your website has technical problems that affect performance and user experience. Review and fix accessibility issues.',
        priority: 'Medium',
        impact: 'Professional website = more trust from visitors',
        category: 'technical',
      });
    }

    // Generic improvement if few specific issues
    if (recommendations.length < 3) {
      recommendations.push({
        title: 'Optimize for Mobile Devices',
        description: 'Ensure your website works perfectly on phones and tablets. Most visitors now browse on mobile.',
        priority: 'High',
        impact: 'Mobile-friendly = reach more customers and better Google rankings',
        category: 'technical',
      });
    }

    return recommendations.slice(0, 10); // Max 10
  }

  /**
   * Sleep utility
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AIRecommendationService;
