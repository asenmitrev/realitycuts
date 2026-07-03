import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Response, Request } from 'express';
import { AuthenticatedRequest } from '../../types';
import exportsController from '../exports.controller';
import exportService from '../../services/export/export.service';
import { NotFoundError } from '../../errors';

// Mock dependencies
vi.mock('../../services/export/export.service');

describe('Exports Controller', () => {
  let mockRequest: Partial<Request>;
  let mockAuthRequest: Partial<Omit<AuthenticatedRequest, 'user'>> & { user: Partial<AuthenticatedRequest['user']> };
  let mockResponse: Partial<Response>;
  const userId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      params: {},
      query: {}
    };

    mockAuthRequest = {
      user: { user_id: userId },
      params: {},
      query: {}
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
  });

  describe('getById', () => {
    const exportId = 'export-123';

    beforeEach(() => {
      mockRequest.params = { id: exportId };
    });

    it('should return export data if found', async () => {
      const mockExport = {
        _id: exportId,
        videoDataId: { id: 'video-123' }
      };

      vi.mocked(exportService.getById).mockResolvedValue(mockExport as any);

      await exportsController.getById(mockRequest as Request, mockResponse as Response);

      expect(exportService.getById).toHaveBeenCalledWith(exportId);
      expect(mockResponse.json).toHaveBeenCalledWith(mockExport);
    });

    it('should propagate NotFoundError if export not found', async () => {
      vi.mocked(exportService.getById).mockRejectedValue(new NotFoundError('Export not found'));

      await expect(exportsController.getById(mockRequest as Request, mockResponse as Response)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('getAllForUser', () => {
    it('should return all exports for user', async () => {
      const mockExports = [
        { id: '1', userId },
        { id: '2', userId }
      ];

      vi.mocked(exportService.getAllForUser).mockResolvedValue(mockExports as any);

      await exportsController.getAllForUser(mockAuthRequest as AuthenticatedRequest, mockResponse as Response);

      expect(exportService.getAllForUser).toHaveBeenCalledWith(userId, undefined, 1000);
      expect(mockResponse.json).toHaveBeenCalledWith(mockExports);
    });

    it('should filter by videoDataId if provided', async () => {
      const videoId = 'video-123';
      mockAuthRequest.query = { id: videoId };

      vi.mocked(exportService.getAllForUser).mockResolvedValue([]);

      await exportsController.getAllForUser(mockAuthRequest as AuthenticatedRequest, mockResponse as Response);

      expect(exportService.getAllForUser).toHaveBeenCalledWith(userId, videoId, 1000);
    });

    it('should respect custom limit if provided', async () => {
      mockAuthRequest.query = { limit: '5' };

      vi.mocked(exportService.getAllForUser).mockResolvedValue([]);

      await exportsController.getAllForUser(mockAuthRequest as AuthenticatedRequest, mockResponse as Response);

      expect(exportService.getAllForUser).toHaveBeenCalledWith(userId, undefined, 5);
    });
  });

  describe('deleteById', () => {
    const exportId = 'export-123';

    beforeEach(() => {
      mockAuthRequest.params = { id: exportId };
    });

    it('should delete export and return success', async () => {
      vi.mocked(exportService.deleteById).mockResolvedValue({ success: true });

      await exportsController.deleteById(mockAuthRequest as AuthenticatedRequest, mockResponse as Response);

      expect(exportService.deleteById).toHaveBeenCalledWith(exportId, userId);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
    });

    it('should propagate errors from service', async () => {
      const error = new NotFoundError('Export not found');
      vi.mocked(exportService.deleteById).mockRejectedValue(error);

      await expect(
        exportsController.deleteById(mockAuthRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow(error);
    });
  });
});
