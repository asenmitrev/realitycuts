import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Response } from 'express';
import { AuthenticatedRequest } from '../../types';
import brandAssetsController from '../brand-assets.controller';
import { BrandAsset } from '../../models/brand-asset';
import { S3Upload } from '../../models/s3-upload';
import uploadService from '../../services/upload.service';
import { BadRequestError, NotFoundError } from '../../errors';

// Mock dependencies
vi.mock('../../models/brand-asset', () => ({
  BrandAsset: {
    create: vi.fn(),
    find: vi.fn(),
    findById: vi.fn()
  }
}));

vi.mock('../../models/s3-upload', () => ({
  S3Upload: {
    findById: vi.fn()
  }
}));

vi.mock('../../services/upload.service', () => ({
  default: {
    deleteUpload: vi.fn()
  }
}));

describe('BrandAssetsController', () => {
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

  describe('create', () => {
    it('should throw BadRequestError if uploadId is missing', async () => {
      mockRequest.body = {};

      await expect(
        brandAssetsController.create(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw NotFoundError if upload not found', async () => {
      mockRequest.body = { uploadId: 'upload-1' };
      (S3Upload.findById as any).mockResolvedValue(null);

      await expect(
        brandAssetsController.create(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if upload belongs to different user', async () => {
      mockRequest.body = { uploadId: 'upload-1' };
      (S3Upload.findById as any).mockResolvedValue({
        _id: 'upload-1',
        userId: 'other-user-id',
        originalName: 'test.jpg',
        mimeType: 'image/jpeg'
      });

      await expect(
        brandAssetsController.create(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow(NotFoundError);
    });

    it('should create brand asset with image type', async () => {
      mockRequest.body = { uploadId: 'upload-1', name: 'My Asset' };
      const mockUpload = {
        _id: 'upload-1',
        userId: 'test-user-id',
        originalName: 'test.jpg',
        mimeType: 'image/jpeg'
      };
      const mockAsset = {
        _id: 'asset-1',
        userId: 'test-user-id',
        s3UploadId: 'upload-1',
        name: 'My Asset',
        assetType: 'image'
      };

      (S3Upload.findById as any).mockResolvedValue(mockUpload);
      (BrandAsset.create as any).mockResolvedValue(mockAsset);

      await brandAssetsController.create(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(BrandAsset.create).toHaveBeenCalledWith({
        userId: 'test-user-id',
        s3UploadId: 'upload-1',
        name: 'My Asset',
        assetType: 'image'
      });
      expect(mockResponse.json).toHaveBeenCalledWith(mockAsset);
    });

    it('should create brand asset with video type', async () => {
      mockRequest.body = { uploadId: 'upload-1' };
      const mockUpload = {
        _id: 'upload-1',
        userId: 'test-user-id',
        originalName: 'test.mp4',
        mimeType: 'video/mp4'
      };
      const mockAsset = {
        _id: 'asset-1',
        userId: 'test-user-id',
        s3UploadId: 'upload-1',
        name: 'test.mp4',
        assetType: 'video'
      };

      (S3Upload.findById as any).mockResolvedValue(mockUpload);
      (BrandAsset.create as any).mockResolvedValue(mockAsset);

      await brandAssetsController.create(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(BrandAsset.create).toHaveBeenCalledWith({
        userId: 'test-user-id',
        s3UploadId: 'upload-1',
        name: 'test.mp4',
        assetType: 'video'
      });
      expect(mockResponse.json).toHaveBeenCalledWith(mockAsset);
    });

    it('should create brand asset with audio type', async () => {
      mockRequest.body = { uploadId: 'upload-1' };
      const mockUpload = {
        _id: 'upload-1',
        userId: 'test-user-id',
        originalName: 'test.mp3',
        mimeType: 'audio/mpeg'
      };
      const mockAsset = {
        _id: 'asset-1',
        userId: 'test-user-id',
        s3UploadId: 'upload-1',
        name: 'test.mp3',
        assetType: 'audio'
      };

      (S3Upload.findById as any).mockResolvedValue(mockUpload);
      (BrandAsset.create as any).mockResolvedValue(mockAsset);

      await brandAssetsController.create(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(BrandAsset.create).toHaveBeenCalledWith({
        userId: 'test-user-id',
        s3UploadId: 'upload-1',
        name: 'test.mp3',
        assetType: 'audio'
      });
      expect(mockResponse.json).toHaveBeenCalledWith(mockAsset);
    });
  });

  describe('list', () => {
    it('should return list of brand assets', async () => {
      const mockAssets = [
        { _id: 'asset-1', userId: 'test-user-id', name: 'Asset 1' },
        { _id: 'asset-2', userId: 'test-user-id', name: 'Asset 2' }
      ];

      (BrandAsset.find as any).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockAssets)
        })
      });

      await brandAssetsController.list(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({ assets: mockAssets });
    });
  });

  describe('remove', () => {
    it('should throw NotFoundError if asset not found', async () => {
      mockRequest.params = { id: 'asset-1' };
      (BrandAsset.findById as any).mockResolvedValue(null);

      await expect(
        brandAssetsController.remove(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if asset belongs to different user', async () => {
      mockRequest.params = { id: 'asset-1' };
      (BrandAsset.findById as any).mockResolvedValue({
        _id: 'asset-1',
        userId: 'other-user-id',
        s3UploadId: 'upload-1'
      });

      await expect(
        brandAssetsController.remove(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow(NotFoundError);
    });

    it('should delete asset and underlying upload', async () => {
      mockRequest.params = { id: 'asset-1' };
      const mockAsset = {
        _id: 'asset-1',
        userId: 'test-user-id',
        s3UploadId: 'upload-1',
        deleteOne: vi.fn().mockResolvedValue(undefined)
      };

      (BrandAsset.findById as any).mockResolvedValue(mockAsset);
      (uploadService.deleteUpload as any).mockResolvedValue(undefined);

      await brandAssetsController.remove(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(uploadService.deleteUpload).toHaveBeenCalledWith('upload-1', 'test-user-id');
      expect(mockAsset.deleteOne).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
    });

    it('should delete asset even if upload deletion fails', async () => {
      mockRequest.params = { id: 'asset-1' };
      const mockAsset = {
        _id: 'asset-1',
        userId: 'test-user-id',
        s3UploadId: 'upload-1',
        deleteOne: vi.fn().mockResolvedValue(undefined)
      };

      (BrandAsset.findById as any).mockResolvedValue(mockAsset);
      (uploadService.deleteUpload as any).mockRejectedValue(new Error('Upload deletion failed'));

      await brandAssetsController.remove(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(uploadService.deleteUpload).toHaveBeenCalled();
      expect(mockAsset.deleteOne).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
    });
  });
});

