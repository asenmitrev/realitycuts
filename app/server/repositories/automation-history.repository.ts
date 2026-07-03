import { AutomationHistory } from '../models/automation-history';
import { IAutomationHistory } from '../types';

export class AutomationHistoryRepository {
  /**
   * Create a new automation history record
   */
  async create(historyData: Partial<IAutomationHistory>): Promise<IAutomationHistory> {
    const newHistory = new AutomationHistory(historyData);
    const savedHistory = await newHistory.save();
    return this.toPlainObject(savedHistory);
  }

  /**
   * Find history records by channel ID and theme, sorted by most recent
   * Used to get recent topics to avoid repetition
   */
  async findByChannel(channelId: string, limit: number = 10): Promise<IAutomationHistory[]> {
    const histories = await AutomationHistory.find({
      channelId
    })
      .sort({ createdAt: -1 })
      .limit(limit);

    return histories.map(history => this.toPlainObject(history));
  }

  /**
   * Find history records by user ID and channel ID
   */
  async findByUserAndChannel(userId: string, channelId: string, limit: number = 50): Promise<IAutomationHistory[]> {
    const histories = await AutomationHistory.find({
      userId,
      channelId
    })
      .sort({ createdAt: -1 })
      .limit(limit);

    return histories.map(history => this.toPlainObject(history));
  }

  /**
   * Find history records by transcription job ID
   */
  async findByTjId(tjId: string): Promise<IAutomationHistory | null> {
    const history = await AutomationHistory.findOne({ tjId });
    return history ? this.toPlainObject(history) : null;
  }

  /**
   * Get recent titles for a channel and theme to avoid repetition
   * Returns array of titles from the last N records
   */
  async getRecentTitlesForAvoidance(channelId: string, limit: number = 10): Promise<string[]> {
    const recentHistories = await this.findByChannel(channelId, limit);
    return recentHistories.map(history => history.title);
  }

  /**
   * Delete old history records (cleanup method)
   * Keeps only the most recent N records per channel/theme combination
   */
  async cleanupOldHistory(channelId: string, theme: string, keepCount: number = 50): Promise<void> {
    const allHistories = await AutomationHistory.find({
      channelId,
      theme
    })
      .sort({ createdAt: -1 })
      .limit(keepCount + 100); // Get extra to find cutoff

    if (allHistories.length > keepCount) {
      const cutoffDate = allHistories[keepCount - 1].createdAt;
      await AutomationHistory.deleteMany({
        channelId,
        theme,
        createdAt: { $lt: cutoffDate }
      });
    }
  }

  /**
   * Get statistics for a channel
   */
  async getChannelStats(channelId: string): Promise<{
    totalGenerated: number;
    totalScheduled: number;
    totalProcessed: number;
    totalFailed: number;
    uniqueThemes: string[];
  }> {
    const [counts, themes] = await Promise.all([
      AutomationHistory.aggregate([
        { $match: { channelId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      AutomationHistory.distinct('theme', { channelId })
    ]);

    const statusCounts = counts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalGenerated: statusCounts.GENERATED || 0,
      totalScheduled: statusCounts.SCHEDULED || 0,
      totalProcessed: statusCounts.PROCESSED || 0,
      totalFailed: statusCounts.FAILED || 0,
      uniqueThemes: themes
    };
  }

  /**
   * Converts a Mongoose document to a plain JavaScript object
   */
  private toPlainObject(document: any): any {
    if (!document) return null;
    return document.toJSON ? document.toJSON() : document;
  }
}

export default new AutomationHistoryRepository();
