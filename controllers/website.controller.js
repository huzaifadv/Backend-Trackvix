const websiteService = require('../services/website.service');
const ApiResponse = require('../utils/response');
const { asyncHandler } = require('../middlewares/error.middleware');

/**
 * Website Controller
 * Handles HTTP requests for website management
 */

class WebsiteController {
  /**
   * Create new website
   * POST /api/v1/websites
   */
  createWebsite = asyncHandler(async (req, res) => {
    const { name, domain } = req.body;

    const website = await websiteService.createWebsite(req.userId, name, domain);

    return ApiResponse.created(res, 'Website created successfully', website);
  });

  /**
   * Get all user websites
   * GET /api/v1/websites
   */
  getUserWebsites = asyncHandler(async (req, res) => {
    const websites = await websiteService.getUserWebsites(req.userId);

    return ApiResponse.success(res, 200, 'Websites fetched successfully', websites);
  });

  /**
   * Get website by ID
   * GET /api/v1/websites/:id
   */
  getWebsiteById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const website = await websiteService.getWebsiteById(id, req.userId);

    return ApiResponse.success(res, 200, 'Website fetched successfully', website);
  });

  /**
   * Update website
   * PUT /api/v1/websites/:id
   */
  updateWebsite = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const website = await websiteService.updateWebsite(id, req.userId, req.body);

    return ApiResponse.success(res, 200, 'Website updated successfully', website);
  });

  /**
   * Delete website
   * DELETE /api/v1/websites/:id
   */
  deleteWebsite = asyncHandler(async (req, res) => {
    const { id } = req.params;

    await websiteService.deleteWebsite(id, req.userId);

    return ApiResponse.success(res, 200, 'Website deleted successfully');
  });

  /**
   * Toggle website status
   * POST /api/v1/websites/:id/toggle
   */
  toggleStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const website = await websiteService.toggleWebsiteStatus(id, req.userId);

    return ApiResponse.success(res, 200, 'Website status toggled successfully', website);
  });

  /**
   * Regenerate API key
   * POST /api/v1/websites/:id/regenerate-key
   */
  regenerateApiKey = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const website = await websiteService.regenerateApiKey(id, req.userId);

    return ApiResponse.success(res, 200, 'API key regenerated successfully', website);
  });
}

module.exports = new WebsiteController();
