import { Notification } from '../models/notification';
import { INotification } from '../types';
import { Document } from 'mongoose';

export class NotificationRepository {
  async findByUserId(userId: string, limit: number = 10): Promise<INotification[]> {
    return Notification.find({ userId }).sort({ isRead: 1, createdAt: -1 }).limit(limit);
  }

  async countUnreadByUserId(userId: string): Promise<number> {
    return Notification.countDocuments({ userId, isRead: { $ne: true } });
  }

  async markAsRead(notification: INotification & Document): Promise<void> {
    notification.isRead = true;
    await notification.save();
  }

  async updateReadStatusById(id: string, isRead: boolean = true): Promise<void> {
    await Notification.updateOne({ _id: id }, { $set: { isRead } });
  }

  async create(notificationData: Omit<INotification, '_id' | 'isRead'>): Promise<INotification> {
    const notification = new Notification(notificationData);
    return notification.save();
  }

  async markAllAsRead(userId: string): Promise<void> {
    await Notification.updateMany({ userId, isRead: { $ne: true } }, { $set: { isRead: true } });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await Notification.deleteMany({ userId });
  }
}

export default new NotificationRepository();
