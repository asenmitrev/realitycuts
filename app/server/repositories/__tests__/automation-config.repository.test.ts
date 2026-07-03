import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { AutomationConfig } from '../../models/automation-config';
import { AutomationConfigRepository } from '../automation-config.repository';
import { IAutomationConfig } from '../../types';
import { ENVIRONMENT } from '../../config/const';

vi.mock('../../models/automation-config');
vi.mock('../../config/const', () => ({
  ENVIRONMENT: 'test'
}));

describe('AutomationConfigRepository', () => {
  let repository: AutomationConfigRepository;
  const mockConfigId = 'config-123';
  const mockChannelId = 'channel-123';
  const mockUserId = 'user-123';

  const mockConfig: Partial<IAutomationConfig> = {
    _id: mockConfigId,
    userId: mockUserId,
    channelId: mockChannelId,
    isEnabled: true,
    status: 'ACTIVE',
    schedule: {
      type: 'DAILY',
      dailyTimes: [{ hour: 10, minute: 0 }]
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new AutomationConfigRepository();
  });

  describe('findById', () => {
    it('should find automation config by ID', async () => {
      (AutomationConfig.findById as Mock).mockResolvedValue(mockConfig);

      const result = await repository.findById(mockConfigId);

      expect(AutomationConfig.findById).toHaveBeenCalledWith(mockConfigId);
      expect(result).toEqual(mockConfig);
    });

    it('should return null when config not found', async () => {
      (AutomationConfig.findById as Mock).mockResolvedValue(null);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByChannelId', () => {
    it('should find automation config by channel ID', async () => {
      (AutomationConfig.findOne as Mock).mockResolvedValue(mockConfig);

      const result = await repository.findByChannelId(mockChannelId);

      expect(AutomationConfig.findOne).toHaveBeenCalledWith({ channelId: mockChannelId });
      expect(result).toEqual(mockConfig);
    });
  });

  describe('findAllByChannelId', () => {
    it('should find all automation configs by channel ID', async () => {
      const mockConfigs = [mockConfig];
      const mockSort = vi.fn().mockResolvedValue(mockConfigs);
      (AutomationConfig.find as Mock).mockReturnValue({
        sort: mockSort
      });

      const result = await repository.findAllByChannelId(mockChannelId);

      expect(AutomationConfig.find).toHaveBeenCalledWith({ channelId: mockChannelId });
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(result).toEqual(mockConfigs);
    });
  });

  describe('findByUserId', () => {
    it('should find automation configs by user ID', async () => {
      const mockConfigs = [mockConfig];
      const mockSort = vi.fn().mockResolvedValue(mockConfigs);
      (AutomationConfig.find as Mock).mockReturnValue({
        sort: mockSort
      });

      const result = await repository.findByUserId(mockUserId);

      expect(AutomationConfig.find).toHaveBeenCalledWith({ userId: mockUserId });
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(result).toEqual(mockConfigs);
    });
  });

  describe('countAutomationsByType', () => {
    it('should count automations by schedule type', async () => {
      (AutomationConfig.countDocuments as Mock)
        .mockResolvedValueOnce(5) // daily
        .mockResolvedValueOnce(3); // weekly

      const result = await repository.countAutomationsByType(mockUserId);

      expect(AutomationConfig.countDocuments).toHaveBeenCalledWith({
        userId: mockUserId,
        'schedule.type': 'DAILY'
      });
      expect(AutomationConfig.countDocuments).toHaveBeenCalledWith({
        userId: mockUserId,
        'schedule.type': 'WEEKLY'
      });
      expect(result).toEqual({ daily: 5, weekly: 3 });
    });
  });

  describe('findActive', () => {
    it('should find all active automation configs', async () => {
      const mockConfigs = [mockConfig];
      (AutomationConfig.find as Mock).mockResolvedValue(mockConfigs);

      const result = await repository.findActive();

      expect(AutomationConfig.find).toHaveBeenCalledWith({
        isEnabled: true,
        status: 'ACTIVE',
        environment: 'test'
      });
      expect(result).toEqual(mockConfigs);
    });
  });

  describe('getAutomationCount', () => {
    it('should get count of automation configs for a user', async () => {
      (AutomationConfig.countDocuments as Mock).mockResolvedValue(10);

      const result = await repository.getAutomationCount(mockUserId);

      expect(AutomationConfig.countDocuments).toHaveBeenCalledWith({ userId: mockUserId });
      expect(result).toBe(10);
    });
  });

  describe('findDueAutomations', () => {
    it('should find due automations for daily schedule', async () => {
      const now = new Date();
      const currentHour = now.getUTCHours();
      const currentMinute = now.getUTCMinutes();

      const activeConfig = {
        ...mockConfig,
        schedule: {
          type: 'DAILY',
          dailyTimes: [{ hour: currentHour, minute: currentMinute }]
        },
        processedTimeSlots: new Map()
      };

      (AutomationConfig.find as Mock).mockResolvedValue([activeConfig]);

      const result = await repository.findDueAutomations();

      expect(AutomationConfig.find).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should find due automations for weekly schedule', async () => {
      const now = new Date();
      const currentDay = now.getDay();
      const currentHour = now.getUTCHours();
      const currentMinute = now.getUTCMinutes();

      const activeConfig = {
        ...mockConfig,
        schedule: {
          type: 'WEEKLY',
          weeklyDays: [currentDay],
          weeklyTime: { hour: currentHour, minute: currentMinute }
        },
        processedTimeSlots: new Map()
      };

      (AutomationConfig.find as Mock).mockResolvedValue([activeConfig]);

      const result = await repository.findDueAutomations();

      expect(AutomationConfig.find).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array when no automations are due', async () => {
      const activeConfig = {
        ...mockConfig,
        schedule: {
          type: 'DAILY',
          dailyTimes: [{ hour: 23, minute: 59 }]
        },
        processedTimeSlots: new Map()
      };

      (AutomationConfig.find as Mock).mockResolvedValue([activeConfig]);

      const result = await repository.findDueAutomations();

      expect(result).toEqual([]);
    });
  });

  describe('markTimeSlotAsProcessedById', () => {
    it('should mark time slot as processed by ID', async () => {
      (AutomationConfig.findByIdAndUpdate as Mock).mockResolvedValue(mockConfig);

      await repository.markTimeSlotAsProcessedById(mockConfigId, 10, 0);

      expect(AutomationConfig.findByIdAndUpdate).toHaveBeenCalledWith(
        mockConfigId,
        expect.objectContaining({
          lastProcessed: expect.any(Date),
          'processedTimeSlots.10:00': expect.any(Date)
        })
      );
    });
  });

  describe('markTimeSlotAsProcessed', () => {
    it('should mark time slot as processed by channel ID', async () => {
      (AutomationConfig.findOneAndUpdate as Mock).mockResolvedValue(mockConfig);

      await repository.markTimeSlotAsProcessed(mockChannelId, 10, 0);

      expect(AutomationConfig.findOneAndUpdate).toHaveBeenCalledWith(
        { channelId: mockChannelId },
        expect.objectContaining({
          lastProcessed: expect.any(Date),
          'processedTimeSlots.10:00': expect.any(Date)
        })
      );
    });
  });

  describe('markAsProcessedById', () => {
    it('should mark automation as processed by ID', async () => {
      (AutomationConfig.findByIdAndUpdate as Mock).mockResolvedValue(mockConfig);

      await repository.markAsProcessedById(mockConfigId);

      expect(AutomationConfig.findByIdAndUpdate).toHaveBeenCalledWith(mockConfigId, {
        lastProcessed: expect.any(Date)
      });
    });
  });

  describe('markAsProcessed', () => {
    it('should mark automation as processed by channel ID', async () => {
      (AutomationConfig.findOneAndUpdate as Mock).mockResolvedValue(mockConfig);

      await repository.markAsProcessed(mockChannelId);

      expect(AutomationConfig.findOneAndUpdate).toHaveBeenCalledWith(
        { channelId: mockChannelId },
        { lastProcessed: expect.any(Date) }
      );
    });
  });

  describe('create', () => {
    it('should create a new automation config', async () => {
      (AutomationConfig.create as Mock).mockResolvedValue(mockConfig);

      const result = await repository.create(mockConfig);

      expect(AutomationConfig.create).toHaveBeenCalledWith(mockConfig);
      expect(result).toEqual(mockConfig);
    });
  });

  describe('updateById', () => {
    it('should update automation config by ID', async () => {
      const updateData = { isEnabled: false };
      const updatedConfig = { ...mockConfig, ...updateData };
      (AutomationConfig.findByIdAndUpdate as Mock).mockResolvedValue(updatedConfig);

      const result = await repository.updateById(mockConfigId, updateData);

      expect(AutomationConfig.findByIdAndUpdate).toHaveBeenCalledWith(
        mockConfigId,
        { $set: updateData },
        { new: true }
      );
      expect(result).toEqual(updatedConfig);
    });
  });

  describe('update', () => {
    it('should update automation config by channel ID', async () => {
      const updateData = { isEnabled: false };
      const updatedConfig = { ...mockConfig, ...updateData };
      (AutomationConfig.findOneAndUpdate as Mock).mockResolvedValue(updatedConfig);

      const result = await repository.update(mockChannelId, updateData);

      expect(AutomationConfig.findOneAndUpdate).toHaveBeenCalledWith(
        { channelId: mockChannelId },
        { $set: updateData },
        { new: true }
      );
      expect(result).toEqual(updatedConfig);
    });
  });

  describe('deleteById', () => {
    it('should delete automation config by ID', async () => {
      (AutomationConfig.findByIdAndDelete as Mock).mockResolvedValue(mockConfig);

      const result = await repository.deleteById(mockConfigId);

      expect(AutomationConfig.findByIdAndDelete).toHaveBeenCalledWith(mockConfigId);
      expect(result).toBe(true);
    });

    it('should return false when config not found', async () => {
      (AutomationConfig.findByIdAndDelete as Mock).mockResolvedValue(null);

      const result = await repository.deleteById('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete automation config by channel ID', async () => {
      (AutomationConfig.findOneAndDelete as Mock).mockResolvedValue(mockConfig);

      const result = await repository.delete(mockChannelId);

      expect(AutomationConfig.findOneAndDelete).toHaveBeenCalledWith({ channelId: mockChannelId });
      expect(result).toBe(true);
    });

    it('should return false when config not found', async () => {
      (AutomationConfig.findOneAndDelete as Mock).mockResolvedValue(null);

      const result = await repository.delete('non-existent-channel');

      expect(result).toBe(false);
    });
  });

  describe('getAllForAdmin', () => {
    it('should get all automations for admin with pagination', async () => {
      const mockConfigs = [mockConfig];
      const mockLimit = vi.fn().mockResolvedValue(mockConfigs);
      const mockSkip = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = vi.fn().mockReturnValue({ skip: mockSkip });
      (AutomationConfig.find as Mock).mockReturnValue({
        sort: mockSort,
        skip: mockSkip,
        limit: mockLimit
      });
      (AutomationConfig.countDocuments as Mock).mockResolvedValue(100);

      const result = await repository.getAllForAdmin(0, 50);

      expect(AutomationConfig.find).toHaveBeenCalled();
      expect(mockSort).toHaveBeenCalledWith({ lastProcessed: -1, createdAt: -1 });
      expect(mockSkip).toHaveBeenCalledWith(0);
      expect(mockLimit).toHaveBeenCalledWith(50);
      expect(result).toEqual({ automations: mockConfigs, total: 100 });
    });
  });
});
