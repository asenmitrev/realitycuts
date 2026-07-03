import { Response } from 'express';

import { AuthenticatedRequest } from '../types';
import notificationService from '../services/notification.service';

export default {
  getAll: async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    const notifications = await notificationService.getUserNotifications(userId);
    res.status(200).json(notifications);
    await notificationService.markNotificationsAsRead(notifications);
  },
  markAllAsRead: async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    await notificationService.markAllAsRead(userId);
    res.status(204).end();
  },
  getCount: async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    const count = await notificationService.getUnreadCount(userId);
    res.status(200).json({ count });
  }
};
