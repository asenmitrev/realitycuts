import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Response } from 'express';
import { AuthenticatedRequest } from '../../types';
import notificationsController from '../notifications.controller';
import notificationService from '../../services/notification.service';

// Mock dependencies
vi.mock('../../services/notification.service');
vi.mock('../../services/logging');

describe('Notifications Controller', () => {
  let mockRequest: Partial<Omit<AuthenticatedRequest, 'user'>> & { user: Partial<AuthenticatedRequest['user']> };
  let mockResponse: Partial<Response>;
  const userId = 'test-user-id';

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Setup request mock
    mockRequest = {
      user: { user_id: userId }
    };

    // Setup response mock
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
  });

  describe('getAll', () => {
    it('should return notifications and mark them as read', async () => {
      const mockNotifications = [
        {
          _id: 'notification-1',
          isRead: false,
          userId: userId,
          createdAt: new Date()
        },
        {
          _id: 'notification-2',
          isRead: false,
          userId: userId,
          createdAt: new Date()
        }
      ];

      // Mock service methods
      (notificationService.getUserNotifications as Mock).mockResolvedValue(mockNotifications);
      (notificationService.markNotificationsAsRead as Mock).mockResolvedValue(undefined);

      await notificationsController.getAll(mockRequest as AuthenticatedRequest, mockResponse as Response);

      // Verify the response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockNotifications);

      // Verify service methods were called
      expect(notificationService.getUserNotifications).toHaveBeenCalledWith(userId);
      expect(notificationService.markNotificationsAsRead).toHaveBeenCalledWith(mockNotifications);
    });

    it('should handle errors appropriately', async () => {
      const error = new Error('Service error');
      (notificationService.getUserNotifications as Mock).mockRejectedValue(error);

      await expect(
        notificationsController.getAll(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow(error);
    });
  });

  describe('getCount', () => {
    it('should return the count of unread notifications', async () => {
      const mockCount = 5;
      (notificationService.getUnreadCount as Mock).mockResolvedValue(mockCount);

      await notificationsController.getCount(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(notificationService.getUnreadCount).toHaveBeenCalledWith(userId);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ count: mockCount });
    });

    it('should handle errors appropriately', async () => {
      const error = new Error('Service error');
      (notificationService.getUnreadCount as Mock).mockRejectedValue(error);

      await expect(
        notificationsController.getCount(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow(error);
    });
  });
});
