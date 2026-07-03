import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { AutomationService } from '../automation.service';
import userProfileRepository from '../../repositories/user-profile.repository';
import automationConfigRepository from '../../repositories/automation-config.repository';
import transcriptionJobRepository from '../../repositories/transcription-job.repository';
import { enqueueLambdaVideoGenerationTask } from '../task-queue';
import { BadRequestError, ForbiddenError } from '../../errors';
import { IAutomationConfig, ITestGenerationRequest } from '../../types';

// Mock all dependencies
vi.mock('../../repositories/user-profile.repository');
vi.mock('../../repositories/automation-config.repository');
vi.mock('../../repositories/transcription-job.repository');
vi.mock('../task-queue');
vi.mock('../automation-source.service', () => ({
  finalizeAndEnqueueSource: vi.fn().mockResolvedValue(undefined),
  removeAutomationSourceArtifacts: vi.fn().mockResolvedValue(undefined),
  reprocessAutomationSource: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('shared/utils/automation', () => ({
  getAutomationLimits: vi.fn((entitlements: string[]) => ({
    daily: entitlements.includes('premium') ? 5 : 1,
    weekly: entitlements.includes('premium') ? 10 : 2
  })),
  canCreateAutomation: vi.fn((entitlements: string[], counts: any, type: string) => {
    const limits = entitlements.includes('premium') ? { daily: 5, weekly: 10 } : { daily: 1, weekly: 2 };
    const current = type === 'DAILY' ? counts.daily : counts.weekly;
    const limit = type === 'DAILY' ? limits.daily : limits.weekly;
    return current < limit;
  }),
  getRemainingAutomationSlots: vi.fn((entitlements: string[], counts: any) => {
    const limits = entitlements.includes('premium') ? { daily: 5, weekly: 10 } : { daily: 1, weekly: 2 };
    return {
      daily: Math.max(0, limits.daily - counts.daily),
      weekly: Math.max(0, limits.weekly - counts.weekly)
    };
  })
}));

describe('AutomationService', () => {
  let service: AutomationService;
  const mockUserId = 'user-123';
  const mockUserProfile = {
    firebaseId: mockUserId,
    entitlements: ['premium']
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AutomationService();
  });

  describe('getUserAutomationLimits', () => {
    it('should return automation limits info for user', async () => {
      const mockCounts = { daily: 2, weekly: 5 };
      (userProfileRepository.findByFirebaseId as Mock).mockResolvedValue(mockUserProfile);
      (automationConfigRepository.countAutomationsByType as Mock).mockResolvedValue(mockCounts);

      const result = await service.getUserAutomationLimits(mockUserId);

      expect(userProfileRepository.findByFirebaseId).toHaveBeenCalledWith(mockUserId);
      expect(automationConfigRepository.countAutomationsByType).toHaveBeenCalledWith(mockUserId);
      expect(result).toHaveProperty('limits');
      expect(result).toHaveProperty('current');
      expect(result).toHaveProperty('remaining');
      expect(result).toHaveProperty('canCreateDaily');
      expect(result).toHaveProperty('canCreateWeekly');
    });

    it('should throw BadRequestError when user profile not found', async () => {
      (userProfileRepository.findByFirebaseId as Mock).mockResolvedValue(null);

      await expect(service.getUserAutomationLimits(mockUserId)).rejects.toThrow(BadRequestError);
    });
  });

  describe('validateAutomationCreation', () => {
    it('should not throw when user can create automation', async () => {
      const mockCounts = { daily: 2, weekly: 5 };
      (userProfileRepository.findByFirebaseId as Mock).mockResolvedValue(mockUserProfile);
      (automationConfigRepository.countAutomationsByType as Mock).mockResolvedValue(mockCounts);

      await expect(service.validateAutomationCreation(mockUserId, 'DAILY')).resolves.not.toThrow();
    });

    it('should throw ForbiddenError when daily limit reached', async () => {
      const mockCounts = { daily: 5, weekly: 5 };
      (userProfileRepository.findByFirebaseId as Mock).mockResolvedValue(mockUserProfile);
      (automationConfigRepository.countAutomationsByType as Mock).mockResolvedValue(mockCounts);

      await expect(service.validateAutomationCreation(mockUserId, 'DAILY')).rejects.toThrow(ForbiddenError);
    });

    it('should throw ForbiddenError when weekly limit reached', async () => {
      const mockCounts = { daily: 2, weekly: 10 };
      (userProfileRepository.findByFirebaseId as Mock).mockResolvedValue(mockUserProfile);
      (automationConfigRepository.countAutomationsByType as Mock).mockResolvedValue(mockCounts);

      await expect(service.validateAutomationCreation(mockUserId, 'WEEKLY')).rejects.toThrow(ForbiddenError);
    });

    it('should throw BadRequestError when user profile not found', async () => {
      (userProfileRepository.findByFirebaseId as Mock).mockResolvedValue(null);

      await expect(service.validateAutomationCreation(mockUserId, 'DAILY')).rejects.toThrow(BadRequestError);
    });
  });

  describe('getUserAutomationConfigs', () => {
    it('should return automation configs for user', async () => {
      const mockConfigs: IAutomationConfig[] = [
        {
          _id: 'config-1',
          userId: mockUserId,
          isEnabled: true,
          status: 'ACTIVE'
        } as IAutomationConfig
      ];
      (automationConfigRepository.findByUserId as Mock).mockResolvedValue(mockConfigs);

      const result = await service.getUserAutomationConfigs(mockUserId);

      expect(automationConfigRepository.findByUserId).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockConfigs);
    });
  });

  describe('getAllAutomationsForAdmin', () => {
    it('should return paginated automations', async () => {
      const mockAutomations: IAutomationConfig[] = [];
      const mockTotal = 0;
      (automationConfigRepository.getAllForAdmin as Mock).mockResolvedValue({
        automations: mockAutomations,
        total: mockTotal
      });

      const result = await service.getAllAutomationsForAdmin(0, 10);

      expect(automationConfigRepository.getAllForAdmin).toHaveBeenCalledWith(0, 10);
      expect(result).toEqual({ automations: mockAutomations, total: mockTotal });
    });
  });

  describe('getAutomationConfigById', () => {
    it('should return automation config by id', async () => {
      const mockConfig = { _id: 'config-1', userId: mockUserId } as IAutomationConfig;
      (automationConfigRepository.findById as Mock).mockResolvedValue(mockConfig);

      const result = await service.getAutomationConfigById('config-1');

      expect(automationConfigRepository.findById).toHaveBeenCalledWith('config-1');
      expect(result).toEqual(mockConfig);
    });

    it('should return null when config not found', async () => {
      (automationConfigRepository.findById as Mock).mockResolvedValue(null);

      const result = await service.getAutomationConfigById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getAutomationConfigByChannelId', () => {
    it('should return automation config by channel id', async () => {
      const mockConfig = { _id: 'config-1', channelId: 'channel-1' } as IAutomationConfig;
      (automationConfigRepository.findByChannelId as Mock).mockResolvedValue(mockConfig);

      const result = await service.getAutomationConfigByChannelId('channel-1');

      expect(automationConfigRepository.findByChannelId).toHaveBeenCalledWith('channel-1');
      expect(result).toEqual(mockConfig);
    });
  });

  describe('getAllAutomationConfigsByChannelId', () => {
    it('should return all automation configs by channel id', async () => {
      const mockConfigs: IAutomationConfig[] = [
        { _id: 'config-1', channelId: 'channel-1' } as IAutomationConfig
      ];
      (automationConfigRepository.findAllByChannelId as Mock).mockResolvedValue(mockConfigs);

      const result = await service.getAllAutomationConfigsByChannelId('channel-1');

      expect(automationConfigRepository.findAllByChannelId).toHaveBeenCalledWith('channel-1');
      expect(result).toEqual(mockConfigs);
    });
  });

  describe('createAutomationConfig', () => {
    const validConfigData = {
      contentSettings: { theme: 'test-theme' },
      schedule: { type: 'DAILY' }
    };

    it('should create automation config successfully', async () => {
      const mockCounts = { daily: 0, weekly: 0 };
      const mockConfig = { _id: 'config-1', ...validConfigData, userId: mockUserId } as IAutomationConfig;

      (userProfileRepository.findByFirebaseId as Mock).mockResolvedValue(mockUserProfile);
      (automationConfigRepository.countAutomationsByType as Mock).mockResolvedValue(mockCounts);
      (automationConfigRepository.create as Mock).mockResolvedValue(mockConfig);

      const result = await service.createAutomationConfig(mockUserId, validConfigData);

      expect(automationConfigRepository.create).toHaveBeenCalledWith({
        ...validConfigData,
        userId: mockUserId
      });
      expect(result).toEqual(mockConfig);
    });

    it('should throw BadRequestError when theme missing', async () => {
      const invalidConfig = {
        schedule: { type: 'DAILY' }
      };

      await expect(service.createAutomationConfig(mockUserId, invalidConfig)).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError when schedule type invalid', async () => {
      const invalidConfig = {
        contentSettings: { theme: 'test-theme' },
        schedule: { type: 'INVALID' }
      };

      await expect(service.createAutomationConfig(mockUserId, invalidConfig)).rejects.toThrow(BadRequestError);
    });
  });

  describe('updateAutomationConfigById', () => {
    it('should update automation config by id', async () => {
      const updates = { isEnabled: false };
      const mockExisting = {
        _id: 'config-1',
        userId: mockUserId,
        contentSettings: { theme: 't' }
      } as IAutomationConfig;
      const mockUpdatedConfig = { _id: 'config-1', ...updates } as IAutomationConfig;
      (automationConfigRepository.findById as Mock).mockResolvedValue(mockExisting);
      (automationConfigRepository.updateById as Mock).mockResolvedValue(mockUpdatedConfig);

      const result = await service.updateAutomationConfigById('config-1', updates, mockUserId);

      expect(automationConfigRepository.findById).toHaveBeenCalledWith('config-1');
      expect(automationConfigRepository.updateById).toHaveBeenCalledWith('config-1', updates);
      expect(result).toEqual(mockUpdatedConfig);
    });
  });

  describe('updateAutomationConfig', () => {
    it('should update automation config by channel id', async () => {
      const updates = { isEnabled: false };
      const mockExisting = {
        _id: 'config-1',
        userId: mockUserId,
        contentSettings: { theme: 't' }
      } as IAutomationConfig;
      const mockUpdatedConfig = { _id: 'config-1', ...updates } as IAutomationConfig;
      (automationConfigRepository.findByChannelId as Mock).mockResolvedValue(mockExisting);
      (automationConfigRepository.update as Mock).mockResolvedValue(mockUpdatedConfig);

      const result = await service.updateAutomationConfig('channel-1', updates, mockUserId);

      expect(automationConfigRepository.findByChannelId).toHaveBeenCalledWith('channel-1');
      expect(automationConfigRepository.update).toHaveBeenCalledWith('channel-1', updates);
      expect(result).toEqual(mockUpdatedConfig);
    });
  });

  describe('deleteAutomationConfigById', () => {
    it('should delete automation config by id', async () => {
      (automationConfigRepository.deleteById as Mock).mockResolvedValue(true);

      const result = await service.deleteAutomationConfigById('config-1');

      expect(automationConfigRepository.deleteById).toHaveBeenCalledWith('config-1');
      expect(result).toBe(true);
    });
  });

  describe('deleteAutomationConfig', () => {
    it('should delete automation config by channel id', async () => {
      (automationConfigRepository.delete as Mock).mockResolvedValue(true);

      const result = await service.deleteAutomationConfig('channel-1');

      expect(automationConfigRepository.delete).toHaveBeenCalledWith('channel-1');
      expect(result).toBe(true);
    });
  });

  describe('getActiveAutomationConfigs', () => {
    it('should return active automation configs', async () => {
      const mockConfigs: IAutomationConfig[] = [
        { _id: 'config-1', isEnabled: true, status: 'ACTIVE' } as IAutomationConfig
      ];
      (automationConfigRepository.findActive as Mock).mockResolvedValue(mockConfigs);

      const result = await service.getActiveAutomationConfigs();

      expect(automationConfigRepository.findActive).toHaveBeenCalled();
      expect(result).toEqual(mockConfigs);
    });
  });

  describe('toggleAutomationConfigById', () => {
    it('should toggle automation config by id to enabled', async () => {
      const mockConfig = { _id: 'config-1', isEnabled: true, status: 'ACTIVE' } as IAutomationConfig;
      (automationConfigRepository.updateById as Mock).mockResolvedValue(mockConfig);

      const result = await service.toggleAutomationConfigById('config-1', true);

      expect(automationConfigRepository.updateById).toHaveBeenCalledWith('config-1', {
        isEnabled: true,
        status: 'ACTIVE'
      });
      expect(result).toEqual(mockConfig);
    });

    it('should toggle automation config by id to disabled', async () => {
      const mockConfig = { _id: 'config-1', isEnabled: false, status: 'PAUSED' } as IAutomationConfig;
      (automationConfigRepository.updateById as Mock).mockResolvedValue(mockConfig);

      const result = await service.toggleAutomationConfigById('config-1', false);

      expect(automationConfigRepository.updateById).toHaveBeenCalledWith('config-1', {
        isEnabled: false,
        status: 'PAUSED'
      });
      expect(result).toEqual(mockConfig);
    });

    it('should throw BadRequestError when isEnabled is not boolean', async () => {
      await expect(service.toggleAutomationConfigById('config-1', 'true' as any)).rejects.toThrow(BadRequestError);
    });
  });

  describe('toggleAutomationConfig', () => {
    it('should toggle automation config by channel id', async () => {
      const mockConfig = { _id: 'config-1', isEnabled: true, status: 'ACTIVE' } as IAutomationConfig;
      (automationConfigRepository.update as Mock).mockResolvedValue(mockConfig);

      const result = await service.toggleAutomationConfig('channel-1', true);

      expect(automationConfigRepository.update).toHaveBeenCalledWith('channel-1', {
        isEnabled: true,
        status: 'ACTIVE'
      });
      expect(result).toEqual(mockConfig);
    });

    it('should throw BadRequestError when isEnabled is not boolean', async () => {
      await expect(service.toggleAutomationConfig('channel-1', 'false' as any)).rejects.toThrow(BadRequestError);
    });
  });

  describe('testVideoGeneration', () => {
    it('should create transcription job and enqueue video generation', async () => {
      const mockParams: ITestGenerationRequest = {
        theme: 'test-theme',
        contentType: 'script',
        includeMusic: false,
        brollDuration: 3.5
      };
      const mockTj = { _id: 'tj-123' };
      (transcriptionJobRepository.create as Mock).mockResolvedValue(mockTj);
      (enqueueLambdaVideoGenerationTask as Mock).mockResolvedValue(undefined);

      const result = await service.testVideoGeneration(mockUserId, mockParams);

      expect(transcriptionJobRepository.create).toHaveBeenCalled();
      expect(enqueueLambdaVideoGenerationTask).toHaveBeenCalled();
      expect(result).toBe('tj-123');
    });

  });
});

