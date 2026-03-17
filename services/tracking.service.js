const mongoose = require('mongoose');
const geoip = require('geoip-lite');
const Event = require('../models/Event');
const TrafficDailyStats = require('../models/TrafficDailyStats');
const LeadsDailyStats = require('../models/LeadsDailyStats');
const Website = require('../models/Website');
const UniqueVisitor = require('../models/UniqueVisitor');
const Lead = require('../models/Lead');

// ISO country codes to full names mapping (most common countries)
const COUNTRY_NAMES = {
  'US': 'United States', 'PK': 'Pakistan', 'IN': 'India', 'GB': 'United Kingdom',
  'CA': 'Canada', 'AU': 'Australia', 'DE': 'Germany', 'FR': 'France', 'IT': 'Italy',
  'ES': 'Spain', 'NL': 'Netherlands', 'SE': 'Sweden', 'NO': 'Norway', 'DK': 'Denmark',
  'FI': 'Finland', 'PL': 'Poland', 'RU': 'Russia', 'UA': 'Ukraine', 'TR': 'Turkey',
  'SA': 'Saudi Arabia', 'AE': 'UAE', 'QA': 'Qatar', 'KW': 'Kuwait', 'OM': 'Oman',
  'BD': 'Bangladesh', 'LK': 'Sri Lanka', 'NP': 'Nepal', 'AF': 'Afghanistan',
  'CN': 'China', 'JP': 'Japan', 'KR': 'South Korea', 'TH': 'Thailand', 'VN': 'Vietnam',
  'PH': 'Philippines', 'ID': 'Indonesia', 'MY': 'Malaysia', 'SG': 'Singapore',
  'BR': 'Brazil', 'MX': 'Mexico', 'AR': 'Argentina', 'CL': 'Chile', 'CO': 'Colombia',
  'EG': 'Egypt', 'NG': 'Nigeria', 'ZA': 'South Africa', 'KE': 'Kenya', 'GH': 'Ghana',
  'NZ': 'New Zealand', 'IE': 'Ireland', 'CH': 'Switzerland', 'AT': 'Austria', 'BE': 'Belgium'
};

/**
 * Tracking Service
 * Handles event processing and aggregation with atomic updates
 * Designed for horizontal scaling
 */
class TrackingService {
  /**
   * Detect browser from user agent
   */
  static detectBrowser(userAgent) {
    if (!userAgent) return 'Other';

    const ua = userAgent.toLowerCase();

    if (ua.includes('edg/') || ua.includes('edge')) return 'Edge';
    if (ua.includes('chrome') && !ua.includes('edg')) return 'Chrome';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
    if (ua.includes('opera') || ua.includes('opr/')) return 'Other';

    return 'Other';
  }

  /**
   * Detect traffic source from referrer and UTM params
   */
  static detectSource(referrer, utmSource) {
    if (utmSource) {
      return utmSource.toLowerCase();
    }

    if (!referrer) {
      return 'direct';
    }

    const ref = referrer.toLowerCase();

    if (ref.includes('google')) return 'google';
    if (ref.includes('facebook') || ref.includes('fb.com')) return 'facebook';
    if (ref.includes('twitter') || ref.includes('t.co')) return 'twitter';
    if (ref.includes('instagram')) return 'instagram';
    if (ref.includes('linkedin')) return 'linkedin';
    if (ref.includes('youtube')) return 'youtube';

    return 'other';
  }

  /**
   * Get geolocation data from IP address
   */
  static getGeolocationFromIP(ip) {
    const logger = require('../config/logger');

    // Remove IPv6 prefix if present
    const cleanIP = ip.replace(/^::ffff:/, '').trim();

    logger.info('Geolocation lookup:', { originalIP: ip, cleanIP: cleanIP });

    // Skip localhost and private IPs (only in development)
    const isPrivateIP = cleanIP === '127.0.0.1' ||
                        cleanIP === 'localhost' ||
                        cleanIP.startsWith('192.168.') ||
                        cleanIP.startsWith('10.') ||
                        cleanIP.startsWith('172.16.') ||
                        cleanIP === '::1';

    if (isPrivateIP) {
      logger.warn('Local/private IP detected - geolocation unavailable:', cleanIP);
      return {
        country: 'Unknown',
        city: 'Unknown'
      };
    }

    // Validate IP format
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(cleanIP)) {
      logger.warn('Invalid IP format:', cleanIP);
      return {
        country: 'Unknown',
        city: 'Unknown'
      };
    }

    const geo = geoip.lookup(cleanIP);

    if (geo) {
      const countryName = COUNTRY_NAMES[geo.country] || geo.country; // Use full name or fallback to code
      logger.info('Geolocation found:', {
        ip: cleanIP,
        countryCode: geo.country,
        countryName: countryName,
        city: geo.city,
        region: geo.region
      });
      return {
        country: countryName,
        city: geo.city || 'Unknown'
      };
    } else {
      logger.warn('Geolocation not found for IP:', cleanIP);
      return {
        country: 'Unknown',
        city: 'Unknown'
      };
    }
  }

  /**
   * Validate event data
   */
  static validateEvent(eventData) {
    const allowedEvents = ['visitor', 'tel_click', 'whatsapp_click', 'cta_click', 'form_submit'];

    if (!allowedEvents.includes(eventData.eventType)) {
      throw new Error('Invalid event type');
    }

    return true;
  }

  /**
   * Process visitor event (IP-based tracking)
   * This replaces pageview - we only track visitors, not page views
   */
  static async processVisitor(websiteId, eventData, ip, userAgent) {
    const source = this.detectSource(eventData.referrer, eventData.utm_source);
    const browser = this.detectBrowser(userAgent);
    const geoData = this.getGeolocationFromIP(ip);
    const today = new Date();

    // Log visitor tracking for debugging
    const logger = require('../config/logger');
    logger.info('Visitor tracking:', {
      ip: ip,
      country: geoData.country,
      city: geoData.city,
      source: source,
      browser: browser,
      device: eventData.device,
      isNewVisitor: eventData.isNewVisitor
    });

    // Create Event document for visitor tracking
    // This is needed for analytics queries
    const Event = require('../models/Event');
    await Event.create({
      websiteId: websiteId,
      type: 'visitor',
      source: source,
      country: geoData.country,
      city: geoData.city,
      device: eventData.device || 'unknown',
      visitorId: eventData.visitorId,
      isNewVisitor: eventData.isNewVisitor || false,
      metadata: {
        userAgent: userAgent,
        ip: ip,
        referrer: eventData.referrer,
        path: eventData.url,
      }
    }).catch((error) => {
      logger.error('Failed to create visitor event:', error);
    });

    // Record unique visitor using IP address (for both new AND returning visitors)
    // This upsert operation:
    // - For NEW visitors: Creates record with firstSeen = now
    // - For RETURNING visitors: Updates lastSeen and increments visitCount
    // This ensures accurate tracking of both new and returning visitors
    await UniqueVisitor.recordVisitor(
      websiteId,
      ip, // Use IP address for unique identification
      userAgent,
      geoData,
      eventData.device
    ).catch((error) => {
      logger.error('Failed to record visitor:', error);
    });

    // Update traffic stats (source, device, browser, location)
    const updates = {
      source: source,
      device: eventData.device,
      browser: browser,
      country: geoData.country,
      city: geoData.city,
    };

    // Add campaign if present
    if (eventData.utm_campaign) {
      updates.campaign = eventData.utm_campaign;
    }

    // Update traffic stats WITHOUT incrementing totalVisits
    await TrafficDailyStats.incrementStats(websiteId, today, updates);

    // NOTE: Visitor tracking does NOT increment totalEvents counter
    // Only actual events (clicks, forms) increment the counter
  }

  /**
   * Send webhook notification for lead
   */
  static async sendWebhook(webhookUrl, leadData) {
    const axios = require('axios');
    const logger = require('../config/logger');

    try {
      const response = await axios.post(webhookUrl, leadData, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Website-Tracker-Webhook/1.0'
        },
        timeout: 5000 // 5 second timeout
      });

      logger.info('Webhook sent successfully:', {
        url: webhookUrl,
        status: response.status,
        leadId: leadData._id
      });

      return { success: true, status: response.status };
    } catch (error) {
      logger.error('Webhook failed:', {
        url: webhookUrl,
        error: error.message,
        leadId: leadData._id
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a Lead document from event data
   */
  static async createLeadFromEvent(websiteId, eventType, eventData, ip, userAgent, eventId = null) {
    try {
      const website = await Website.findById(websiteId).select('userId webhookUrl webhookEnabled');
      if (!website) {
        throw new Error('Website not found');
      }

      const geoData = this.getGeolocationFromIP(ip);
      const browser = this.detectBrowser(userAgent);
      const source = this.detectSource(eventData.referrer, eventData.utm_source);

      // Map source to Lead model format
      const sourceMap = {
        'google': 'Google',
        'facebook': 'Facebook',
        'instagram': 'Instagram',
        'twitter': 'Twitter',
        'linkedin': 'LinkedIn',
        'youtube': 'YouTube',
        'direct': 'Direct',
        'other': 'Other'
      };

      // Normalize device value to match enum (Desktop, Mobile, Tablet)
      let deviceValue = 'Desktop';
      if (eventData.device) {
        const deviceLower = eventData.device.toLowerCase();
        if (deviceLower === 'mobile') deviceValue = 'Mobile';
        else if (deviceLower === 'tablet') deviceValue = 'Tablet';
        else if (deviceLower === 'desktop') deviceValue = 'Desktop';
      }

      const leadData = {
        websiteId,
        userId: website.userId,
        eventType,
        eventId,
        // Contact info - Enhanced form tracking
        name: eventData.name || 'Anonymous',
        email: eventData.email || null,
        phone: eventData.phone || eventData.phoneNumber || null,
        message: eventData.message || null,
        subject: eventData.subject || eventData.formName || eventData.formId || 'Contact Form',
        formName: eventData.formName || eventData.formId || 'Contact Form',
        // Visitor intelligence
        source: sourceMap[source] || 'Direct',
        device: deviceValue,
        browser,
        country: geoData.country,
        city: geoData.city,
        ipAddress: ip,
        pageUrl: eventData.url,
        referrer: eventData.referrer,
        visitorFingerprint: eventData.visitorId,
        pagesVisited: eventData.pagesVisited || []
      };

      const lead = await Lead.create(leadData);
      const logger = require('../config/logger');
      logger.info('Lead created:', { leadId: lead._id, eventType, websiteId });

      // Send webhook if enabled (only for form submissions and call clicks)
      if (website.webhookEnabled && website.webhookUrl && ['form_submit', 'call_click'].includes(eventType)) {
        // Prepare webhook payload
        const webhookPayload = {
          event: 'lead.created',
          timestamp: new Date().toISOString(),
          lead: {
            id: lead._id.toString(),
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            message: lead.message,
            subject: lead.subject,
            formName: lead.formName,
            eventType: lead.eventType,
            source: lead.source,
            device: lead.device,
            browser: lead.browser,
            country: lead.country,
            city: lead.city,
            pageUrl: lead.pageUrl,
            referrer: lead.referrer,
            createdAt: lead.createdAt
          },
          website: {
            id: websiteId.toString(),
            domain: eventData.url ? new URL(eventData.url).hostname : 'unknown'
          }
        };

        // Send webhook asynchronously (don't wait for response)
        this.sendWebhook(website.webhookUrl, webhookPayload).catch(err => {
          logger.error('Webhook send failed:', err);
        });
      }

      return lead;
    } catch (error) {
      const logger = require('../config/logger');
      logger.error('Error creating lead:', error);
      return null;
    }
  }

  /**
   * Update website metadata and activate on first event
   */
  static async updateWebsiteMetadata(websiteId) {
    try {
      const website = await Website.findById(websiteId);

      if (website) {
        const isFirstEvent = !website.metadata.totalEvents || website.metadata.totalEvents === 0;

        const updates = {
          $inc: { 'metadata.totalEvents': 1 },
          $set: { 'metadata.lastEventAt': new Date() },
        };

        // Activate website on first event
        if (isFirstEvent && website.status === 'pending') {
          updates.$set.status = 'active';
          updates.$set.isActive = true;
          const logger = require('../config/logger');
          logger.info(`Website ${websiteId} activated - first event received`);
        }

        await Website.findByIdAndUpdate(websiteId, updates);
      }
    } catch (error) {
      const logger = require('../config/logger');
      logger.error('Failed to update website metadata:', error);
    }
  }

  /**
   * Process tel click event
   * NOTE: Does NOT record visitor - only pageviews record visitors
   */
  static async processTelClick(websiteId, eventData, ip, userAgent) {
    const today = new Date();

    const updates = {
      eventType: 'tel_click',
      device: eventData.device,
    };

    // Atomic update to leads stats
    await LeadsDailyStats.incrementStats(websiteId, today, updates);

    // Get geolocation from IP
    const geoData = this.getGeolocationFromIP(ip);

    // Create Event document for real-time tracking
    const Event = require('../models/Event');
    const logger = require('../config/logger');

    const eventDoc = {
      websiteId: websiteId,
      type: 'call_click', // Event model uses 'call_click' not 'tel_click'
      source: this.detectSource(eventData.source, eventData.referrer),
      country: geoData.country,
      city: geoData.city,
      device: eventData.device || 'unknown',
      visitorId: eventData.visitorId,
      metadata: {
        userAgent: userAgent,
        ip: ip,
        referrer: eventData.referrer,
        path: eventData.url,
        phoneNumber: eventData.phoneNumber,
      }
    };

    logger.info('Creating call_click event with location:', {
      websiteId: websiteId.toString(),
      country: geoData.country,
      city: geoData.city,
      ip: ip
    });

    const event = await Event.create(eventDoc).catch((error) => {
      logger.error('Error creating call_click event:', error);
      return null;
    });

    // Create Lead document for inbox
    if (event) {
      await this.createLeadFromEvent(websiteId, 'call_click', eventData, ip, userAgent, event._id);
    }

    // Increment event count (actual event, not pageview)
    this.updateWebsiteMetadata(websiteId).catch(() => {});

    // Do NOT record visitor here - visitors are only recorded on pageview
  }

  /**
   * Process form submit event
   * NOTE: Does NOT record visitor - only pageviews record visitors
   */
  static async processFormSubmit(websiteId, eventData, ip, userAgent) {
    const today = new Date();

    const updates = {
      eventType: 'form_submit',
      device: eventData.device,
      formId: eventData.formId || 'unknown',
    };

    // Atomic update to leads stats
    await LeadsDailyStats.incrementStats(websiteId, today, updates);

    // Get geolocation from IP
    const geoData = this.getGeolocationFromIP(ip);

    // Create Event document for real-time tracking
    const Event = require('../models/Event');
    const event = await Event.create({
      websiteId: websiteId,
      type: 'form_submit',
      source: this.detectSource(eventData.source, eventData.referrer),
      country: geoData.country,
      city: geoData.city,
      device: eventData.device || 'unknown',
      visitorId: eventData.visitorId,
      metadata: {
        userAgent: userAgent,
        ip: ip,
        referrer: eventData.referrer,
        path: eventData.url,
        formId: eventData.formId || 'unknown',
      }
    }).catch((error) => {
      console.error('Error creating form_submit event:', error);
      return null;
    });

    // Create Lead document for inbox
    if (event) {
      await this.createLeadFromEvent(websiteId, 'form_submit', eventData, ip, userAgent, event._id);
    }

    // Increment event count (actual event, not pageview)
    this.updateWebsiteMetadata(websiteId).catch(() => {});

    // Do NOT record visitor here - visitors are only recorded on pageview
  }

  /**
   * Process CTA button click event
   * NOTE: Does NOT record visitor - only pageviews record visitors
   */
  static async processCtaClick(websiteId, eventData, ip, userAgent) {
    const today = new Date();

    const updates = {
      eventType: 'cta_click',
      device: eventData.device,
      ctaId: eventData.ctaId || eventData.ctaText || 'unknown',
    };

    // Atomic update to leads stats
    await LeadsDailyStats.incrementStats(websiteId, today, updates);

    // Get geolocation from IP
    const geoData = this.getGeolocationFromIP(ip);

    // Create Event document for real-time tracking
    const Event = require('../models/Event');
    await Event.create({
      websiteId: websiteId,
      type: 'cta_click',
      source: this.detectSource(eventData.source, eventData.referrer),
      country: geoData.country,
      city: geoData.city,
      device: eventData.device || 'unknown',
      visitorId: eventData.visitorId,
      metadata: {
        userAgent: userAgent,
        ip: ip,
        referrer: eventData.referrer,
        path: eventData.url,
        ctaId: eventData.ctaId || eventData.ctaText || 'unknown',
      }
    }).catch((error) => {
      console.error('Error creating cta_click event:', error);
    });

    // Increment event count (actual event, not pageview)
    this.updateWebsiteMetadata(websiteId).catch(() => {});

    // Do NOT record visitor here - visitors are only recorded on pageview
  }

  /**
   * Process WhatsApp click event
   * NOTE: Does NOT record visitor - only pageviews record visitors
   */
  static async processWhatsAppClick(websiteId, eventData, ip, userAgent) {
    const today = new Date();

    const updates = {
      eventType: 'whatsapp_click',
      device: eventData.device,
      phoneNumber: eventData.phoneNumber,
    };

    // Atomic update to leads stats
    await LeadsDailyStats.incrementStats(websiteId, today, updates);

    // Get geolocation from IP
    const geoData = this.getGeolocationFromIP(ip);

    // Create Event document for real-time tracking
    const Event = require('../models/Event');
    const event = await Event.create({
      websiteId: websiteId,
      type: 'whatsapp_click',
      source: this.detectSource(eventData.source, eventData.referrer),
      country: geoData.country,
      city: geoData.city,
      device: eventData.device || 'unknown',
      visitorId: eventData.visitorId,
      metadata: {
        userAgent: userAgent,
        ip: ip,
        referrer: eventData.referrer,
        path: eventData.url,
        phoneNumber: eventData.phoneNumber,
      }
    }).catch((error) => {
      console.error('Error creating whatsapp_click event:', error);
      return null;
    });

    // Create Lead document for inbox
    if (event) {
      await this.createLeadFromEvent(websiteId, 'whatsapp_click', eventData, ip, userAgent, event._id);
    }

    // Increment event count (actual event, not pageview)
    this.updateWebsiteMetadata(websiteId).catch(() => {});

    // Do NOT record visitor here - visitors are only recorded on pageview
  }

  /**
   * Main event processing function
   */
  static async processEvent(apiKey, eventData, ip, userAgent) {
    // Validate event type
    this.validateEvent(eventData);

    // Find website by API key
    const website = await Website.findByApiKey(apiKey);

    // Route to appropriate handler
    switch (eventData.eventType) {
      case 'visitor':
        await this.processVisitor(website._id, eventData, ip, userAgent);
        break;

      case 'tel_click':
        await this.processTelClick(website._id, eventData, ip, userAgent);
        break;

      case 'whatsapp_click':
        await this.processWhatsAppClick(website._id, eventData, ip, userAgent);
        break;

      case 'cta_click':
        await this.processCtaClick(website._id, eventData, ip, userAgent);
        break;

      case 'form_submit':
        await this.processFormSubmit(website._id, eventData, ip, userAgent);
        break;

      default:
        throw new Error('Unknown event type');
    }

    // Note: Event count is incremented in individual event handlers
    // Visitor tracking does NOT increment event count
    // Only actual events (clicks, forms) increment the counter

    return { success: true, websiteId: website._id };
  }

  /**
   * Get traffic stats for date range
   */
  static async getTrafficStats(websiteId, startDate, endDate) {
    return TrafficDailyStats.find({
      websiteId,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    }).sort({ date: 1 });
  }

  /**
   * Get leads stats for date range
   */
  static async getLeadsStats(websiteId, startDate, endDate) {
    return LeadsDailyStats.find({
      websiteId,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    }).sort({ date: 1 });
  }

  /**
   * Get leads location breakdown (countries and cities)
   * Only for actual lead events: call_click + form_submit
   */
  static async getLeadsLocationBreakdown(websiteId, startDate, endDate) {
    const leadEventTypes = ['call_click', 'form_submit'];

    // Top Countries for leads
    // Include "Unknown" for localhost testing
    const countries = await Event.aggregate([
      {
        $match: {
          websiteId: new mongoose.Types.ObjectId(websiteId),
          type: { $in: leadEventTypes },
          createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
          country: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$country',
          leads: { $sum: 1 },
        },
      },
      {
        $sort: { leads: -1 },
      },
      {
        $limit: 10,
      },
      {
        $project: {
          _id: 0,
          country: '$_id',
          leads: 1,
        },
      },
    ]);

    // Top Cities for leads
    // Include "Unknown" for localhost testing
    const cities = await Event.aggregate([
      {
        $match: {
          websiteId: new mongoose.Types.ObjectId(websiteId),
          type: { $in: leadEventTypes },
          createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
          city: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$city',
          leads: { $sum: 1 },
        },
      },
      {
        $sort: { leads: -1 },
      },
      {
        $limit: 10,
      },
      {
        $project: {
          _id: 0,
          city: '$_id',
          leads: 1,
        },
      },
    ]);

    // Convert country codes to full names
    const countriesWithNames = countries.map(item => ({
      country: COUNTRY_NAMES[item.country] || item.country,
      leads: item.leads,
    }));

    return { countries: countriesWithNames, cities };
  }

  /**
   * Get aggregated stats summary
   */
  static async getStatsSummary(websiteId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const endDate = new Date();

    const trafficStats = await this.getTrafficStats(websiteId, startDate, endDate);
    const leadsStats = await this.getLeadsStats(websiteId, startDate, endDate);

    // Get total visitors count - SAME AS TRAFFIC ANALYTICS
    // Count visitor events (each new session = 1 visitor)
    // This matches the Traffic Analytics logic exactly
    const totalVisitors = await Event.countDocuments({
      websiteId: new mongoose.Types.ObjectId(websiteId),
      type: 'visitor',
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // Also keep unique visitors (IP-based) for additional context
    const uniqueVisitors = await UniqueVisitor.getUniqueCount(websiteId, startDate, endDate);

    // Get new vs returning visitors
    const newVisitors = await UniqueVisitor.countDocuments({
      websiteId: new mongoose.Types.ObjectId(websiteId),
      firstSeen: { $gte: startDate, $lte: endDate },
    });

    const returningVisitors = uniqueVisitors - newVisitors;

    // Aggregate event totals
    const totalCallClicks = leadsStats.reduce((sum, stat) => sum + stat.callClicks, 0);
    const totalFormSubmissions = leadsStats.reduce((sum, stat) => sum + stat.formSubmissions, 0);
    const totalCtaClicks = leadsStats.reduce((sum, stat) => sum + stat.ctaClicks || 0, 0);
    const totalWhatsAppClicks = leadsStats.reduce((sum, stat) => sum + stat.whatsappClicks || 0, 0);

    // Aggregate sources, countries and cities
    const sourcesMap = {
      google: 0,
      facebook: 0,
      twitter: 0,
      instagram: 0,
      linkedin: 0,
      youtube: 0,
      direct: 0,
      other: 0,
    };
    const countriesMap = new Map();
    const citiesMap = new Map();

    trafficStats.forEach(stat => {
      // Sources
      if (stat.sources) {
        sourcesMap.google += stat.sources.google || 0;
        sourcesMap.facebook += stat.sources.facebook || 0;
        sourcesMap.twitter += stat.sources.twitter || 0;
        sourcesMap.instagram += stat.sources.instagram || 0;
        sourcesMap.linkedin += stat.sources.linkedin || 0;
        sourcesMap.youtube += stat.sources.youtube || 0;
        sourcesMap.direct += stat.sources.direct || 0;
        sourcesMap.other += stat.sources.other || 0;
      }
      // Countries
      if (stat.countries) {
        stat.countries.forEach((count, country) => {
          countriesMap.set(country, (countriesMap.get(country) || 0) + count);
        });
      }
      // Cities
      if (stat.cities) {
        stat.cities.forEach((count, city) => {
          citiesMap.set(city, (citiesMap.get(city) || 0) + count);
        });
      }
    });

    // Get top country and city
    const topCountry = [...countriesMap.entries()].sort((a, b) => b[1] - a[1])[0];
    const topCity = [...citiesMap.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      period: { days, startDate, endDate },
      traffic: {
        totalVisitors, // Total visitor events - matches Traffic Analytics
        uniqueVisitors, // Unique IP-based visitors (for additional context)
        newVisitors, // First-time visitors in this period
        returningVisitors, // Repeat visitors (uniqueVisitors - newVisitors)
        sources: sourcesMap, // Traffic sources breakdown
        topCountry: topCountry ? { country: topCountry[0], count: topCountry[1] } : null,
        topCity: topCity ? { city: topCity[0], count: topCity[1] } : null,
        countries: Object.fromEntries(countriesMap),
        cities: Object.fromEntries(citiesMap),
        daily: trafficStats,
      },
      leads: {
        totalCallClicks,
        totalFormSubmissions,
        totalCtaClicks, // CTA clicks tracked separately (not a lead)
        totalWhatsAppClicks, // WhatsApp clicks tracked separately (not a lead)
        // LEADS = Only actual conversions (tel clicks and form submits)
        // CTA clicks and WhatsApp are just interactions, not leads
        totalLeads: totalCallClicks + totalFormSubmissions,
        daily: leadsStats,
      },
    };
  }
}

module.exports = TrackingService;
