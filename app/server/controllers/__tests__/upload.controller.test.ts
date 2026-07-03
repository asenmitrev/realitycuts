import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Response } from 'express';
import { AuthenticatedRequest } from '../../types';
import uploadController from '../upload.controller';
import uploadService from '../../services/upload.service';
import { BadRequestError } from '../../errors';

// Mock dependencies
vi.mock('../../services/upload.service', () => ({
  default: {
    generatePresignedUploadUrl: vi.fn(),
    confirmUpload: vi.fn(),
    getUpload: vi.fn(),
    deleteUpload: vi.fn(),
    cleanupExpiredDatabaseRecords: vi.fn(),
    getUploadStats: vi.fn()
  }
}));

vi.mock('../../services/logging', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

describe('UploadController', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = {
      user: { user_id: 'test-user-id' },
      params: {},
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

  describe('generatePresignedUploadUrl', () => {
    it('should throw BadRequestError if filename is missing', async () => {
      mockRequest.body = { contentType: 'video/mp4', size: 1000 };

      await expect(
        uploadController.generatePresignedUploadUrl(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError if contentType is missing', async () => {
      mockRequest.body = { filename: 'test.mp4', size: 1000 };

      await expect(
        uploadController.generatePresignedUploadUrl(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError if size is missing', async () => {
      mockRequest.body = { filename: 'test.mp4', contentType: 'video/mp4' };

      await expect(
        uploadController.generatePresignedUploadUrl(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow(BadRequestError);
    });

    it('should generate presigned upload URL', async () => {
      mockRequest.body = {
        filename: 'test.mp4',
        contentType: 'video/mp4',
        size: 1000,
        duration: 30.5
      };
      const mockResult = {
        uploadId: 'upload-1',
        presignedUrl: 'https://s3.amazonaws.com/presigned-url'
      };

      (uploadService.generatePresignedUploadUrl as any).mockResolvedValue(mockResult);

      await uploadController.generatePresignedUploadUrl(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(uploadService.generatePresignedUploadUrl).toHaveBeenCalledWith('test-user-id', {
        filename: 'test.mp4',
        contentType: 'video/mp4',
        size: 1000,
        duration: 30.5
      });
      expect(mockResponse.json).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('confirmUpload', () => {
    it('should throw BadRequestError if uploadId is missing', async () => {
      mockRequest.params = {};

      await expect(
        uploadController.confirmUpload(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow(BadRequestError);
    });

    it('should confirm upload', async () => {
      mockRequest.params = { uploadId: 'upload-1' };
      const mockResult = {
        uploadId: 'upload-1',
        status: 'completed'
      };

      (uploadService.confirmUpload as any).mockResolvedValue(mockResult);

      await uploadController.confirmUpload(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(uploadService.confirmUpload).toHaveBeenCalledWith('upload-1', 'test-user-id');
      expect(mockResponse.json).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('getUpload', () => {
    it('should throw BadRequestError if uploadId is missing', async () => {
      mockRequest.params = {};

      await expect(
        uploadController.getUpload(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow(BadRequestError);
    });

    it('should return upload details', async () => {
      mockRequest.params = { uploadId: 'upload-1' };
      const mockUpload = {
        uploadId: 'upload-1',
        filename: 'test.mp4',
        size: 1000
      };

      (uploadService.getUpload as any).mockResolvedValue(mockUpload);

      await uploadController.getUpload(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(uploadService.getUpload).toHaveBeenCalledWith('upload-1', 'test-user-id');
      expect(mockResponse.json).toHaveBeenCalledWith(mockUpload);
    });
  });

  describe('deleteUpload', () => {
    it('should throw BadRequestError if uploadId is missing', async () => {
      mockRequest.params = {};

      await expect(
        uploadController.deleteUpload(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow(BadRequestError);
    });

    it('should delete upload', async () => {
      mockRequest.params = { uploadId: 'upload-1' };
      (uploadService.deleteUpload as any).mockResolvedValue(undefined);

      await uploadController.deleteUpload(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(uploadService.deleteUpload).toHaveBeenCalledWith('upload-1', 'test-user-id');
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Upload deleted successfully' });
    });
  });

  describe('cleanupExpiredDatabaseRecords', () => {
    it('should cleanup expired database records', async () => {
      const mockResult = { deleted: 10 };
      (uploadService.cleanupExpiredDatabaseRecords as any).mockResolvedValue(mockResult);

      await uploadController.cleanupExpiredDatabaseRecords(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(uploadService.cleanupExpiredDatabaseRecords).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('getUploadStats', () => {
    it('should return upload statistics', async () => {
      const mockStats = {
        total: 100,
        completed: 90,
        pending: 10
      };
      (uploadService.getUploadStats as any).mockResolvedValue(mockStats);

      await uploadController.getUploadStats(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(uploadService.getUploadStats).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(mockStats);
    });
  });
});

