import { EventMessageService } from '../services/event-message.service';
import { AuthenticatedRequest } from '../types';
import { Response } from 'express';

const eventMessageService = new EventMessageService();

export default {
  getMessages: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const eventType = req.query.eventType as 'DATA' | 'MESSAGE';
      const eventId = req.params.eventId;
      const messages = await eventMessageService.getMessagesByEventTypeAndId(req.user!.user_id, eventType, eventId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }
};
