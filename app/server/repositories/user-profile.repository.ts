import { UserProfile } from '../models/user-profile';
import { IUserProfile, IUserProfileWithMethods } from '../types';

export class UserProfileRepository {
  async findByFirebaseId(firebaseId: string): Promise<IUserProfileWithMethods | null> {
    return await UserProfile.findOne({ firebaseId });
  }

  async findByFirebaseIdPlain(firebaseId: string): Promise<any | null> {
    const profile = await UserProfile.findOne({ firebaseId });
    return profile ? this.toPlainObject(profile) : null;
  }

  async create(profileData: Partial<IUserProfile>): Promise<any> {
    const newUserProfile = new UserProfile(profileData);
    const savedProfile = await newUserProfile.save();
    return this.toPlainObject(savedProfile);
  }

  async updateByFirebaseId(firebaseId: string, updateData: Partial<IUserProfile>): Promise<any> {
    const updatedProfile = await UserProfile.findOneAndUpdate({ firebaseId }, { $set: updateData }, { new: true });
    return updatedProfile ? this.toPlainObject(updatedProfile) : null;
  }

  async countDocuments(): Promise<number> {
    return UserProfile.countDocuments();
  }

  async getUserStorageUsage(firebaseId: string): Promise<number> {
    // In GB
    const uploads = await UserProfile.db
      .model('S3Upload')
      .aggregate([
        { $match: { userId: firebaseId, uploadStatus: { $ne: 'DELETED' } } },
        { $group: { _id: null, totalSize: { $sum: '$fileSize' } } }
      ]);

    return (uploads[0]?.totalSize ?? 0) / (1024 * 1024 * 1024);
  }

  async getGbRemaining(userId: string): Promise<number> {
    const userProfile = await UserProfile.findOne({ firebaseId: userId });
    return (await userProfile?.getStorageGbRemaining()) ?? 0;
  }

  async getLibraryMinutesRemaining(userId: string): Promise<number> {
    const userProfile = await UserProfile.findOne({ firebaseId: userId });
    return (await userProfile?.getLibraryMinutesRemaining()) ?? 0;
  }

  async getTTSMinutesRemaining(userId: string): Promise<number> {
    const userProfile = await UserProfile.findOne({ firebaseId: userId });
    return (await userProfile?.getTTSMinutesRemaining()) ?? 0;
  }

  /**
   * Get all user IDs that are excluded from analytics
   */
  async getExcludedFromAnalyticsUserIds(): Promise<string[]> {
    const excludedUsers = await UserProfile.find({ excludeFromAnalytics: true }).select('firebaseId');
    return excludedUsers.map(user => user.firebaseId);
  }

  /**
   * Reset user usage limits and update last reset date
   */
  async resetUserLimits(userId: string): Promise<void> {
    await UserProfile.updateOne({ _id: userId }, [
      {
        $set: {
          'usage.libraryMinutesSpent': {
            $cond: [{ $lt: ['$usage.libraryMinutesSpent', 0] }, '$usage.libraryMinutesSpent', 0]
          },
          'usage.ttsMinutesSpent': {
            $cond: [{ $lt: ['$usage.ttsMinutesSpent', 0] }, '$usage.ttsMinutesSpent', 0]
          },
          'usage.gbStorage': {
            $cond: [{ $lt: ['$usage.gbStorage', 0] }, '$usage.gbStorage', 0]
          },
          'usage.chatCreditsSpent': {
            $cond: [{ $lt: ['$usage.chatCreditsSpent', 0] }, '$usage.chatCreditsSpent', 0]
          },
          lastLimitReset: new Date()
        }
      }
    ]);
  }

  /**
   * Converts a Mongoose document to a plain JavaScript object
   */
  private toPlainObject(document: any): any {
    if (!document) return null;
    return document.toJSON ? document.toJSON() : document;
  }
}

export default new UserProfileRepository();
