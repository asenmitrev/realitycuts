import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tryCatchError } from '../error-handling';
import { logger } from '../../services/logging';
import { sendError } from '../../services/sockets';

// Mock the dependencies
vi.mock('../../services/logging', () => ({
  logger: {
    error: vi.fn()
  }
}));

vi.mock('../../services/sockets', () => ({
  sendError: vi.fn()
}));

describe('tryCatchError', () => {
  const userId = 'test-user-id';
  const eventId = 'test-event-id';
  const message = 'Test error message';

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    console.log = vi.fn();
  });

  it('should return the result when the function succeeds', async () => {
    const expectedResult = { success: true };
    const successFn = vi.fn().mockResolvedValue(expectedResult);

    const result = await tryCatchError(successFn, userId, eventId, message);

    expect(result).toEqual(expectedResult);
    expect(logger.error).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
    expect(sendError).not.toHaveBeenCalled();
  });

  it('should handle and re-throw errors with proper logging', async () => {
    const testError = new Error('Test error');
    const failingFn = vi.fn().mockRejectedValue(testError);

    await expect(tryCatchError(failingFn, userId, eventId, message)).rejects.toThrow(testError);

    expect(logger.error).toHaveBeenCalledWith(message, {
      Error: testError,
      'User ID': userId,
      'Event ID': eventId
    });
    expect(sendError).toHaveBeenCalledWith(userId, eventId, message);
  });
});
