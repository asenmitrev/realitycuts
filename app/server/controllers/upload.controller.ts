import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { BadRequestError } from '../errors';
import uploadService from '../services/upload.service';
import { logger } from '../services/logging';

export default {
  /**
   * Generate presigned URL for direct S3 upload
   */
  generatePresignedUploadUrl: async (req: AuthenticatedRequest, res: Response) => {
    const { filename, contentType, size, duration } = req.body;

    if (!filename || !contentType || !size) {
      throw new BadRequestError('filename, contentType, and size are required');
    }

    const result = await uploadService.generatePresignedUploadUrl(req.user!.user_id, {
      filename,
      contentType,
      size: parseInt(size),
      duration: duration ? parseFloat(duration) : undefined
    });

    res.json(result);
  },

  /**
   * Confirm successful upload
   */
  confirmUpload: async (req: AuthenticatedRequest, res: Response) => {
    const uploadId = req.params.uploadId;

    if (!uploadId) {
      throw new BadRequestError('uploadId is required');
    }

    const result = await uploadService.confirmUpload(uploadId, req.user!.user_id);

    res.json(result);
  },

  /**
   * Get upload details
   */
  getUpload: async (req: AuthenticatedRequest, res: Response) => {
    const uploadId = req.params.uploadId;

    if (!uploadId) {
      throw new BadRequestError('uploadId is required');
    }

    const upload = await uploadService.getUpload(uploadId, req.user!.user_id);

    res.json(upload);
  },

  /**
   * Delete an upload
   */
  deleteUpload: async (req: AuthenticatedRequest, res: Response) => {
    const uploadId = req.params.uploadId;

    if (!uploadId) {
      throw new BadRequestError('uploadId is required');
    }

    await uploadService.deleteUpload(uploadId, req.user!.user_id);

    res.json({ message: 'Upload deleted successfully' });
  },

  /**
   * Clean up expired database records (admin endpoint)
   * Note: S3 files auto-expire, this only cleans database records
   */
  cleanupExpiredDatabaseRecords: async (req: AuthenticatedRequest, res: Response) => {
    logger.info('Manual cleanup of expired upload database records triggered', {
      'User ID': req.user!.user_id
    });

    const result = await uploadService.cleanupExpiredDatabaseRecords();

    res.json(result);
  },

  /**
   * Get upload statistics (admin endpoint)
   */
  getUploadStats: async (req: AuthenticatedRequest, res: Response) => {
    const stats = await uploadService.getUploadStats();

    res.json(stats);
  }
};
