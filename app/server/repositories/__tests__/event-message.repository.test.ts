import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { EventMessageRepository } from '../event-message.repository';
import { EventMessageModel } from '../../models/event-message';
import { IEventMessage } from '../../types';

// Mock the Mongoose model
vi.mock('../../models/event-message');

describe('EventMessageRepository', () => {
  let repository: EventMessageRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new EventMessageRepository();
  });

  describe('findByUserEventTypeAndId', () => {
    it('should find messages with the correct query parameters and sorting', async () => {
      const userId = 'user-123';
      const eventType = 'DATA';
      const eventId = 'event-123';
      const limit = 20;

      const mockSort = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);

      (EventMessageModel.find as Mock).mockReturnValue({
        sort: mockSort,
        limit: mockLimit
      });

      await repository.findByUserEventTypeAndId(userId, eventType, eventId, limit);

      expect(EventMessageModel.find).toHaveBeenCalledWith({ userId, eventType, eventId });
      expect(mockSort).toHaveBeenCalledWith({ _id: -1 });
      expect(mockLimit).toHaveBeenCalledWith(limit);
    });
  });

  describe('create', () => {
    it('should create a new event message', async () => {
      const eventMessageData: Partial<IEventMessage> = {
        userId: 'user-123',
        eventId: 'event-123',
        eventType: 'MESSAGE',
        message: 'Test message'
      };

      const createdMessage = {
        ...eventMessageData,
        _id: 'new-id',
        data: {}
      };

      (EventMessageModel.create as Mock).mockResolvedValue(createdMessage);

      const result = await repository.create(eventMessageData);

      expect(EventMessageModel.create).toHaveBeenCalledWith(eventMessageData);
      expect(result).toEqual(createdMessage);
    });
  });

  describe('findById', () => {
    it('should find a message by id', async () => {
      const messageId = 'message-123';
      const message = { _id: messageId, message: 'Test message' };

      (EventMessageModel.findById as Mock).mockResolvedValue(message);

      const result = await repository.findById(messageId);

      expect(EventMessageModel.findById).toHaveBeenCalledWith(messageId);
      expect(result).toEqual(message);
    });
  });

  describe('update', () => {
    it('should update a message', async () => {
      const messageId = 'message-123';
      const updateData = { message: 'Updated message' };
      const updatedMessage = { _id: messageId, message: 'Updated message' };

      (EventMessageModel.findByIdAndUpdate as Mock).mockResolvedValue(updatedMessage);

      const result = await repository.update(messageId, updateData);

      expect(EventMessageModel.findByIdAndUpdate).toHaveBeenCalledWith(messageId, updateData, { new: true });
      expect(result).toEqual(updatedMessage);
    });
  });

  describe('delete', () => {
    it('should delete a message', async () => {
      const messageId = 'message-123';
      const deletedMessage = { _id: messageId, message: 'Deleted message' };

      (EventMessageModel.findByIdAndDelete as Mock).mockResolvedValue(deletedMessage);

      const result = await repository.delete(messageId);

      expect(EventMessageModel.findByIdAndDelete).toHaveBeenCalledWith(messageId);
      expect(result).toEqual(deletedMessage);
    });
  });
});
