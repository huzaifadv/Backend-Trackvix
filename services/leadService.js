const Lead = require('../models/Lead');
const Website = require('../models/Website');
const Event = require('../models/Event');

class LeadService {
  /**
   * Create a new lead from form submission or event
   */
  async createLead(leadData) {
    const {
      websiteId,
      name,
      email,
      phone,
      message,
      subject,
      formName,
      source,
      device,
      browser,
      country,
      city,
      ipAddress,
      pageUrl,
      referrer,
      visitorFingerprint,
      pagesVisited,
      eventType,
      eventId
    } = leadData;

    // Get website to find userId
    const website = await Website.findById(websiteId);
    if (!website) {
      throw new Error('Website not found');
    }

    // Create the lead
    const lead = new Lead({
      websiteId,
      userId: website.userId,
      name,
      email,
      phone,
      message,
      subject: subject || this.generateSubject(formName, eventType),
      formName: formName || this.getFormNameFromEventType(eventType),
      source: source || 'Direct',
      device: device || 'Desktop',
      browser,
      country,
      city,
      ipAddress,
      pageUrl,
      referrer,
      visitorFingerprint,
      pagesVisited: pagesVisited || [],
      eventType: eventType || 'form_submit',
      eventId,
      status: 'new',
      isRead: false
    });

    await lead.save();
    return lead;
  }

  /**
   * Get leads for a user with filters
   */
  async getLeads(userId, filters = {}) {
    const {
      websiteId,
      status,
      isRead,
      search,
      startDate,
      endDate,
      limit = 50,
      skip = 0
    } = filters;

    const query = { userId };

    if (websiteId) {
      query.websiteId = websiteId;
    }

    if (status) {
      query.status = status;
    }

    if (isRead !== undefined) {
      query.isRead = isRead;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const [leads, total] = await Promise.all([
      Lead.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .populate('websiteId', 'domain name')
        .lean(),
      Lead.countDocuments(query)
    ]);

    return {
      leads,
      total,
      hasMore: total > skip + leads.length
    };
  }

  /**
   * Get a single lead by ID
   */
  async getLeadById(leadId, userId) {
    const lead = await Lead.findOne({ _id: leadId, userId })
      .populate('websiteId', 'domain name apiKey')
      .lean();

    if (!lead) {
      throw new Error('Lead not found');
    }

    return lead;
  }

  /**
   * Mark lead as read
   */
  async markAsRead(leadId, userId) {
    const lead = await Lead.findOne({ _id: leadId, userId });

    if (!lead) {
      throw new Error('Lead not found');
    }

    if (!lead.isRead) {
      await lead.markAsRead();
    }

    return lead;
  }

  /**
   * Update lead status
   */
  async updateLeadStatus(leadId, userId, status) {
    const validStatuses = ['new', 'contacted', 'closed'];

    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status');
    }

    const lead = await Lead.findOne({ _id: leadId, userId });

    if (!lead) {
      throw new Error('Lead not found');
    }

    if (status === 'contacted') {
      await lead.markAsContacted();
    } else if (status === 'closed') {
      await lead.markAsClosed();
    } else {
      lead.status = status;
      await lead.save();
    }

    return lead;
  }

  /**
   * Add note to lead
   */
  async addNote(leadId, userId, noteText) {
    if (!noteText || !noteText.trim()) {
      throw new Error('Note text is required');
    }

    const lead = await Lead.findOne({ _id: leadId, userId });

    if (!lead) {
      throw new Error('Lead not found');
    }

    await lead.addNote(noteText.trim());
    return lead;
  }

  /**
   * Get lead statistics for dashboard
   */
  async getLeadStats(userId, websiteId = null) {
    const query = { userId };

    if (websiteId) {
      query.websiteId = websiteId;
    }

    const [totalLeads, newLeads, contactedLeads, closedLeads, unreadCount] = await Promise.all([
      Lead.countDocuments(query),
      Lead.countDocuments({ ...query, status: 'new' }),
      Lead.countDocuments({ ...query, status: 'contacted' }),
      Lead.countDocuments({ ...query, status: 'closed' }),
      Lead.countDocuments({ ...query, isRead: false })
    ]);

    return {
      total: totalLeads,
      new: newLeads,
      contacted: contactedLeads,
      closed: closedLeads,
      unread: unreadCount
    };
  }

  /**
   * Get visitor journey for a lead
   */
  async getVisitorJourney(leadId, userId) {
    const lead = await Lead.findOne({ _id: leadId, userId }).lean();

    if (!lead) {
      throw new Error('Lead not found');
    }

    // Get events for this visitor
    let events = [];
    if (lead.visitorFingerprint) {
      events = await Event.find({
        websiteId: lead.websiteId,
        visitorFingerprint: lead.visitorFingerprint,
        createdAt: { $lte: lead.createdAt }
      })
      .sort({ createdAt: 1 })
      .limit(50)
      .select('type pageUrl createdAt metadata')
      .lean();
    }

    return {
      lead,
      journey: events,
      pagesVisited: lead.pagesVisited || []
    };
  }

  /**
   * Delete a lead
   */
  async deleteLead(leadId, userId) {
    const result = await Lead.deleteOne({ _id: leadId, userId });

    if (result.deletedCount === 0) {
      throw new Error('Lead not found');
    }

    return true;
  }

  // Helper methods
  generateSubject(formName, eventType) {
    if (formName) {
      return `${formName} Submission`;
    }

    switch (eventType) {
      case 'call_click':
        return 'Phone Call Request';
      case 'whatsapp_click':
        return 'WhatsApp Contact Request';
      case 'cta_click':
        return 'CTA Interaction';
      default:
        return 'New Lead Inquiry';
    }
  }

  getFormNameFromEventType(eventType) {
    switch (eventType) {
      case 'call_click':
        return 'Call Button';
      case 'whatsapp_click':
        return 'WhatsApp Button';
      case 'cta_click':
        return 'CTA Button';
      default:
        return 'Contact Form';
    }
  }
}

module.exports = new LeadService();
