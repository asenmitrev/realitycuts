import { logger } from '../services/logging';
import { sendError } from '../services/sockets';

export async function tryCatchError<T>(
  fn: () => Promise<T>,
  userId: string,
  eventId: string,
  message: string
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    logger.error(message, {
      Error: e,
      'User ID': userId,
      'Event ID': eventId
    });
    sendError(userId, eventId, message);
    throw e;
  }
}
