const leadService = require('../services/leadService');
const ApiResponse = require('../utils/response');
const { asyncHandler } = require('../middlewares/error.middleware');

/**
 * @desc    Get all leads for authenticated user
 * @route   GET /api/v1/leads
 * @access  Private
 */
exports.getLeads = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const filters = {
    websiteId: req.query.websiteId,
    status: req.query.status,
    isRead: req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined,
    search: req.query.search,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    limit: req.query.limit || 50,
    skip: req.query.skip || 0
  };

  const result = await leadService.getLeads(userId, filters);

  return ApiResponse.success(res, 200, 'Leads fetched successfully', result);
});

/**
 * @desc    Get single lead by ID
 * @route   GET /api/v1/leads/:id
 * @access  Private
 */
exports.getLeadById = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const leadId = req.params.id;

  const lead = await leadService.getLeadById(leadId, userId);

  // Auto-mark as read when viewing
  await leadService.markAsRead(leadId, userId);

  return ApiResponse.success(res, 200, 'Lead fetched successfully', lead);
});

/**
 * @desc    Get lead statistics
 * @route   GET /api/v1/leads/stats
 * @access  Private
 */
exports.getLeadStats = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const websiteId = req.query.websiteId;

  const stats = await leadService.getLeadStats(userId, websiteId);

  return ApiResponse.success(res, 200, 'Lead statistics fetched successfully', stats);
});

/**
 * @desc    Get visitor journey for a lead
 * @route   GET /api/v1/leads/:id/journey
 * @access  Private
 */
exports.getVisitorJourney = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const leadId = req.params.id;

  const journey = await leadService.getVisitorJourney(leadId, userId);

  return ApiResponse.success(res, 200, 'Visitor journey fetched successfully', journey);
});

/**
 * @desc    Update lead status
 * @route   PATCH /api/v1/leads/:id/status
 * @access  Private
 */
exports.updateLeadStatus = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const leadId = req.params.id;
  const { status } = req.body;

  if (!status) {
    return ApiResponse.error(res, 400, 'Status is required');
  }

  const lead = await leadService.updateLeadStatus(leadId, userId, status);

  return ApiResponse.success(res, 200, 'Lead status updated successfully', lead);
});

/**
 * @desc    Mark lead as read
 * @route   PATCH /api/v1/leads/:id/read
 * @access  Private
 */
exports.markLeadAsRead = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const leadId = req.params.id;

  const lead = await leadService.markAsRead(leadId, userId);

  return ApiResponse.success(res, 200, 'Lead marked as read', lead);
});

/**
 * @desc    Add note to lead
 * @route   POST /api/v1/leads/:id/notes
 * @access  Private
 */
exports.addNote = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const leadId = req.params.id;
  const { note } = req.body;

  if (!note) {
    return ApiResponse.error(res, 400, 'Note text is required');
  }

  const lead = await leadService.addNote(leadId, userId, note);

  return ApiResponse.success(res, 200, 'Note added successfully', lead);
});

/**
 * @desc    Delete lead
 * @route   DELETE /api/v1/leads/:id
 * @access  Private
 */
exports.deleteLead = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const leadId = req.params.id;

  await leadService.deleteLead(leadId, userId);

  return ApiResponse.success(res, 200, 'Lead deleted successfully');
});
