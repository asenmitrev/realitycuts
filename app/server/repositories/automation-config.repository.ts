import { ENVIRONMENT } from '../config/const';
import { AutomationConfig } from '../models/automation-config';
import { IAutomationConfig } from '../types';

// Add interface for due automation with specific time slots
export interface DueAutomation {
  config: IAutomationConfig;
  dueTimeSlots: Array<{ hour: number; minute: number }>;
}

export class AutomationConfigRepository {
  /**
   * Find automation config by ID
   */
  async findById(id: string): Promise<IAutomationConfig | null> {
    return await AutomationConfig.findById(id);
  }

  /**
   * Find automation config by channel ID
   */
  async findByChannelId(channelId: string): Promise<IAutomationConfig | null> {
    return await AutomationConfig.findOne({ channelId });
  }

  /**
   * Find all automation configs by channel ID (supports multiple per channel)
   */
  async findAllByChannelId(channelId: string): Promise<IAutomationConfig[]> {
    return await AutomationConfig.find({ channelId }).sort({ createdAt: -1 });
  }

  /**
   * Find automation config by user ID
   */
  async findByUserId(userId: string): Promise<IAutomationConfig[] | undefined> {
    return await AutomationConfig.find({ userId }).sort({ createdAt: -1 });
  }

  /**
   * Count automations by schedule type for a user
   */
  async countAutomationsByType(userId: string): Promise<{ daily: number; weekly: number }> {
    const [dailyCount, weeklyCount] = await Promise.all([
      AutomationConfig.countDocuments({ userId, 'schedule.type': 'DAILY' }),
      AutomationConfig.countDocuments({ userId, 'schedule.type': 'WEEKLY' })
    ]);

    return {
      daily: dailyCount,
      weekly: weeklyCount
    };
  }

  /**
   * Find all active automation configs
   */
  async findActive(): Promise<IAutomationConfig[]> {
    return await AutomationConfig.find({
      isEnabled: true,
      status: 'ACTIVE',
      environment: ENVIRONMENT || 'uat'
    });
  }

  /**
   * Get count of automation configs for a user
   */
  async getAutomationCount(userId: string): Promise<number> {
    return await AutomationConfig.countDocuments({ userId });
  }

  /**
   * Find automations that are due to run based on their schedule
   * Returns array of automations with their specific due time slots
   */
  async findDueAutomations(): Promise<DueAutomation[]> {
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday

    // Get all active automations
    const activeConfigs = await this.findActive();

    const dueAutomations: DueAutomation[] = [];

    for (const config of activeConfigs) {
      const dueTimeSlots: Array<{ hour: number; minute: number }> = [];

      // Check if this automation should run now
      if (config.schedule?.type === 'DAILY' && config.schedule.dailyTimes) {
        // Check ALL daily times that match current time (within 5 minute window)
        for (const timeSlot of config.schedule.dailyTimes) {
          if (
            timeSlot.hour !== undefined &&
            timeSlot.minute !== undefined &&
            this.isTimeInWindow(timeSlot.hour, timeSlot.minute, currentHour, currentMinute) &&
            !this.wasTimeSlotProcessedRecently(timeSlot.hour, timeSlot.minute, config.processedTimeSlots)
          ) {
            dueTimeSlots.push({ hour: timeSlot.hour, minute: timeSlot.minute });
          }
        }
      } else if (config.schedule?.type === 'WEEKLY' && config.schedule.weeklyDays && config.schedule.weeklyTime) {
        // Check if today is a scheduled day and time matches
        if (config.schedule.weeklyDays.includes(currentDay)) {
          if (
            this.isTimeInWindow(
              config.schedule.weeklyTime.hour,
              config.schedule.weeklyTime.minute,
              currentHour,
              currentMinute
            ) &&
            !this.wasTimeSlotProcessedRecently(
              config.schedule.weeklyTime.hour,
              config.schedule.weeklyTime.minute,
              config.processedTimeSlots
            )
          ) {
            dueTimeSlots.push({
              hour: config.schedule.weeklyTime.hour,
              minute: config.schedule.weeklyTime.minute
            });
          }
        }
      }

      // Add to due automations if any time slots are due
      if (dueTimeSlots.length > 0) {
        dueAutomations.push({
          config,
          dueTimeSlots
        });
      }
    }

    return dueAutomations;
  }

  /**
   * Mark specific time slot as processed for an automation by ID
   */
  async markTimeSlotAsProcessedById(id: string, hour: number, minute: number): Promise<void> {
    const timeSlotKey = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    await AutomationConfig.findByIdAndUpdate(id, {
      lastProcessed: new Date(),
      [`processedTimeSlots.${timeSlotKey}`]: new Date()
    });
  }

  /**
   * Mark specific time slot as processed for an automation
   */
  async markTimeSlotAsProcessed(channelId: string, hour: number, minute: number): Promise<void> {
    const timeSlotKey = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    await AutomationConfig.findOneAndUpdate(
      { channelId },
      {
        lastProcessed: new Date(),
        [`processedTimeSlots.${timeSlotKey}`]: new Date()
      }
    );
  }

  /**
   * Mark automation as processed by ID
   */
  async markAsProcessedById(id: string): Promise<void> {
    await AutomationConfig.findByIdAndUpdate(id, { lastProcessed: new Date() });
  }

  /**
   * Mark automation as processed (legacy method for backward compatibility)
   */
  async markAsProcessed(channelId: string): Promise<void> {
    await AutomationConfig.findOneAndUpdate({ channelId }, { lastProcessed: new Date() });
  }

  /**
   * Create a new automation config
   */
  async create(configData: any): Promise<any> {
    return await AutomationConfig.create(configData);
  }

  /**
   * Update automation config by ID
   */
  async updateById(id: string, updates: any): Promise<any> {
    return await AutomationConfig.findByIdAndUpdate(id, { $set: updates }, { new: true });
  }

  /**
   * Update automation config
   */
  async update(channelId: string, updates: any): Promise<any> {
    return await AutomationConfig.findOneAndUpdate({ channelId }, { $set: updates }, { new: true });
  }

  /**
   * Delete automation config by ID
   */
  async deleteById(id: string): Promise<boolean> {
    const result = await AutomationConfig.findByIdAndDelete(id);
    return !!result;
  }

  /**
   * Delete automation config
   */
  async delete(channelId: string): Promise<boolean> {
    const result = await AutomationConfig.findOneAndDelete({ channelId });
    return !!result;
  }

  /**
   * Get all automations for admin with pagination (sorted by lastProcessed desc)
   */
  async getAllForAdmin(skip: number, limit: number): Promise<{ automations: IAutomationConfig[]; total: number }> {
    const [automations, total] = await Promise.all([
      AutomationConfig.find().sort({ lastProcessed: -1, createdAt: -1 }).skip(skip).limit(limit),
      AutomationConfig.countDocuments()
    ]);

    return { automations, total };
  }

  /**
   * Helper: Check if a time is within 5 minute window of current time
   */
  private isTimeInWindow(
    targetHour: number,
    targetMinute: number,
    currentHour: number,
    currentMinute: number
  ): boolean {
    const targetTotalMinutes = targetHour * 60 + targetMinute;
    const currentTotalMinutes = currentHour * 60 + currentMinute;

    // Check if we're within 5 minutes of the target time
    const diff = currentTotalMinutes - targetTotalMinutes;
    return diff >= 0 && diff <= 5;
  }

  /**
   * Helper: Check if automation was processed recently (within last hour)
   */
  private wasProcessedRecently(lastProcessed?: Date): boolean {
    if (!lastProcessed) return false;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return lastProcessed > oneHourAgo;
  }

  /**
   * Helper: Check if a specific time slot was processed recently
   */
  private wasTimeSlotProcessedRecently(hour: number, minute: number, processedTimeSlots?: Map<string, Date>): boolean {
    if (!processedTimeSlots) return false;

    const timeSlotKey = `${hour?.toString().padStart(2, '0')}:${minute?.toString().padStart(2, '0')}`;
    const lastProcessedTime = processedTimeSlots?.get(timeSlotKey);

    if (!lastProcessedTime) return false;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return lastProcessedTime > oneHourAgo;
  }
}

export default new AutomationConfigRepository();
