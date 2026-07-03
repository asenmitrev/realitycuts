import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processLibraryItemDeletionTask } from '../bullmq/library-item-deletion-processor';
import { BrollFootageMetadata } from '../../models/broll-video-metadata';
import { VideoAIData } from '../../models/video-ai-data';
import { softDeleteS3Uploads, getKeyFromUrl, deleteFromS3Promise } from '../../services/storage/s3';
import { logger } from '../../services/logging';

// Mock dependencies
vi.mock('../../models/broll-video-metadata', () => ({
  BrollFootageMetadata: {
    findById: vi.fn(),
  },
}));

vi.mock('../../models/video-ai-data', () => ({
  VideoAIData: {
    updateMany: vi.fn(),
  },
}));

vi.mock('../../services/storage/s3', () => ({
  softDeleteS3Uploads: vi.fn(),
  getKeyFromUrl: vi.fn(),
  deleteFromS3Promise: vi.fn(),
}));

vi.mock('../../services/logging', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('library-item-deletion-processor', () => {
  const mockBrollId = 'broll-123';
  const mockUserId = 'user-123';
  const mockLibraryId = 'library-456';
  const mockUrl = 'https://s3.amazonaws.com/bucket/video.mp4';
  const mockThumbnailUrl = 'https://s3.amazonaws.com/bucket/thumbnail.jpg';
  const mockThumbnailUrl2 = 'https://s3.amazonaws.com/bucket/thumbnail2.jpg';
  const mockS3KeyUrl = 'users/user-123/library/library-456/video.mp4';
  const mockS3KeyThumbnail = 'users/user-123/library/library-456/thumbnail.jpg';
  const mockS3KeyThumbnail2 = 'users/user-123/library/library-456/thumbnail2.jpg';

  let mockBroll: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockBroll = {
      _id: mockBrollId,
      url: mockUrl,
      thumbnailUrl: mockThumbnailUrl,
      thumbnailUrl2: undefined,
      libraryId: mockLibraryId,
      isDeleted: false,
      save: vi.fn().mockResolvedValue(undefined),
    };

    (getKeyFromUrl as unknown as vi.Mock).mockImplementation((url: string) => {
      if (url === mockUrl) return mockS3KeyUrl;
      if (url === mockThumbnailUrl) return mockS3KeyThumbnail;
      if (url === mockThumbnailUrl2) return mockS3KeyThumbnail2;
      return url.replace('https://s3.amazonaws.com/bucket/', '');
    });

    (softDeleteS3Uploads as vi.Mock).mockResolvedValue(undefined);
    (deleteFromS3Promise as vi.Mock).mockResolvedValue(undefined);
    (VideoAIData.updateMany as vi.Mock).mockResolvedValue({ modifiedCount: 1 });
  });

  describe('processLibraryItemDeletionTask', () => {
    it('should successfully delete a broll with all required fields', async () => {
      (BrollFootageMetadata.findById as vi.Mock).mockResolvedValue(mockBroll);

      await processLibraryItemDeletionTask({
        brollId: mockBrollId,
        userId: mockUserId,
        version: '1.0.0',
      });

      expect(BrollFootageMetadata.findById).toHaveBeenCalledWith(mockBrollId);
      expect(getKeyFromUrl).toHaveBeenCalledWith(mockUrl);
      expect(getKeyFromUrl).toHaveBeenCalledWith(mockThumbnailUrl);
      expect(softDeleteS3Uploads).toHaveBeenCalledWith(mockS3KeyUrl);
      expect(softDeleteS3Uploads).toHaveBeenCalledWith(mockS3KeyThumbnail);
      expect(deleteFromS3Promise).toHaveBeenCalledWith(mockS3KeyUrl);
      expect(deleteFromS3Promise).toHaveBeenCalledWith(mockS3KeyThumbnail);
      expect(VideoAIData.updateMany).toHaveBeenCalledWith(
        {
          'segments.alternatives.link': mockUrl,
        },
        {
          $pull: {
            'segments.$[].alternatives': {
              link: mockUrl,
            },
          },
        }
      );
      expect(mockBroll.isDeleted).toBe(true);
      expect(mockBroll.save).toHaveBeenCalled();
    });

    it('should handle broll with thumbnailUrl2', async () => {
      mockBroll.thumbnailUrl2 = mockThumbnailUrl2;
      (BrollFootageMetadata.findById as vi.Mock).mockResolvedValue(mockBroll);

      await processLibraryItemDeletionTask({
        brollId: mockBrollId,
        userId: mockUserId,
        version: '1.0.0',
      });

      expect(getKeyFromUrl).toHaveBeenCalledWith(mockThumbnailUrl2);
      expect(softDeleteS3Uploads).toHaveBeenCalledWith(mockS3KeyThumbnail2);
      expect(deleteFromS3Promise).toHaveBeenCalledWith(mockS3KeyThumbnail2);
    });

    it('should throw error when broll is not found', async () => {
      (BrollFootageMetadata.findById as vi.Mock).mockResolvedValue(null);

      await expect(
        processLibraryItemDeletionTask({
          brollId: mockBrollId,
          userId: mockUserId,
          version: '1.0.0',
        })
      ).rejects.toThrow('Broll not found');

      expect(softDeleteS3Uploads).not.toHaveBeenCalled();
      expect(deleteFromS3Promise).not.toHaveBeenCalled();
    });

    it('should throw error when libraryId is missing', async () => {
      mockBroll.libraryId = null;
      (BrollFootageMetadata.findById as vi.Mock).mockResolvedValue(mockBroll);

      await expect(
        processLibraryItemDeletionTask({
          brollId: mockBrollId,
          userId: mockUserId,
          version: '1.0.0',
        })
      ).rejects.toThrow('Library ID not found');
    });

    it('should throw error when libraryId is undefined', async () => {
      mockBroll.libraryId = undefined;
      (BrollFootageMetadata.findById as vi.Mock).mockResolvedValue(mockBroll);

      await expect(
        processLibraryItemDeletionTask({
          brollId: mockBrollId,
          userId: mockUserId,
          version: '1.0.0',
        })
      ).rejects.toThrow('Library ID not found');
    });

    it('should not process thumbnailUrl2 when it is undefined', async () => {
      mockBroll.thumbnailUrl2 = undefined;
      (BrollFootageMetadata.findById as vi.Mock).mockResolvedValue(mockBroll);

      await processLibraryItemDeletionTask({
        brollId: mockBrollId,
        userId: mockUserId,
        version: '1.0.0',
      });

      expect(getKeyFromUrl).not.toHaveBeenCalledWith(mockThumbnailUrl2);
      expect(softDeleteS3Uploads).not.toHaveBeenCalledWith(mockS3KeyThumbnail2);
      expect(deleteFromS3Promise).not.toHaveBeenCalledWith(mockS3KeyThumbnail2);
    });

    it('should call softDeleteS3Uploads before deleteFromS3Promise for each file', async () => {
      (BrollFootageMetadata.findById as vi.Mock).mockResolvedValue(mockBroll);

      const callOrder: Array<{ type: 'softDelete' | 'delete'; key: string }> = [];

      (softDeleteS3Uploads as vi.Mock).mockImplementation((key: string) => {
        callOrder.push({ type: 'softDelete', key });
        return Promise.resolve(undefined);
      });

      (deleteFromS3Promise as vi.Mock).mockImplementation((key: string) => {
        callOrder.push({ type: 'delete', key });
        return Promise.resolve(undefined);
      });

      await processLibraryItemDeletionTask({
        brollId: mockBrollId,
        userId: mockUserId,
        version: '1.0.0',
      });

      const urlSoftDeletePos = callOrder.findIndex(
        (call) => call.type === 'softDelete' && call.key === mockS3KeyUrl
      );
      const urlDeletePos = callOrder.findIndex(
        (call) => call.type === 'delete' && call.key === mockS3KeyUrl
      );

      expect(urlSoftDeletePos).toBeGreaterThanOrEqual(0);
      expect(urlDeletePos).toBeGreaterThanOrEqual(0);
      expect(urlSoftDeletePos).toBeLessThan(urlDeletePos);

      const thumbnailSoftDeletePos = callOrder.findIndex(
        (call) => call.type === 'softDelete' && call.key === mockS3KeyThumbnail
      );
      const thumbnailDeletePos = callOrder.findIndex(
        (call) => call.type === 'delete' && call.key === mockS3KeyThumbnail
      );

      expect(thumbnailSoftDeletePos).toBeGreaterThanOrEqual(0);
      expect(thumbnailDeletePos).toBeGreaterThanOrEqual(0);
      expect(thumbnailSoftDeletePos).toBeLessThan(thumbnailDeletePos);
    });

    it('should log start and completion messages', async () => {
      (BrollFootageMetadata.findById as vi.Mock).mockResolvedValue(mockBroll);

      await processLibraryItemDeletionTask({
        brollId: mockBrollId,
        userId: mockUserId,
        version: '1.0.0',
      });

      expect(logger.info).toHaveBeenCalledWith('Starting library item deletion', {
        brollId: mockBrollId,
        userId: mockUserId,
      });
      expect(logger.info).toHaveBeenCalledWith('Library item deletion completed', {
        brollId: mockBrollId,
        userId: mockUserId,
      });
    });

    it('should handle errors from S3 operations', async () => {
      const error = new Error('S3 delete failed');
      (BrollFootageMetadata.findById as vi.Mock).mockResolvedValue(mockBroll);
      (softDeleteS3Uploads as vi.Mock).mockRejectedValue(error);

      await expect(
        processLibraryItemDeletionTask({
          brollId: mockBrollId,
          userId: mockUserId,
          version: '1.0.0',
        })
      ).rejects.toThrow('S3 delete failed');
    });

    it('should handle errors from VideoAIData.updateMany', async () => {
      const error = new Error('VideoAIData update failed');
      (BrollFootageMetadata.findById as vi.Mock).mockResolvedValue(mockBroll);
      (VideoAIData.updateMany as vi.Mock).mockRejectedValue(error);

      await expect(
        processLibraryItemDeletionTask({
          brollId: mockBrollId,
          userId: mockUserId,
          version: '1.0.0',
        })
      ).rejects.toThrow('VideoAIData update failed');
    });

    it('should handle errors from broll.save', async () => {
      const error = new Error('Save failed');
      (BrollFootageMetadata.findById as vi.Mock).mockResolvedValue(mockBroll);
      mockBroll.save = vi.fn().mockRejectedValue(error);

      await expect(
        processLibraryItemDeletionTask({
          brollId: mockBrollId,
          userId: mockUserId,
          version: '1.0.0',
        })
      ).rejects.toThrow('Save failed');
    });
  });
});
