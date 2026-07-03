import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportService } from '../export/export.service';
import exportRepository from '../../repositories/export.repository';
import { safelyDelete } from '../fs';
import { deleteFromS3, getKeyFromUrl } from '../storage/s3';
import { BadRequestError, NotFoundError } from '../../errors';

// Mock dependencies
vi.mock('../../repositories/export.repository');
vi.mock('../fs');
vi.mock('../storage/s3');
vi.mock('../logging', () => ({
  logger: {
    error: vi.fn()
  }
}));

describe('Export Service', () => {
  let exportService: ExportService;
  const userId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
    exportService = new ExportService();
  });

  describe('getById', () => {
    const exportId = 'export-123';

    it('should return export if found', async () => {
      const mockExport = {
        _id: exportId,
        videoDataId: { id: 'video-123' }
      };

      vi.mocked(exportRepository.findById).mockResolvedValue(mockExport as any);

      const result = await exportService.getById(exportId);

      expect(exportRepository.findById).toHaveBeenCalledWith(exportId, true);
      expect(result).toBe(mockExport);
    });

    it('should throw NotFoundError if export not found', async () => {
      vi.mocked(exportRepository.findById).mockResolvedValue(null);

      await expect(exportService.getById(exportId)).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if export found but no videoDataId', async () => {
      const mockExport = {
        _id: exportId,
        videoDataId: null
      };

      vi.mocked(exportRepository.findById).mockResolvedValue(mockExport as any);

      await expect(exportService.getById(exportId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('getAllForUser', () => {
    it('should return all exports for user', async () => {
      const mockExports = [
        { id: '1', userId },
        { id: '2', userId }
      ];

      vi.mocked(exportRepository.findByUserId).mockResolvedValue(mockExports as any);

      const result = await exportService.getAllForUser(userId);

      expect(exportRepository.findByUserId).toHaveBeenCalledWith(userId, undefined, undefined);
      expect(result).toBe(mockExports);
    });

    it('should pass videoDataId if provided', async () => {
      const videoId = 'video-123';
      const mockExports = [{ id: '1', userId, videoDataId: videoId }];

      vi.mocked(exportRepository.findByUserId).mockResolvedValue(mockExports as any);

      await exportService.getAllForUser(userId, videoId);

      expect(exportRepository.findByUserId).toHaveBeenCalledWith(userId, videoId, undefined);
    });

    it('should respect limit if provided', async () => {
      const limit = 5;
      vi.mocked(exportRepository.findByUserId).mockResolvedValue([] as any);

      await exportService.getAllForUser(userId, undefined, limit);

      expect(exportRepository.findByUserId).toHaveBeenCalledWith(userId, undefined, limit);
    });
  });

  describe('deleteById', () => {
    const exportId = 'export-123';

    it('should throw BadRequestError if no id provided', async () => {
      await expect(exportService.deleteById('', userId)).rejects.toThrow(BadRequestError);
    });

    it('should throw NotFoundError if export not found', async () => {
      vi.mocked(exportRepository.markAsDeleted).mockResolvedValue(null);

      await expect(exportService.deleteById(exportId, userId)).rejects.toThrow(NotFoundError);
    });

    it('should soft delete export and return success', async () => {
      const mockExport = {
        _id: exportId,
        videoUrl: undefined
      };

      vi.mocked(exportRepository.markAsDeleted).mockResolvedValue(mockExport as any);

      const result = await exportService.deleteById(exportId, userId);

      expect(exportRepository.markAsDeleted).toHaveBeenCalledWith(exportId, userId);
      expect(result).toEqual({ success: true });
    });

    it('should clean up video file if videoUrl exists', async () => {
      const mockExport = {
        _id: exportId,
        videoUrl: 'https://example.com/video.mp4'
      };

      vi.mocked(exportRepository.markAsDeleted).mockResolvedValue(mockExport as any);
      vi.mocked(getKeyFromUrl).mockReturnValue('video.mp4');
      vi.mocked(deleteFromS3).mockImplementation((name, callback) => {
        callback(null);
        return undefined as any;
      });

      await exportService.deleteById(exportId, userId);

      expect(getKeyFromUrl).toHaveBeenCalledWith('https://example.com/video.mp4');
      expect(safelyDelete).toHaveBeenCalledWith('/tmp/data/video.mp4');
      expect(deleteFromS3).toHaveBeenCalledWith('video.mp4', expect.any(Function));
    });

    it('should handle S3 deletion errors gracefully', async () => {
      const mockExport = {
        _id: exportId,
        videoUrl: 'https://example.com/video.mp4'
      };

      vi.mocked(exportRepository.markAsDeleted).mockResolvedValue(mockExport as any);
      vi.mocked(getKeyFromUrl).mockReturnValue('video.mp4');
      vi.mocked(deleteFromS3).mockImplementation((name, callback) => {
        callback(new Error('S3 Error'));
        return undefined as any;
      });

      const result = await exportService.deleteById(exportId, userId);

      expect(result).toEqual({ success: true });
    });

    it('should clean up thumbnail file if thumbnailUrl exists', async () => {
      const mockExport = {
        _id: exportId,
        videoUrl: undefined,
        thumbnailUrl: 'https://example.com/thumbnail.png'
      };

      vi.mocked(exportRepository.markAsDeleted).mockResolvedValue(mockExport as any);
      vi.mocked(getKeyFromUrl).mockReturnValue('thumbnail.png');
      vi.mocked(deleteFromS3).mockImplementation((name, callback) => {
        callback(null);
        return undefined as any;
      });

      await exportService.deleteById(exportId, userId);

      expect(getKeyFromUrl).toHaveBeenCalledWith('https://example.com/thumbnail.png');
      expect(deleteFromS3).toHaveBeenCalledWith('thumbnail.png', expect.any(Function));
    });

    it('should clean up both video and thumbnail if both exist', async () => {
      const mockExport = {
        _id: exportId,
        videoUrl: 'https://example.com/video.mp4',
        thumbnailUrl: 'https://example.com/thumbnail.png'
      };

      vi.mocked(exportRepository.markAsDeleted).mockResolvedValue(mockExport as any);
      vi.mocked(getKeyFromUrl).mockImplementation((url: string) => {
        if (url.includes('video')) return 'video.mp4';
        if (url.includes('thumbnail')) return 'thumbnail.png';
        return '';
      });
      vi.mocked(deleteFromS3).mockImplementation((name, callback) => {
        callback(null);
        return undefined as any;
      });

      await exportService.deleteById(exportId, userId);

      expect(getKeyFromUrl).toHaveBeenCalledWith('https://example.com/video.mp4');
      expect(getKeyFromUrl).toHaveBeenCalledWith('https://example.com/thumbnail.png');
      expect(deleteFromS3).toHaveBeenCalledWith('video.mp4', expect.any(Function));
      expect(deleteFromS3).toHaveBeenCalledWith('thumbnail.png', expect.any(Function));
    });
  });
});
