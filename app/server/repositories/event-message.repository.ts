import { EventMessageModel } from '../models/event-message';
import { IEventMessage } from '../types';

export class EventMessageRepository {
  async findByUserEventTypeAndId(
    userId: string,
    eventType: 'DATA' | 'MESSAGE',
    eventId: string,
    limit = 20
  ): Promise<IEventMessage[]> {
    return EventMessageModel.find({ userId, eventType, eventId }).sort({ _id: -1 }).limit(limit);
  }

  async create(eventMessage: Partial<IEventMessage>): Promise<IEventMessage> {
    return EventMessageModel.create(eventMessage);
  }

  async findById(id: string): Promise<IEventMessage | null> {
    return EventMessageModel.findById(id);
  }

  async update(id: string, eventMessage: Partial<IEventMessage>): Promise<IEventMessage | null> {
    return EventMessageModel.findByIdAndUpdate(id, eventMessage, { new: true });
  }

  async delete(id: string): Promise<IEventMessage | null> {
    return EventMessageModel.findByIdAndDelete(id);
  }
}
