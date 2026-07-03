import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Response, Request } from 'express';
import { AuthenticatedRequest, IEventMessage } from '../../types';
import eventsController from '../events.controller';
import { EventMessageService } from '../../services/event-message.service';

// Mock dependencies
vi.mock('../../services/event-message.service');

describe('Events Controller', () => {
  let mockRequest: Partial<Request>;
  let mockAuthRequest: Partial<Omit<AuthenticatedRequest, 'user'>> & { user: Partial<AuthenticatedRequest['user']> };
  let mockResponse: Partial<Response>;
  const userId = 'test-user-id';
  const eventId = 'event-123';

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      params: { eventId },
      query: {}
    };

    mockAuthRequest = {
      user: { user_id: userId },
      params: { eventId },
      query: {}
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    // Reset mocks on the prototype to avoid issues with constructor mocking
    vi.mocked(EventMessageService.prototype.getMessagesByEventTypeAndId).mockReset();
  });

  describe('getMessages', () => {
    it('should return user-specific messages for DATA event type', async () => {
      const mockMessages: IEventMessage[] = [
        {
          userId,
          eventId,
          eventType: 'DATA',
          data: { content: 'Message 1' },
          message: 'Message 1'
        },
        {
          userId,
          eventId,
          eventType: 'DATA',
          data: { content: 'Message 2' },
          message: 'Message 2'
        }
      ];

      vi.mocked(EventMessageService.prototype.getMessagesByEventTypeAndId).mockResolvedValue(mockMessages);

      mockAuthRequest.query = { eventType: 'DATA' };

      await eventsController.getMessages(mockAuthRequest as AuthenticatedRequest, mockResponse as Response);

      expect(EventMessageService.prototype.getMessagesByEventTypeAndId).toHaveBeenCalledWith(userId, 'DATA', eventId);
      expect(mockResponse.json).toHaveBeenCalledWith(mockMessages);
    });

    it('should return user-specific messages for MESSAGE event type', async () => {
      const mockMessages: IEventMessage[] = [
        {
          userId,
          eventId,
          eventType: 'MESSAGE',
          data: {},
          message: 'Message 1'
        },
        {
          userId,
          eventId,
          eventType: 'MESSAGE',
          data: {},
          message: 'Message 2'
        }
      ];

      vi.mocked(EventMessageService.prototype.getMessagesByEventTypeAndId).mockResolvedValue(mockMessages);

      mockAuthRequest.query = { eventType: 'MESSAGE' };

      await eventsController.getMessages(mockAuthRequest as AuthenticatedRequest, mockResponse as Response);

      expect(EventMessageService.prototype.getMessagesByEventTypeAndId).toHaveBeenCalledWith(
        userId,
        'MESSAGE',
        eventId
      );
      expect(mockResponse.json).toHaveBeenCalledWith(mockMessages);
    });

    it('should handle errors correctly', async () => {
      const error = new Error('Database error');
      vi.mocked(EventMessageService.prototype.getMessagesByEventTypeAndId).mockRejectedValue(error);

      mockAuthRequest.query = { eventType: 'MESSAGE' };

      await eventsController.getMessages(mockAuthRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Failed to fetch messages' });
    });
  });
});
