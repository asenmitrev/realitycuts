import { S3Upload } from '../models/s3-upload';

export class StorageService {
  /**
   * Calculate the amount of storage used by a user in GB
   * @param userId The Firebase ID of the user
   * @returns The amount of storage used in GB
   */
  async getUserStorageUsed(userId: string): Promise<number> {
    // In GB
    const uploads = await S3Upload.aggregate([
      { $match: { userId, uploadStatus: { $ne: 'DELETED' } } },
      { $group: { _id: null, totalSize: { $sum: '$fileSize' } } }
    ]);

    return (uploads[0]?.totalSize ?? 0) / (1024 * 1024 * 1024);
  }
}
