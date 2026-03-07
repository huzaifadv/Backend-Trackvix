const geoip = require('geoip-lite');
const TrafficDailyStats = require('../models/TrafficDailyStats');
const LeadsDailyStats = require('../models/LeadsDailyStats');
const Website = require('../models/Website');
const UniqueVisitor = require('../models/UniqueVisitor');

/**
 * Tracking Service
 * Handles event processing and aggregation with atomic updates
 * Designed for horizontal scaling
 */
class TrackingService {
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
    // Remove IPv6 prefix if present
    const cleanIP = ip.replace(/^::ffff:/, '');

    // Skip localhost
    if (cleanIP === '127.0.0.1' || cleanIP === 'localhost') {
      return {
        country: 'Unknown',
        city: 'Unknown'
      };
    }

    const geo = geoip.lookup(cleanIP);
    return {
      country: geo ? geo.country : 'Unknown',
      city: geo ? geo.city : 'Unknown'
    };
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
    const geoData = this.getGeolocationFromIP(ip);
    const today = new Date();

    // Log visitor tracking for debugging
    const logger = require('../config/logger');
    logger.info('Visitor tracking:', {
      ip: ip,
      country: geoData.country,
      city: geoData.city,
      source: source,
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

    // Record unique visitor using IP address (per session)
    // Backend uses IP to identify unique visitors
    // Each new browser session counts as a new visitor
    if (eventData.isNewVisitor === true) {
      await UniqueVisitor.recordVisitor(
        websiteId,
        ip, // Use IP address for unique identification
        userAgent,
        geoData,
        eventData.device
      ).catch((error) => {
        logger.error('Failed to record visitor:', error);
      });
    }

    // Update traffic stats (source, device, location)
    const updates = {
      source: source,
      device: eventData.device,
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
  static async processTelClick(websiteId, eventData) {
    const today = new Date();

    const updates = {
      eventType: 'tel_click',
      device: eventData.device,
    };

    // Atomic update to leads stats
    await LeadsDailyStats.incrementStats(websiteId, today, updates);

    // Increment event count (actual event, not pageview)
    this.updateWebsiteMetadata(websiteId).catch(() => {});

    // Do NOT record visitor here - visitors are only recorded on pageview
  }

  /**
   * Process form submit event
   * NOTE: Does NOT record visitor - only pageviews record visitors
   */
  static async processFormSubmit(websiteId, eventData) {
    const today = new Date();

    const updates = {
      eventType: 'form_submit',
      device: eventData.device,
      formId: eventData.formId || 'unknown',
    };

    // Atomic update to leads stats
    await LeadsDailyStats.incrementStats(websiteId, today, updates);

    // Increment event count (actual event, not pageview)
    this.updateWebsiteMetadata(websiteId).catch(() => {});

    // Do NOT record visitor here - visitors are only recorded on pageview
  }

  /**
   * Process CTA button click event
   * NOTE: Does NOT record visitor - only pageviews record visitors
   */
  static async processCtaClick(websiteId, eventData) {
    const today = new Date();

    const updates = {
      eventType: 'cta_click',
      device: eventData.device,
      ctaId: eventData.ctaId || eventData.ctaText || 'unknown',
    };

    // Atomic update to leads stats
    await LeadsDailyStats.incrementStats(websiteId, today, updates);

    // Increment event count (actual event, not pageview)
    this.updateWebsiteMetadata(websiteId).catch(() => {});

    // Do NOT record visitor here - visitors are only recorded on pageview
  }

  /**
   * Process WhatsApp click event
   * NOTE: Does NOT record visitor - only pageviews record visitors
   */
  static async processWhatsAppClick(websiteId, eventData) {
    const today = new Date();

    const updates = {
      eventType: 'whatsapp_click',
      device: eventData.device,
      phoneNumber: eventData.phoneNumber,
    };

    // Atomic update to leads stats
    await LeadsDailyStats.incrementStats(websiteId, today, updates);

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
        await this.processTelClick(website._id, eventData);
        break;

      case 'whatsapp_click':
        await this.processWhatsAppClick(website._id, eventData);
        break;

      case 'cta_click':
        await this.processCtaClick(website._id, eventData);
        break;

      case 'form_submit':
        await this.processFormSubmit(website._id, eventData);
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
   * Get aggregated stats summary
   */
  static async getStatsSummary(websiteId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trafficStats = await this.getTrafficStats(websiteId, startDate, new Date());
    const leadsStats = await this.getLeadsStats(websiteId, startDate, new Date());

    // Get unique visitors count (IP-based)
    const uniqueVisitors = await UniqueVisitor.getUniqueCount(websiteId, startDate, new Date());

    // Aggregate event totals
    const totalCallClicks = leadsStats.reduce((sum, stat) => sum + stat.callClicks, 0);
    const totalFormSubmissions = leadsStats.reduce((sum, stat) => sum + stat.formSubmissions, 0);
    const totalCtaClicks = leadsStats.reduce((sum, stat) => sum + stat.ctaClicks || 0, 0);
    const totalWhatsAppClicks = leadsStats.reduce((sum, stat) => sum + stat.whatsappClicks || 0, 0);

    // Aggregate countries and cities
    const countriesMap = new Map();
    const citiesMap = new Map();

    trafficStats.forEach(stat => {
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
      period: { days, startDate, endDate: new Date() },
      traffic: {
        uniqueVisitors, // Only visitors, no pageviews
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
