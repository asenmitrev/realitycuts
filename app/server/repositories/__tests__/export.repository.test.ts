import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportRepository } from '../export.repository';
import { ExportJob } from '../../models/export-job';

// Mock dependencies
vi.mock('../../models/export-job');

describe('Export Repository', () => {
  let exportRepository: ExportRepository;
  const userId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
    exportRepository = new ExportRepository();
  });

  describe('findById', () => {
    const exportId = 'export-123';

    it('should find and populate export by id', async () => {
      const mockExport = { _id: exportId };
      const mockExec = vi.fn().mockResolvedValue(mockExport);
      const mockPopulate = vi.fn().mockReturnValue({ exec: mockExec });

      vi.mocked(ExportJob.findById).mockReturnValue({
        populate: mockPopulate,
        exec: mockExec
      } as any);

      const result = await exportRepository.findById(exportId);

      expect(ExportJob.findById).toHaveBeenCalledWith(exportId);
      expect(mockPopulate).toHaveBeenCalledWith('videoDataId');
      expect(mockExec).toHaveBeenCalled();
      expect(result).toBe(mockExport);
    });

    it('should return null if export not found', async () => {
      const mockExec = vi.fn().mockResolvedValue(null);
      vi.mocked(ExportJob.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({ exec: mockExec }),
        exec: mockExec
      } as any);

      const result = await exportRepository.findById(exportId);

      expect(mockExec).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find all exports for user with default limit', async () => {
      const mockExports = [{ id: '1' }, { id: '2' }];
      const mockSort = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockReturnThis();
      const mockPopulate = vi.fn().mockResolvedValue(mockExports);

      vi.mocked(ExportJob.find).mockReturnValue({
        sort: mockSort,
        limit: mockLimit,
        populate: mockPopulate
      } as any);

      const result = await exportRepository.findByUserId(userId);

      expect(ExportJob.find).toHaveBeenCalledWith({
        userId,
        isDeleted: { $ne: true }
      });
      expect(mockSort).toHaveBeenCalledWith({ updatedAt: -1 });
      expect(mockLimit).toHaveBeenCalledWith(1000);
      expect(mockPopulate).toHaveBeenCalledWith('videoDataId');
      expect(result).toBe(mockExports);
    });

    it('should filter by videoDataId if provided', async () => {
      const videoId = 'video-123';
      const mockSort = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockReturnThis();
      const mockPopulate = vi.fn().mockResolvedValue([]);

      vi.mocked(ExportJob.find).mockReturnValue({
        sort: mockSort,
        limit: mockLimit,
        populate: mockPopulate
      } as any);

      await exportRepository.findByUserId(userId, videoId);

      expect(ExportJob.find).toHaveBeenCalledWith({
        userId,
        isDeleted: { $ne: true },
        videoDataId: videoId
      });
    });

    it('should use custom limit if provided', async () => {
      const customLimit = 5;
      const mockSort = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockReturnThis();
      const mockPopulate = vi.fn().mockResolvedValue([]);

      vi.mocked(ExportJob.find).mockReturnValue({
        sort: mockSort,
        limit: mockLimit,
        populate: mockPopulate
      } as any);

      await exportRepository.findByUserId(userId, undefined, customLimit);

      expect(mockLimit).toHaveBeenCalledWith(customLimit);
    });
  });

  describe('markAsDeleted', () => {
    const exportId = 'export-123';

    it('should mark export as deleted', async () => {
      const mockExport = { _id: exportId, isDeleted: true };

      vi.mocked(ExportJob.findByIdAndUpdate).mockResolvedValue(mockExport as any);

      const result = await exportRepository.markAsDeleted(exportId, userId);

      expect(ExportJob.findByIdAndUpdate).toHaveBeenCalledWith(
        { _id: exportId, userId },
        { $set: { isDeleted: true } },
        { new: true }
      );
      expect(result).toBe(mockExport);
    });

    it('should return null if export not found', async () => {
      vi.mocked(ExportJob.findByIdAndUpdate).mockResolvedValue(null);

      const result = await exportRepository.markAsDeleted(exportId, userId);

      expect(result).toBeNull();
    });
  });
});
