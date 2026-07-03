import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Notification } from '../../models/notification';
import { NotificationRepository } from '../notification.repository';
import { INotification } from '../../types';
import { Document } from 'mongoose';

// Mock Mongoose model
vi.mock('../../models/notification');

describe('NotificationRepository', () => {
  let repository: NotificationRepository;
  const userId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new NotificationRepository();
  });

  describe('findByUserId', () => {
    it('should find notifications by userId with correct sort and limit', async () => {
      const mockNotifications = [
        { _id: 'notification-1', userId, isRead: false },
        { _id: 'notification-2', userId, isRead: true }
      ];

      const mockSort = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(mockNotifications);

      (Notification.find as Mock).mockReturnValue({
        sort: mockSort,
        limit: mockLimit
      });

      const result = await repository.findByUserId(userId, 10);

      expect(Notification.find).toHaveBeenCalledWith({ userId });
      expect(mockSort).toHaveBeenCalledWith({ isRead: 1, createdAt: -1 });
      expect(mockLimit).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockNotifications);
    });
  });

  describe('countUnreadByUserId', () => {
    it('should count unread notifications for a user', async () => {
      const expectedCount = 5;
      (Notification.countDocuments as Mock).mockResolvedValue(expectedCount);

      const result = await repository.countUnreadByUserId(userId);

      expect(Notification.countDocuments).toHaveBeenCalledWith({
        userId,
        isRead: { $ne: true }
      });
      expect(result).toBe(expectedCount);
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      const notification = {
        _id: 'notification-id',
        isRead: false,
        save: vi.fn().mockResolvedValue(undefined)
      } as unknown as INotification & Document;

      await repository.markAsRead(notification);

      expect(notification.isRead).toBe(true);
      expect(notification.save).toHaveBeenCalled();
    });
  });

  describe('updateReadStatusById', () => {
    it('should update read status of a notification by ID', async () => {
      const notificationId = 'notification-id';
      (Notification.updateOne as Mock).mockResolvedValue({ acknowledged: true, modifiedCount: 1 });

      await repository.updateReadStatusById(notificationId, true);

      expect(Notification.updateOne).toHaveBeenCalledWith({ _id: notificationId }, { $set: { isRead: true } });
    });
  });

  describe('create', () => {
    it('should create a new notification', async () => {
      const notificationData: Omit<INotification, '_id'> = {
        userId,
        type: 'EXPORT_COMPLETE',
        title: 'Export Complete',
        message: 'Export job completed',
        isRead: false,
        links: []
      };

      const createdNotification = {
        ...notificationData,
        _id: 'new-notification-id',
        save: vi.fn().mockResolvedValue({ ...notificationData, _id: 'new-notification-id' })
      };

      (Notification as unknown as Mock).mockImplementation(() => createdNotification);

      const result = await repository.create(notificationData);

      expect(result).toEqual({ ...notificationData, _id: 'new-notification-id' });
      expect(createdNotification.save).toHaveBeenCalled();
    });
  });

  describe('deleteByUserId', () => {
    it('should delete all notifications for a user', async () => {
      (Notification.deleteMany as Mock).mockResolvedValue({ acknowledged: true, deletedCount: 5 });

      await repository.deleteByUserId(userId);

      expect(Notification.deleteMany).toHaveBeenCalledWith({ userId });
    });
  });
});
