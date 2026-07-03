import { ExportJob } from '../models/export-job';
import { IExportJob, IVideoAIData } from '../types';

export class ExportRepository {
  /**
   * Find export by ID
   */
  async findById<T extends boolean>(
    id: string,
    populateTranscriptionJob: T = true as T
  ): Promise<
    T extends true ? (Omit<IExportJob, 'videoDataId'> & { videoDataId: IVideoAIData }) | null : IExportJob | null
  > {
    const query = ExportJob.findById(id);
    if (populateTranscriptionJob === true) {
      query.populate<{
        videoDataId: IVideoAIData;
      }>('videoDataId');
    }
    return (await query.exec()) as T extends true
      ? (Omit<IExportJob, 'videoDataId'> & { videoDataId: IVideoAIData }) | null
      : IExportJob | null;
  }
  /**
   * Find all exports for a user with optional filtering
   */
  async findByUserId(userId: string, videoDataId?: string, limit: number = 1000): Promise<IExportJob[]> {
    const query: { userId: string; isDeleted: object; videoDataId?: string } = {
      userId,
      isDeleted: { $ne: true }
    };

    if (videoDataId) {
      query.videoDataId = videoDataId;
    }

    return await ExportJob.find(query).sort({ updatedAt: -1 }).limit(limit).populate('videoDataId');
  }

  /**
   * Get export statistics by user (includes deleted exports for accurate analytics)
   */
  async getExportStatsByUser(days: number = 25): Promise<Array<{ _id: string; count: number }>> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return await ExportJob.aggregate([
      {
        $match: {
          createdAt: {
            $gte: cutoffDate
          }
        }
      },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
  }

  /**
   * Create a new export job
   */
  async create(jobData: Partial<IExportJob>): Promise<IExportJob> {
    const job = new ExportJob(jobData);
    await job.save();
    return job;
  }

  /**
   * Mark export as deleted
   */
  async markAsDeleted(id: string, userId: string): Promise<IExportJob | null> {
    return await ExportJob.findByIdAndUpdate({ _id: id, userId }, { $set: { isDeleted: true } }, { new: true });
  }

  /**
   * Get count of completed exports for a user
   */
  async getCompletedExportCount(userId: string): Promise<number> {
    return await ExportJob.countDocuments({
      userId,
      isDeleted: { $ne: true },
      status: 'COMPLETED'
    });
  }

  /**
   * Find exports older than a specified number of days (not already deleted)
   */
  async findExportsOlderThan(days: number, limit: number = 100): Promise<IExportJob[]> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return await ExportJob.find({
      createdAt: { $lt: cutoffDate },
      isDeleted: { $ne: true }
    })
      .sort({ createdAt: 1 })
      .limit(limit);
  }
}

export default new ExportRepository();
