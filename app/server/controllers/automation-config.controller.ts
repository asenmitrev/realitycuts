import { Request, Response } from 'express';
import automationService from '../services/automation.service';
import { asyncHandler } from '../utils/async-handler';
import { BadRequestError, NotFoundError } from '../errors';
import { AuthenticatedRequest, ITestGenerationRequest } from '../types';
import userProfileRepository from '../repositories/user-profile.repository';
export class AutomationConfigController {
  /**
   * Get all automation configs for a user
   */
  getUserConfigs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.uid;
    if (!userId) {
      throw new BadRequestError('User ID is required');
    }

    const configs = await automationService.getUserAutomationConfigs(userId);

    res.json(configs);
  });

  /**
   * Get automation limits and current usage for a user
   */
  getUserLimits = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.uid;
    if (!userId) {
      throw new BadRequestError('User ID is required');
    }

    const automationLimits = await automationService.getUserAutomationLimits(userId);

    res.json(automationLimits);
  });

  /**
   * Get automation config by ID
   */
  getConfigById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const config = await automationService.getAutomationConfigById(id);
    if (!config) {
      throw new NotFoundError('Automation config not found');
    }

    res.json(config);
  });

  /**
   * Get automation config by channel ID
   */
  getConfigByChannelId = asyncHandler(async (req: Request, res: Response) => {
    const { channelId } = req.params;

    const config = await automationService.getAutomationConfigByChannelId(channelId);
    if (!config) {
      throw new NotFoundError('Automation config not found');
    }

    res.json(config);
  });

  /**
   * Get all automation configs by channel ID
   */
  getAllConfigsByChannelId = asyncHandler(async (req: Request, res: Response) => {
    const { channelId } = req.params;

    const configs = await automationService.getAllAutomationConfigsByChannelId(channelId);

    res.json(configs);
  });

  /**
   * Create new automation config
   */
  createConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.uid;
    if (!userId) {
      throw new BadRequestError('User ID is required');
    }

    // Option A: all users have access to automation
    const config = await automationService.createAutomationConfig(userId, req.body);

    res.status(201).json(config);
  });

  /**
   * Update automation config by ID
   */
  updateConfigById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.uid;
    if (!userId) {
      throw new BadRequestError('User ID is required');
    }

    const { id } = req.params;
    const updates = req.body;

    // Option A: all users have access to automation
    const config = await automationService.updateAutomationConfigById(id, updates, userId);
    if (!config) {
      throw new NotFoundError('Automation config not found');
    }

    res.json(config);
  });

  /**
   * Update automation config
   */
  updateConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.uid;
    if (!userId) {
      throw new BadRequestError('User ID is required');
    }

    const { channelId } = req.params;
    const updates = req.body;

    // Option A: all users have access to automation
    const config = await automationService.updateAutomationConfig(channelId, updates, userId);
    if (!config) {
      throw new NotFoundError('Automation config not found');
    }

    res.json(config);
  });

  /**
   * Delete automation config by ID
   */
  deleteConfigById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const deleted = await automationService.deleteAutomationConfigById(id);
    if (!deleted) {
      throw new NotFoundError('Automation config not found');
    }

    res.json({ message: 'Automation config deleted successfully' });
  });

  /**
   * Delete automation config
   */
  deleteConfig = asyncHandler(async (req: Request, res: Response) => {
    const { channelId } = req.params;

    const deleted = await automationService.deleteAutomationConfig(channelId);
    if (!deleted) {
      throw new NotFoundError('Automation config not found');
    }

    res.json({ message: 'Automation config deleted successfully' });
  });

  /**
   * Get all active configs (admin only)
   */
  getActiveConfigs = asyncHandler(async (req: Request, res: Response) => {
    const configs = await automationService.getActiveAutomationConfigs();

    res.json(configs);
  });

  /**
   * Get all automations for admin (UAT only)
   */
  getAllAutomationsForAdmin = asyncHandler(async (req: Request, res: Response) => {
    // Check environment
    if (process.env.ENVIRONMENT !== 'uat') {
      res.status(401).json({ error: 'This endpoint is only available in UAT environment' });
      return;
    }

    const skip = typeof req.query.skip === 'string' ? parseInt(req.query.skip) : 0;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 50;

    const result = await automationService.getAllAutomationsForAdmin(skip, limit);

    res.json({
      automations: result.automations,
      total: result.total
    });
  });

  /**
   * Enable/disable automation config by ID
   */
  toggleConfigById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.uid;
    if (!userId) {
      throw new BadRequestError('User ID is required');
    }

    const { id } = req.params;
    const { isEnabled } = req.body;

    // Option A: all users have access to automation
    const config = await automationService.toggleAutomationConfigById(id, isEnabled);

    if (!config) {
      throw new NotFoundError('Automation config not found');
    }

    res.json(config);
  });

  /**
   * Enable/disable automation config
   */
  toggleConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.uid;
    if (!userId) {
      throw new BadRequestError('User ID is required');
    }

    const { channelId } = req.params;
    const { isEnabled } = req.body;

    // Option A: all users have access to automation
    const config = await automationService.toggleAutomationConfig(channelId, isEnabled);

    if (!config) {
      throw new NotFoundError('Automation config not found');
    }

    res.json(config);
  });

  /**
   * Test video generation with custom parameters
   */
  testGeneration = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.uid;
    if (!userId) {
      throw new BadRequestError('User ID is required');
    }

    // Option A: all users have access to automation
    const params: ITestGenerationRequest = req.body;

    if (!params.theme) {
      throw new BadRequestError('Theme is required');
    }

    const transcriptionJobId = await automationService.testVideoGeneration(userId, params);

    res.json({ transcriptionJobId });
  });
}

export default new AutomationConfigController();
