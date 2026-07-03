import { IExportJob, IVideoAIData } from '../../types';
import exportRepository from '../../repositories/export.repository';
import { safelyDelete } from '../fs';
import { deleteFromS3, getKeyFromUrl } from '../storage/s3';
import { logger } from '../logging';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../../errors';
import { ENVIRONMENT } from '../../config/const';

export class ExportService {
  /**
   * Get export by ID
   */
  async getById(id: string): Promise<Omit<IExportJob, 'videoDataId'> & { videoDataId: IVideoAIData }> {
    const exportData = await exportRepository.findById(id, true);

    if (!exportData?.videoDataId) {
      throw new NotFoundError('Export not found');
    }

    return exportData;
  }

  /**
   * Get all exports for a user
   */
  async getAllForUser(userId: string, videoDataId?: string, limit?: number): Promise<IExportJob[]> {
    return await exportRepository.findByUserId(userId, videoDataId, limit);
  }

  /**
   * Get export statistics by user
   */
  async getExportStatsByUser(
    days: number = 25
  ): Promise<Array<{ _id: string; count: number }>> {
    return await exportRepository.getExportStatsByUser(days);
  }

  /**
   * Delete export by ID
   */
  async deleteById(id: string, userId: string): Promise<{ success: boolean }> {
    if (!id) {
      throw new BadRequestError('Export job id is mandatory.');
    }

    const result = await exportRepository.markAsDeleted(id, userId);

    if (!result) {
      throw new NotFoundError('Export not found.');
    }

    // Clean up related resources if present
    if (result.videoUrl) {
      const videoKey = getKeyFromUrl(result.videoUrl);
      const urlParts = result.videoUrl.split('/').reverse();
      const videoName = urlParts[0];
      const videoPath = `/tmp/data/${videoName}`;

      // Delete locally
      safelyDelete(videoPath);

      // Delete from S3
      deleteFromS3(videoKey, err => {
        if (err) {
          logger.error('Error deleting video from cloud', {
            Error: err,
            'User ID': userId
          });
        }
      });
    }

    // Delete thumbnail if present
    if (result.thumbnailUrl) {
      const thumbnailKey = getKeyFromUrl(result.thumbnailUrl);
      
      // Delete from S3
      deleteFromS3(thumbnailKey, err => {
        if (err) {
          logger.error('Error deleting thumbnail from cloud', {
            Error: err,
            'User ID': userId
          });
        }
      });
    }

    return { success: true };
  }

  /**
   * Delete exports older than a specified number of days (one by one)
   * ONLY ACCESSIBLE IN UAT ENVIRONMENT
   */
  async deleteExportsOlderThan(
    days: number = 30,
    limit: number = 100
  ): Promise<{ deleted: number; errors: number; exports: Array<{ id: string; success: boolean; error?: string }> }> {
    if (ENVIRONMENT !== 'uat') {
      throw new UnauthorizedError('This endpoint is only available in UAT environment');
    }

    const oldExports = await exportRepository.findExportsOlderThan(days, limit);
    const results: Array<{ id: string; success: boolean; error?: string }> = [];
    let deleted = 0;
    let errors = 0;

    for (const exportJob of oldExports) {
      try {
        await this.deleteExportInternal(exportJob);
        results.push({ id: exportJob._id.toString(), success: true });
        deleted++;
        logger.info('Deleted old export', { exportId: exportJob._id, createdAt: exportJob.createdAt });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ id: exportJob._id.toString(), success: false, error: errorMessage });
        errors++;
        logger.error('Failed to delete old export', { exportId: exportJob._id, error: errorMessage });
      }
    }

    return { deleted, errors, exports: results };
  }

  /**
   * Internal method to delete an export (handles cleanup)
   * Only marks as deleted if all S3 deletions succeed
   */
  private async deleteExportInternal(exportJob: IExportJob): Promise<void> {
    const errors: string[] = [];

    // Helper to delete from S3 and track errors
    const deleteS3Asset = async (url: string, assetType: string): Promise<void> => {
      const key = getKeyFromUrl(url);
      await new Promise<void>((resolve) => {
        deleteFromS3(key, err => {
          if (err) {
            logger.error(`Error deleting ${assetType} from cloud during cleanup`, {
              Error: err,
              exportId: exportJob._id
            });
            const errMessage = err instanceof Error ? err.message : String(err);
            errors.push(`${assetType}: ${errMessage}`);
          }
          resolve();
        });
      });
    };

    // Delete video from S3 if present
    if (exportJob.videoUrl) {
      const urlParts = exportJob.videoUrl.split('/').reverse();
      const videoName = urlParts[0];
      const videoPath = `/tmp/data/${videoName}`;
      safelyDelete(videoPath);
      await deleteS3Asset(exportJob.videoUrl, 'video');
    }

    // Delete TikTok video if present
    if (exportJob.tiktokVideoUrl) {
      await deleteS3Asset(exportJob.tiktokVideoUrl, 'tiktokVideo');
    }

    // Delete extra video if present
    if (exportJob.extraVideoUrl) {
      await deleteS3Asset(exportJob.extraVideoUrl, 'extraVideo');
    }

    // Delete thumbnail if present
    if (exportJob.thumbnailUrl) {
      await deleteS3Asset(exportJob.thumbnailUrl, 'thumbnail');
    }

    // Only mark as deleted if all S3 deletions succeeded
    if (errors.length > 0) {
      throw new Error(`Failed to delete S3 assets: ${errors.join(', ')}`);
    }

    await exportRepository.markAsDeleted(exportJob._id.toString(), exportJob.userId);
  }
}

export default new ExportService();
