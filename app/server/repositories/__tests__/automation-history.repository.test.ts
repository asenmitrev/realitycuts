import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { AutomationHistory } from '../../models/automation-history';
import { AutomationHistoryRepository } from '../automation-history.repository';
import { IAutomationHistory } from '../../types';

vi.mock('../../models/automation-history');

describe('AutomationHistoryRepository', () => {
  let repository: AutomationHistoryRepository;
  const mockHistoryId = 'history-123';
  const mockChannelId = 'channel-123';
  const mockUserId = 'user-123';
  const mockTjId = 'tj-123';

  const mockHistory: Partial<IAutomationHistory> = {
    _id: mockHistoryId,
    userId: mockUserId,
    channelId: mockChannelId,
    tjId: mockTjId,
    title: 'Test Video Title',
    theme: 'technology',
    status: 'GENERATED',
    createdAt: new Date()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new AutomationHistoryRepository();
  });

  describe('create', () => {
    it('should create a new automation history record', async () => {
      const mockSave = vi.fn().mockResolvedValue({
        ...mockHistory,
        toJSON: vi.fn().mockReturnValue(mockHistory)
      });
      const mockConstructor = vi.fn().mockImplementation(() => ({
        save: mockSave
      }));
      (AutomationHistory as any).mockImplementation(mockConstructor);

      const result = await repository.create(mockHistory);

      expect(mockConstructor).toHaveBeenCalledWith(mockHistory);
      expect(mockSave).toHaveBeenCalled();
      expect(result).toEqual(mockHistory);
    });
  });

  describe('findByChannel', () => {
    it('should find history records by channel ID', async () => {
      const mockHistories = [mockHistory];
      const mockLimit = vi.fn().mockResolvedValue(mockHistories);
      const mockSort = vi.fn().mockReturnValue({ limit: mockLimit });
      (AutomationHistory.find as Mock).mockReturnValue({
        sort: mockSort,
        limit: mockLimit
      });

      const result = await repository.findByChannel(mockChannelId, 10);

      expect(AutomationHistory.find).toHaveBeenCalledWith({ channelId: mockChannelId });
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockLimit).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockHistories.map(h => ({ ...h, toJSON: undefined })));
    });
  });

  describe('findByUserAndChannel', () => {
    it('should find history records by user ID and channel ID', async () => {
      const mockHistories = [mockHistory];
      const mockLimit = vi.fn().mockResolvedValue(mockHistories);
      const mockSort = vi.fn().mockReturnValue({ limit: mockLimit });
      (AutomationHistory.find as Mock).mockReturnValue({
        sort: mockSort,
        limit: mockLimit
      });

      const result = await repository.findByUserAndChannel(mockUserId, mockChannelId, 50);

      expect(AutomationHistory.find).toHaveBeenCalledWith({
        userId: mockUserId,
        channelId: mockChannelId
      });
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockLimit).toHaveBeenCalledWith(50);
      expect(result).toEqual(mockHistories.map(h => ({ ...h, toJSON: undefined })));
    });
  });

  describe('findByTjId', () => {
    it('should find history record by transcription job ID', async () => {
      const mockHistoryDoc = {
        ...mockHistory,
        toJSON: vi.fn().mockReturnValue(mockHistory)
      };
      (AutomationHistory.findOne as Mock).mockResolvedValue(mockHistoryDoc);

      const result = await repository.findByTjId(mockTjId);

      expect(AutomationHistory.findOne).toHaveBeenCalledWith({ tjId: mockTjId });
      expect(result).toEqual(mockHistory);
    });

    it('should return null when history not found', async () => {
      (AutomationHistory.findOne as Mock).mockResolvedValue(null);

      const result = await repository.findByTjId('non-existent-tj-id');

      expect(result).toBeNull();
    });
  });

  describe('getRecentTitlesForAvoidance', () => {
    it('should get recent titles for a channel', async () => {
      const mockHistories = [
        { ...mockHistory, title: 'Title 1' },
        { ...mockHistory, title: 'Title 2' }
      ];
      const mockLimit = vi.fn().mockResolvedValue(mockHistories);
      const mockSort = vi.fn().mockReturnValue({ limit: mockLimit });
      (AutomationHistory.find as Mock).mockReturnValue({
        sort: mockSort,
        limit: mockLimit
      });

      const result = await repository.getRecentTitlesForAvoidance(mockChannelId, 10);

      expect(result).toEqual(['Title 1', 'Title 2']);
    });
  });

  describe('cleanupOldHistory', () => {
    it('should cleanup old history records', async () => {
      const mockHistories = Array.from({ length: 100 }, (_, i) => ({
        ...mockHistory,
        _id: `history-${i}`,
        createdAt: new Date(Date.now() - i * 1000)
      }));
      const mockLimit = vi.fn().mockResolvedValue(mockHistories);
      const mockSort = vi.fn().mockReturnValue({ limit: mockLimit });
      (AutomationHistory.find as Mock).mockReturnValue({
        sort: mockSort,
        limit: mockLimit
      });
      (AutomationHistory.deleteMany as Mock).mockResolvedValue({ deletedCount: 50 });

      await repository.cleanupOldHistory(mockChannelId, 'technology', 50);

      expect(AutomationHistory.find).toHaveBeenCalledWith({
        channelId: mockChannelId,
        theme: 'technology'
      });
    });

    it('should not delete when history count is within keepCount', async () => {
      const mockHistories = Array.from({ length: 30 }, (_, i) => ({
        ...mockHistory,
        _id: `history-${i}`
      }));
      const mockLimit = vi.fn().mockResolvedValue(mockHistories);
      const mockSort = vi.fn().mockReturnValue({ limit: mockLimit });
      (AutomationHistory.find as Mock).mockReturnValue({
        sort: mockSort,
        limit: mockLimit
      });

      await repository.cleanupOldHistory(mockChannelId, 'technology', 50);

      expect(AutomationHistory.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('getChannelStats', () => {
    it('should get statistics for a channel', async () => {
      const mockCounts = [
        { _id: 'GENERATED', count: 10 },
        { _id: 'SCHEDULED', count: 5 },
        { _id: 'PROCESSED', count: 3 },
        { _id: 'FAILED', count: 1 }
      ];
      (AutomationHistory.aggregate as Mock).mockResolvedValue(mockCounts);
      (AutomationHistory.distinct as Mock).mockResolvedValue(['technology', 'science']);

      const result = await repository.getChannelStats(mockChannelId);

      expect(AutomationHistory.aggregate).toHaveBeenCalled();
      expect(AutomationHistory.distinct).toHaveBeenCalledWith('theme', { channelId: mockChannelId });
      expect(result).toEqual({
        totalGenerated: 10,
        totalScheduled: 5,
        totalProcessed: 3,
        totalFailed: 1,
        uniqueThemes: ['technology', 'science']
      });
    });

    it('should handle missing status counts', async () => {
      const mockCounts = [{ _id: 'GENERATED', count: 10 }];
      (AutomationHistory.aggregate as Mock).mockResolvedValue(mockCounts);
      (AutomationHistory.distinct as Mock).mockResolvedValue([]);

      const result = await repository.getChannelStats(mockChannelId);

      expect(result).toEqual({
        totalGenerated: 10,
        totalScheduled: 0,
        totalProcessed: 0,
        totalFailed: 0,
        uniqueThemes: []
      });
    });
  });
});

