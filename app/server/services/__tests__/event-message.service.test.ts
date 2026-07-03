import { describe, it, expect, beforeEach, vi, Mock, Mocked } from 'vitest';
import { EventMessageService } from '../event-message.service';
import { EventMessageRepository } from '../../repositories/event-message.repository';
import { IEventMessage } from '../../types';

// Mock the repository
vi.mock('../../repositories/event-message.repository');

describe('EventMessageService', () => {
  let service: EventMessageService;
  const mockRepository = new EventMessageRepository() as Mocked<EventMessageRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EventMessageService();
    // @ts-ignore - Set the mocked repository
    service.repository = mockRepository;
  });

  describe('getMessagesByEventTypeAndId', () => {
    it('should get messages and reverse the order', async () => {
      const userId = 'user-123';
      const eventType = 'DATA';
      const eventId = 'event-123';
      const mockMessages: IEventMessage[] = [
        {
          userId,
          eventId,
          eventType,
          data: { content: 'Message 1' },
          message: 'Message 1'
        },
        {
          userId,
          eventId,
          eventType,
          data: { content: 'Message 2' },
          message: 'Message 2'
        }
      ];

      // Mock the repository's method
      vi.mocked(mockRepository.findByUserEventTypeAndId).mockResolvedValue(mockMessages);

      // Call the service method
      const result = await service.getMessagesByEventTypeAndId(userId, eventType, eventId);

      // Verify the repository was called correctly
      expect(mockRepository.findByUserEventTypeAndId).toHaveBeenCalledWith(userId, eventType, eventId);

      // The service should reverse the messages
      expect(result).toEqual([...mockMessages].reverse());
    });
  });

  describe('createEventMessage', () => {
    it('should create a new event message', async () => {
      const eventMessageData: Partial<IEventMessage> = {
        userId: 'user-123',
        eventId: 'event-123',
        eventType: 'MESSAGE',
        message: 'Test message'
      };

      const createdMessage: IEventMessage = {
        ...eventMessageData,
        data: {}
      } as IEventMessage;

      vi.mocked(mockRepository.create).mockResolvedValue(createdMessage);

      const result = await service.createEventMessage(eventMessageData);

      expect(mockRepository.create).toHaveBeenCalledWith(eventMessageData);
      expect(result).toEqual(createdMessage);
    });
  });

  describe('getEventMessageById', () => {
    it('should get an event message by id', async () => {
      const messageId = 'message-123';
      const message: IEventMessage = {
        userId: 'user-123',
        eventId: 'event-123',
        eventType: 'MESSAGE',
        message: 'Test message',
        data: {}
      };

      vi.mocked(mockRepository.findById).mockResolvedValue(message);

      const result = await service.getEventMessageById(messageId);

      expect(mockRepository.findById).toHaveBeenCalledWith(messageId);
      expect(result).toEqual(message);
    });
  });

  describe('updateEventMessage', () => {
    it('should update an event message', async () => {
      const messageId = 'message-123';
      const updateData: Partial<IEventMessage> = {
        message: 'Updated message'
      };
      const updatedMessage: IEventMessage = {
        userId: 'user-123',
        eventId: 'event-123',
        eventType: 'MESSAGE',
        message: 'Updated message',
        data: {}
      };

      vi.mocked(mockRepository.update).mockResolvedValue(updatedMessage);

      const result = await service.updateEventMessage(messageId, updateData);

      expect(mockRepository.update).toHaveBeenCalledWith(messageId, updateData);
      expect(result).toEqual(updatedMessage);
    });
  });

  describe('deleteEventMessage', () => {
    it('should delete an event message', async () => {
      const messageId = 'message-123';
      const deletedMessage: IEventMessage = {
        userId: 'user-123',
        eventId: 'event-123',
        eventType: 'MESSAGE',
        message: 'Test message',
        data: {}
      };

      vi.mocked(mockRepository.delete).mockResolvedValue(deletedMessage);

      const result = await service.deleteEventMessage(messageId);

      expect(mockRepository.delete).toHaveBeenCalledWith(messageId);
      expect(result).toEqual(deletedMessage);
    });
  });
});
