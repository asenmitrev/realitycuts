import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from '../../types';
import automationConfigController from '../automation-config.controller';
import automationService from '../../services/automation.service';
import { BadRequestError, NotFoundError } from '../../errors';

// Mock dependencies
vi.mock('../../services/automation.service', () => ({
  default: {
    getUserAutomationConfigs: vi.fn(),
    getUserAutomationLimits: vi.fn(),
    getAutomationConfigById: vi.fn(),
    getAutomationConfigByChannelId: vi.fn(),
    getAllAutomationConfigsByChannelId: vi.fn(),
    createAutomationConfig: vi.fn(),
    updateAutomationConfigById: vi.fn(),
    updateAutomationConfig: vi.fn(),
    deleteAutomationConfigById: vi.fn(),
    deleteAutomationConfig: vi.fn(),
    getActiveAutomationConfigs: vi.fn(),
    getAllAutomationsForAdmin: vi.fn(),
    toggleAutomationConfigById: vi.fn(),
    toggleAutomationConfig: vi.fn(),
    testVideoGeneration: vi.fn()
  }
}));

vi.mock('../../utils/async-handler', () => ({
  asyncHandler: (fn: any) => fn
}));

describe('AutomationConfigController', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = {
      user: { uid: 'test-user-id' },
      params: {},
      query: {},
      body: {}
    };

    mockResponse = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis()
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getUserConfigs', () => {
    it('should throw BadRequestError if user ID is missing', async () => {
      mockRequest.user = undefined;

      await expect(
        automationConfigController.getUserConfigs(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response,
          vi.fn() as unknown as NextFunction
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('should return user automation configs', async () => {
      const mockConfigs = [{ _id: 'config-1', userId: 'test-user-id' }];
      (automationService.getUserAutomationConfigs as any).mockResolvedValue(mockConfigs);

      await automationConfigController.getUserConfigs(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        vi.fn() as unknown as NextFunction
      );

      expect(automationService.getUserAutomationConfigs).toHaveBeenCalledWith('test-user-id');
      expect(mockResponse.json).toHaveBeenCalledWith(mockConfigs);
    });
  });

  describe('getUserLimits', () => {
    it('should throw BadRequestError if user ID is missing', async () => {
      mockRequest.user = undefined;

      await expect(
        automationConfigController.getUserLimits(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response,
          vi.fn() as unknown as NextFunction
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('should return user automation limits', async () => {
      const mockLimits = { dailyLimit: 10, usedToday: 5 };
      (automationService.getUserAutomationLimits as any).mockResolvedValue(mockLimits);

      await automationConfigController.getUserLimits(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        vi.fn() as unknown as NextFunction
      );

      expect(automationService.getUserAutomationLimits).toHaveBeenCalledWith('test-user-id');
      expect(mockResponse.json).toHaveBeenCalledWith(mockLimits);
    });
  });

  describe('getConfigById', () => {
    it('should throw NotFoundError if config not found', async () => {
      mockRequest.params = { id: 'config-1' };
      (automationService.getAutomationConfigById as any).mockResolvedValue(null);

      await expect(
        automationConfigController.getConfigById(
          mockRequest as Request,
          mockResponse as Response,
          vi.fn() as unknown as NextFunction
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('should return automation config by ID', async () => {
      mockRequest.params = { id: 'config-1' };
      const mockConfig = { _id: 'config-1', userId: 'test-user-id' };
      (automationService.getAutomationConfigById as any).mockResolvedValue(mockConfig);

      await automationConfigController.getConfigById(
        mockRequest as Request,
        mockResponse as Response,
        vi.fn() as unknown as NextFunction
      );

      expect(automationService.getAutomationConfigById).toHaveBeenCalledWith('config-1');
      expect(mockResponse.json).toHaveBeenCalledWith(mockConfig);
    });
  });

  describe('getConfigByChannelId', () => {
    it('should throw NotFoundError if config not found', async () => {
      mockRequest.params = { channelId: 'channel-1' };
      (automationService.getAutomationConfigByChannelId as any).mockResolvedValue(null);

      await expect(
        automationConfigController.getConfigByChannelId(
          mockRequest as Request,
          mockResponse as Response,
          vi.fn() as unknown as NextFunction
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('should return automation config by channel ID', async () => {
      mockRequest.params = { channelId: 'channel-1' };
      const mockConfig = { _id: 'config-1', channelId: 'channel-1' };
      (automationService.getAutomationConfigByChannelId as any).mockResolvedValue(mockConfig);

      await automationConfigController.getConfigByChannelId(
        mockRequest as Request,
        mockResponse as Response,
        vi.fn() as unknown as NextFunction
      );

      expect(automationService.getAutomationConfigByChannelId).toHaveBeenCalledWith('channel-1');
      expect(mockResponse.json).toHaveBeenCalledWith(mockConfig);
    });
  });

  describe('createConfig', () => {
    it('should throw BadRequestError if user ID is missing', async () => {
      mockRequest.user = undefined;

      await expect(
        automationConfigController.createConfig(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response,
          vi.fn() as unknown as NextFunction
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('should create automation config successfully', async () => {
      const mockConfig = { _id: 'config-1', userId: 'test-user-id' };
      mockRequest.body = { channelId: 'channel-1', isEnabled: true };

      (automationService.createAutomationConfig as any).mockResolvedValue(mockConfig);

      await automationConfigController.createConfig(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        vi.fn() as unknown as NextFunction
      );

      expect(automationService.createAutomationConfig).toHaveBeenCalledWith('test-user-id', mockRequest.body);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockConfig);
    });
  });

  describe('updateConfigById', () => {
    it('should throw BadRequestError if user ID is missing', async () => {
      mockRequest.user = undefined;

      await expect(
        automationConfigController.updateConfigById(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response,
          vi.fn() as unknown as NextFunction
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('should update automation config by ID', async () => {
      mockRequest.params = { id: 'config-1' };
      mockRequest.body = { isEnabled: false };
      const mockConfig = { _id: 'config-1', isEnabled: false };

      (automationService.updateAutomationConfigById as any).mockResolvedValue(mockConfig);

      await automationConfigController.updateConfigById(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        vi.fn() as unknown as NextFunction
      );

      expect(automationService.updateAutomationConfigById).toHaveBeenCalledWith(
        'config-1',
        mockRequest.body,
        'test-user-id'
      );
      expect(mockResponse.json).toHaveBeenCalledWith(mockConfig);
    });
  });

  describe('deleteConfigById', () => {
    it('should throw NotFoundError if config not found', async () => {
      mockRequest.params = { id: 'config-1' };
      (automationService.deleteAutomationConfigById as any).mockResolvedValue(false);

      await expect(
        automationConfigController.deleteConfigById(
          mockRequest as Request,
          mockResponse as Response,
          vi.fn() as unknown as NextFunction
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('should delete automation config by ID', async () => {
      mockRequest.params = { id: 'config-1' };
      (automationService.deleteAutomationConfigById as any).mockResolvedValue(true);

      await automationConfigController.deleteConfigById(
        mockRequest as Request,
        mockResponse as Response,
        vi.fn() as unknown as NextFunction
      );

      expect(automationService.deleteAutomationConfigById).toHaveBeenCalledWith('config-1');
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Automation config deleted successfully' });
    });
  });

  describe('toggleConfigById', () => {
    it('should throw BadRequestError if user ID is missing', async () => {
      mockRequest.user = undefined;

      await expect(
        automationConfigController.toggleConfigById(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response,
          vi.fn() as unknown as NextFunction
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('should toggle automation config by ID', async () => {
      mockRequest.params = { id: 'config-1' };
      mockRequest.body = { isEnabled: true };
      const mockConfig = { _id: 'config-1', isEnabled: true };

      (automationService.toggleAutomationConfigById as any).mockResolvedValue(mockConfig);

      await automationConfigController.toggleConfigById(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        vi.fn() as unknown as NextFunction
      );

      expect(automationService.toggleAutomationConfigById).toHaveBeenCalledWith('config-1', true);
      expect(mockResponse.json).toHaveBeenCalledWith(mockConfig);
    });
  });

  describe('testGeneration', () => {
    it('should throw BadRequestError if user ID is missing', async () => {
      mockRequest.user = undefined;

      await expect(
        automationConfigController.testGeneration(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response,
          vi.fn() as unknown as NextFunction
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError if theme is missing', async () => {
      mockRequest.body = {};

      await expect(
        automationConfigController.testGeneration(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response,
          vi.fn() as unknown as NextFunction
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('should test video generation', async () => {
      mockRequest.body = { theme: 'test-theme' };

      (automationService.testVideoGeneration as any).mockResolvedValue('transcription-job-id');

      await automationConfigController.testGeneration(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        vi.fn() as unknown as NextFunction
      );

      expect(automationService.testVideoGeneration).toHaveBeenCalledWith('test-user-id', mockRequest.body);
      expect(mockResponse.json).toHaveBeenCalledWith({ transcriptionJobId: 'transcription-job-id' });
    });
  });
});
