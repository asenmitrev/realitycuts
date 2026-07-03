import { vi, describe, Mock, it, beforeEach, expect } from 'vitest';
import { S3Upload } from '../../models/s3-upload';
import { StorageService } from '../storage.service';

// Mock the S3Upload model
vi.mock('../../models/s3-upload', () => ({
  aggregate: vi.fn(),
  S3Upload: {
    aggregate: vi.fn()
  }
}));

describe('StorageService', () => {
  let service: StorageService;
  const mockUserId = 'user-123';

  beforeEach(() => {
    service = new StorageService();
    vi.clearAllMocks();
  });

  describe('getUserStorageUsed', () => {
    it('should return the storage used in GB', async () => {
      // Mock 2GB of storage in bytes (2 * 1024^3)
      const bytes = 2 * 1024 * 1024 * 1024;
      (S3Upload.aggregate as Mock).mockResolvedValue([{ totalSize: bytes }]);

      const result = await service.getUserStorageUsed(mockUserId);

      expect(result).toBe(2); // 2GB
      expect(S3Upload.aggregate).toHaveBeenCalledWith([
        { $match: { userId: mockUserId, uploadStatus: { $ne: 'DELETED' } } },
        { $group: { _id: null, totalSize: { $sum: '$fileSize' } } }
      ]);
    });

    it('should return 0 when the user has no uploads', async () => {
      (S3Upload.aggregate as Mock).mockResolvedValue([]);

      const result = await service.getUserStorageUsed(mockUserId);

      expect(result).toBe(0);
      expect(S3Upload.aggregate).toHaveBeenCalled();
    });

    it('should handle partial GB amounts correctly', async () => {
      // 1.5GB in bytes
      const bytes = 1.5 * 1024 * 1024 * 1024;
      (S3Upload.aggregate as Mock).mockResolvedValue([{ totalSize: bytes }]);

      const result = await service.getUserStorageUsed(mockUserId);

      expect(result).toBe(1.5);
    });
  });
});
