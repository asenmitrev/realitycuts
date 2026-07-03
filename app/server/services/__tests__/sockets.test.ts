import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as socketService from '../sockets';
import { EventMessageService } from '../event-message.service';
import { logger } from '../logging';

// Mock dependencies
vi.mock('../event-message.service');
vi.mock('../logging', () => ({
  logger: {
    info: vi.fn()
  }
}));

describe('Socket Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should create a message event and log it', async () => {
      const userId = 'user-123';
      const eventId = 'event-123';
      const message = 'Test message';
      const percent = 50;

      // Mock the service method
      const mockCreate = vi.fn().mockResolvedValue({});
      vi.mocked(EventMessageService.prototype.createEventMessage).mockImplementation(mockCreate);

      await socketService.sendMessage(userId, eventId, message, percent);

      // Check if service was called with the right parameters
      expect(mockCreate).toHaveBeenCalledWith({
        eventType: 'MESSAGE',
        message,
        eventId,
        userId,
        progress: percent
      });

      // Check if the log was called
      expect(logger.info).toHaveBeenCalledWith(message, {
        'Event ID': eventId,
        'User ID': userId,
        Percent: percent
      });
    });
  });

  describe('sendError', () => {
    it('should create an error message event and log it', async () => {
      const userId = 'user-123';
      const eventId = 'event-123';
      const message = 'Error message';
      const percent = 0;

      // Mock the service method
      const mockCreate = vi.fn().mockResolvedValue({});
      vi.mocked(EventMessageService.prototype.createEventMessage).mockImplementation(mockCreate);

      await socketService.sendError(userId, eventId, message, percent);

      // Check if logger was called
      expect(logger.info).toHaveBeenCalledWith(message, {
        'Event ID': eventId,
        'User ID': userId,
        Percent: percent
      });

      // Check if service was called with the right parameters
      expect(mockCreate).toHaveBeenCalledWith({
        eventType: 'MESSAGE',
        message,
        eventId,
        userId,
        progress: percent,
        isError: true
      });
    });
  });

  describe('sendData', () => {
    it('should create a data event and log it', async () => {
      const userId = 'user-123';
      const eventId = 'event-123';
      const data = { key: 'value' };

      // Mock the service method
      const mockCreate = vi.fn().mockResolvedValue({});
      vi.mocked(EventMessageService.prototype.createEventMessage).mockImplementation(mockCreate);

      await socketService.sendData(userId, eventId, data);

      // Check if logger was called
      expect(logger.info).toHaveBeenCalledWith(JSON.stringify(data), {
        'Event ID': eventId,
        'User ID': userId
      });

      // Check if service was called with the right parameters
      expect(mockCreate).toHaveBeenCalledWith({
        eventType: 'DATA',
        data,
        eventId,
        userId
      });
    });
  });
});
