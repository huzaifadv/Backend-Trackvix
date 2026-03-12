const mongoose = require('mongoose');
const Website = require('../models/Website');
const Event = require('../models/Event');
const UniqueVisitor = require('../models/UniqueVisitor');
const TrafficDailyStats = require('../models/TrafficDailyStats');

/**
 * Traffic Analytics Service
 * Optimized queries for traffic analytics dashboard
 */

/**
 * Get traffic summary cards data
 */
exports.getTrafficSummary = async (websiteId, userId, startDate, endDate) => {
  // Verify website ownership
  const website = await Website.findOne({ _id: websiteId, userId });
  if (!website) {
    throw new Error('Website not found or access denied');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Calculate previous period for comparison
  const periodDuration = end - start;
  const prevStart = new Date(start - periodDuration);
  const prevEnd = new Date(start);

  // Total Visitors (visitor events)
  const [totalVisitors, prevTotalVisitors] = await Promise.all([
    Event.countDocuments({
      websiteId: new mongoose.Types.ObjectId(websiteId),
      type: 'visitor',
      createdAt: { $gte: start, $lte: end },
    }),
    Event.countDocuments({
      websiteId: new mongoose.Types.ObjectId(websiteId),
      type: 'visitor',
      createdAt: { $gte: prevStart, $lt: prevEnd },
    }),
  ]);

  // Unique Visitors
  const [uniqueVisitors, prevUniqueVisitors] = await Promise.all([
    UniqueVisitor.countDocuments({
      websiteId: new mongoose.Types.ObjectId(websiteId),
      lastSeen: { $gte: start, $lte: end },
    }),
    UniqueVisitor.countDocuments({
      websiteId: new mongoose.Types.ObjectId(websiteId),
      lastSeen: { $gte: prevStart, $lt: prevEnd },
    }),
  ]);

  // New vs Returning Visitors
  const newVisitors = await UniqueVisitor.countDocuments({
    websiteId: new mongoose.Types.ObjectId(websiteId),
    firstSeen: { $gte: start, $lte: end },
  });

  const returningVisitors = uniqueVisitors - newVisitors;

  // Calculate previous period new/returning
  const prevNewVisitors = await UniqueVisitor.countDocuments({
    websiteId: new mongoose.Types.ObjectId(websiteId),
    firstSeen: { $gte: prevStart, $lt: prevEnd },
  });
  const prevReturningVisitors = prevUniqueVisitors - prevNewVisitors;

  // Calculate percentage changes
  const calculateChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  // Total Leads (ONLY actual conversions: call_click + form_submit)
  // Matching Dashboard logic - CTA and WhatsApp are interactions, not leads
  const leadEventTypes = ['call_click', 'form_submit'];

  const [totalLeads, prevTotalLeads] = await Promise.all([
    Event.countDocuments({
      websiteId: new mongoose.Types.ObjectId(websiteId),
      type: { $in: leadEventTypes },
      createdAt: { $gte: start, $lte: end },
    }),
    Event.countDocuments({
      websiteId: new mongoose.Types.ObjectId(websiteId),
      type: { $in: leadEventTypes },
      createdAt: { $gte: prevStart, $lt: prevEnd },
    }),
  ]);

  return {
    totalVisitors: {
      count: totalVisitors,
      change: calculateChange(totalVisitors, prevTotalVisitors),
      isPositive: totalVisitors >= prevTotalVisitors,
    },
    totalLeads: {
      count: totalLeads,
      change: calculateChange(totalLeads, prevTotalLeads),
      isPositive: totalLeads >= prevTotalLeads,
    },
    newVisitors: {
      count: newVisitors,
      change: calculateChange(newVisitors, prevNewVisitors),
      isPositive: newVisitors >= prevNewVisitors,
    },
    returningVisitors: {
      count: returningVisitors,
      change: calculateChange(returningVisitors, prevReturningVisitors),
      isPositive: returningVisitors >= prevReturningVisitors,
    },
  };
};

/**
 * Get visitor trend over time
 */
exports.getVisitorTrend = async (websiteId, userId, startDate, endDate, interval = 'daily') => {
  // Verify website ownership
  const website = await Website.findOne({ _id: websiteId, userId });
  if (!website) {
    throw new Error('Website not found or access denied');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  let groupFormat;
  if (interval === 'hourly') {
    groupFormat = {
      year: { $year: '$createdAt' },
      month: { $month: '$createdAt' },
      day: { $dayOfMonth: '$createdAt' },
      hour: { $hour: '$createdAt' },
    };
  } else {
    // Daily
    groupFormat = {
      year: { $year: '$createdAt' },
      month: { $month: '$createdAt' },
      day: { $dayOfMonth: '$createdAt' },
    };
  }

  const trend = await Event.aggregate([
    {
      $match: {
        websiteId: new mongoose.Types.ObjectId(websiteId),
        type: 'visitor',
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: groupFormat,
        visitors: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 },
    },
    {
      $project: {
        _id: 0,
        date: {
          $dateFromParts: {
            year: '$_id.year',
            month: '$_id.month',
            day: '$_id.day',
            hour: { $ifNull: ['$_id.hour', 0] },
          },
        },
        visitors: 1,
      },
    },
  ]);

  return trend;
};

/**
 * Get location breakdown (countries and cities)
 */
exports.getLocationBreakdown = async (websiteId, userId, startDate, endDate) => {
  // Verify website ownership
  const website = await Website.findOne({ _id: websiteId, userId });
  if (!website) {
    throw new Error('Website not found or access denied');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Top Countries
  const countries = await Event.aggregate([
    {
      $match: {
        websiteId: new mongoose.Types.ObjectId(websiteId),
        type: 'visitor',
        createdAt: { $gte: start, $lte: end },
        country: { $exists: true, $ne: null, $ne: 'Unknown' },
      },
    },
    {
      $group: {
        _id: '$country',
        visitors: { $sum: 1 },
      },
    },
    {
      $sort: { visitors: -1 },
    },
    {
      $limit: 10, // Increased from 5 to 10
    },
    {
      $project: {
        _id: 0,
        country: '$_id',
        visitors: 1,
      },
    },
  ]);

  // Top Cities
  const cities = await Event.aggregate([
    {
      $match: {
        websiteId: new mongoose.Types.ObjectId(websiteId),
        type: 'visitor',
        createdAt: { $gte: start, $lte: end },
        city: { $exists: true, $ne: null, $ne: 'Unknown' },
      },
    },
    {
      $group: {
        _id: '$city',
        visitors: { $sum: 1 },
      },
    },
    {
      $sort: { visitors: -1 },
    },
    {
      $limit: 10, // Increased from 5 to 10
    },
    {
      $project: {
        _id: 0,
        city: '$_id',
        visitors: 1,
      },
    },
  ]);

  return { countries, cities };
};

/**
 * Get device breakdown
 */
exports.getDeviceBreakdown = async (websiteId, userId, startDate, endDate) => {
  // Verify website ownership
  const website = await Website.findOne({ _id: websiteId, userId });
  if (!website) {
    throw new Error('Website not found or access denied');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  const devices = await Event.aggregate([
    {
      $match: {
        websiteId: new mongoose.Types.ObjectId(websiteId),
        type: 'visitor',
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: '$device',
        visitors: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        device: '$_id',
        visitors: 1,
      },
    },
  ]);

  // Calculate total and percentages
  const total = devices.reduce((sum, d) => sum + d.visitors, 0);

  const breakdown = devices.map((d) => ({
    device: d.device,
    visitors: d.visitors,
    percentage: total > 0 ? ((d.visitors / total) * 100).toFixed(1) : 0,
  }));

  return breakdown;
};
