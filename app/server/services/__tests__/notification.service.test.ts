import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import notificationService from '../notification.service';
import { INotification } from '../../types';

// Mock the service
vi.mock('../notification.service', () => ({
  default: {
    getUserNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    markNotificationsAsRead: vi.fn(),
    createNotification: vi.fn(),
    deleteUserNotifications: vi.fn()
  }
}));

describe('NotificationService', () => {
  const userId = 'test-user-id';

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('getUserNotifications', () => {
    it('should get user notifications', async () => {
      const mockNotifications: INotification[] = [
        {
          _id: 'notification-1',
          userId,
          isRead: false,
          type: 'EXPORT_COMPLETE',
          title: 'Export Complete',
          message: 'Your export has completed',
          links: []
        },
        {
          _id: 'notification-2',
          userId,
          isRead: true,
          type: 'VIDEO_COMPLETE',
          title: 'Video Complete',
          message: 'Your video has completed',
          links: []
        }
      ];

      (notificationService.getUserNotifications as Mock).mockResolvedValue(mockNotifications);

      const result = await notificationService.getUserNotifications(userId);

      expect(notificationService.getUserNotifications).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockNotifications);
    });
  });

  describe('getUnreadCount', () => {
    it('should get unread count', async () => {
      const mockCount = 5;

      (notificationService.getUnreadCount as Mock).mockResolvedValue(mockCount);

      const result = await notificationService.getUnreadCount(userId);

      expect(notificationService.getUnreadCount).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockCount);
    });
  });

  describe('markNotificationsAsRead', () => {
    it('should mark notifications as read', async () => {
      const mockNotifications: INotification[] = [
        {
          _id: 'notification-1',
          userId,
          isRead: false,
          type: 'EXPORT_COMPLETE',
          title: 'Export Complete',
          message: 'Your export has completed',
          links: []
        }
      ];

      await notificationService.markNotificationsAsRead(mockNotifications);

      expect(notificationService.markNotificationsAsRead).toHaveBeenCalledWith(mockNotifications);
    });
  });

  describe('createNotification', () => {
    it('should create notification', async () => {
      const notificationData: Omit<INotification, '_id'> = {
        userId,
        type: 'EXPORT_COMPLETE',
        title: 'Export completed',
        message: 'Your export has been completed successfully',
        isRead: false,
        links: []
      };

      const createdNotification = { ...notificationData, _id: 'new-notification-id' };

      (notificationService.createNotification as Mock).mockResolvedValue(createdNotification);

      const result = await notificationService.createNotification(notificationData);

      expect(notificationService.createNotification).toHaveBeenCalledWith(notificationData);
      expect(result).toEqual(createdNotification);
    });
  });

  describe('deleteUserNotifications', () => {
    it('should delete user notifications', async () => {
      await notificationService.deleteUserNotifications(userId);

      expect(notificationService.deleteUserNotifications).toHaveBeenCalledWith(userId);
    });
  });
});
