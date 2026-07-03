import { Document } from 'mongoose';
import { INotification } from '../types';
import { NotificationRepository } from '../repositories/notification.repository';

class NotificationService {
  private repository: NotificationRepository;

  constructor(repository: NotificationRepository = new NotificationRepository()) {
    this.repository = repository;
  }

  async getUserNotifications(userId: string): Promise<INotification[]> {
    return this.repository.findByUserId(userId);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.repository.countUnreadByUserId(userId);
  }

  async markNotificationsAsRead(notifications: INotification[]): Promise<void> {
    for (const notification of notifications) {
      if (!notification.isRead && notification._id) {
        await this.repository.updateReadStatusById(notification._id);
      }
    }
  }

  async createNotification(notificationData: Omit<INotification, '_id'>): Promise<INotification> {
    return this.repository.create(notificationData);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.repository.markAllAsRead(userId);
  }

  async deleteUserNotifications(userId: string): Promise<void> {
    await this.repository.deleteByUserId(userId);
  }
}

export default new NotificationService();
