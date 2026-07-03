import { EventMessageService } from './event-message.service';
import { logger } from './logging';

const eventMessageService = new EventMessageService();

export const sendMessage = async (userId: string, eventId: string, message: string, percent?: number) => {
  await eventMessageService.createEventMessage({
    eventType: 'MESSAGE',
    message,
    eventId,
    userId,
    progress: percent || 0
  });
  logger.info(message, {
    'Event ID': eventId,
    'User ID': userId,
    Percent: percent
  });
};

export const sendError = async (userId: string, eventId: string, message: string, percent?: number) => {
  logger.info(message, {
    'Event ID': eventId,
    'User ID': userId,
    Percent: percent
  });
  await eventMessageService.createEventMessage({
    eventType: 'MESSAGE',
    message,
    eventId,
    userId,
    progress: percent || 0,
    isError: true
  });
};

export const sendData = async (userId: string, eventId: string, data: object) => {
  logger.info(JSON.stringify(data), {
    'Event ID': eventId,
    'User ID': userId
  });
  await eventMessageService.createEventMessage({
    eventType: 'DATA',
    data,
    eventId,
    userId
  });
};
