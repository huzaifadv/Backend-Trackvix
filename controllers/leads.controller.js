const { asyncHandler } = require('../middlewares/error.middleware');
const ApiResponse = require('../utils/response');
const Event = require('../models/Event');
const Website = require('../models/Website');
const mongoose = require('mongoose');

/**
 * Leads Controller
 * Handles real-time lead tracking and analytics
 */

class LeadsController {
  /**
   * Get recent leads (real-time feed)
   * GET /api/v1/leads/recent/:websiteId
   */
  getRecentLeads = asyncHandler(async (req, res) => {
    const { websiteId } = req.params;
    const { limit = 50, since } = req.query;

    // Verify website ownership
    const website = await Website.findOne({
      _id: websiteId,
      userId: req.userId
    });

    if (!website) {
      return ApiResponse.notFound(res, 'Website not found');
    }

    // Build query for lead events
    const query = {
      websiteId: new mongoose.Types.ObjectId(websiteId),
      type: { $in: ['call_click', 'form_submit', 'whatsapp_click', 'cta_click'] },
    };

    // If since timestamp provided, get only newer events (for polling)
    if (since) {
      query.createdAt = { $gt: new Date(since) };
    }

    // Fetch recent leads with location data
    const leads = await Event.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('type country city device createdAt metadata')
      .lean();

    // Format response
    const formattedLeads = leads.map(lead => ({
      id: lead._id,
      type: lead.type,
      location: {
        country: lead.country || 'Unknown',
        city: lead.city || 'Unknown',
      },
      device: lead.device || 'unknown',
      timestamp: lead.createdAt,
      details: {
        phoneNumber: lead.metadata?.phoneNumber,
        formId: lead.metadata?.formId,
        ctaId: lead.metadata?.ctaId || lead.metadata?.ctaText,
        path: lead.metadata?.path,
        referrer: lead.metadata?.referrer,
      }
    }));

    return ApiResponse.success(res, 200, 'Recent leads fetched successfully', {
      leads: formattedLeads,
      count: formattedLeads.length,
      timestamp: new Date(),
    });
  });

  /**
   * Get real-time lead statistics
   * GET /api/v1/leads/realtime/:websiteId
   */
  getRealtimeLeadStats = asyncHandler(async (req, res) => {
    const { websiteId } = req.params;

    // Verify website ownership
    const website = await Website.findOne({
      _id: websiteId,
      userId: req.userId
    });

    if (!website) {
      return ApiResponse.notFound(res, 'Website not found');
    }

    const now = new Date();
    const last15Min = new Date(now.getTime() - 15 * 60 * 1000);
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
    const today = new Date(now.setHours(0, 0, 0, 0));

    // Get counts for different time periods
    const [last15MinLeads, lastHourLeads, todayLeads, topLocations] = await Promise.all([
      // Last 15 minutes
      Event.countDocuments({
        websiteId: new mongoose.Types.ObjectId(websiteId),
        type: { $in: ['call_click', 'form_submit'] },
        createdAt: { $gte: last15Min }
      }),

      // Last hour
      Event.countDocuments({
        websiteId: new mongoose.Types.ObjectId(websiteId),
        type: { $in: ['call_click', 'form_submit'] },
        createdAt: { $gte: lastHour }
      }),

      // Today
      Event.countDocuments({
        websiteId: new mongoose.Types.ObjectId(websiteId),
        type: { $in: ['call_click', 'form_submit'] },
        createdAt: { $gte: today }
      }),

      // Top 5 locations for today
      Event.aggregate([
        {
          $match: {
            websiteId: new mongoose.Types.ObjectId(websiteId),
            type: { $in: ['call_click', 'form_submit'] },
            createdAt: { $gte: today },
            city: { $exists: true, $ne: null, $ne: 'Unknown' }
          }
        },
        {
          $group: {
            _id: {
              country: '$country',
              city: '$city'
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 5
        },
        {
          $project: {
            _id: 0,
            country: '$_id.country',
            city: '$_id.city',
            count: 1
          }
        }
      ])
    ]);

    return ApiResponse.success(res, 200, 'Real-time stats fetched successfully', {
      stats: {
        last15Minutes: last15MinLeads,
        lastHour: lastHourLeads,
        today: todayLeads,
        topLocations,
      },
      timestamp: new Date(),
    });
  });

  /**
   * Get lead activity timeline (hourly breakdown for today)
   * GET /api/v1/leads/timeline/:websiteId
   */
  getLeadTimeline = asyncHandler(async (req, res) => {
    const { websiteId } = req.params;

    // Verify website ownership
    const website = await Website.findOne({
      _id: websiteId,
      userId: req.userId
    });

    if (!website) {
      return ApiResponse.notFound(res, 'Website not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get hourly breakdown for today
    const timeline = await Event.aggregate([
      {
        $match: {
          websiteId: new mongoose.Types.ObjectId(websiteId),
          type: { $in: ['call_click', 'form_submit', 'whatsapp_click', 'cta_click'] },
          createdAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: {
            hour: { $hour: '$createdAt' },
            type: '$type'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.hour',
          leads: {
            $push: {
              type: '$_id.type',
              count: '$count'
            }
          },
          total: { $sum: '$count' }
        }
      },
      {
        $sort: { '_id': 1 }
      },
      {
        $project: {
          _id: 0,
          hour: '$_id',
          leads: 1,
          total: 1
        }
      }
    ]);

    return ApiResponse.success(res, 200, 'Lead timeline fetched successfully', {
      timeline,
      date: today,
      timestamp: new Date(),
    });
  });
}

module.exports = new LeadsController();
