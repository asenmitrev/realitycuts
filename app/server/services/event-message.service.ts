import { EventMessageRepository } from '../repositories/event-message.repository';
import { IEventMessage } from '../types';

export class EventMessageService {
  private repository: EventMessageRepository;

  constructor() {
    this.repository = new EventMessageRepository();
  }

  async getMessagesByEventTypeAndId(
    userId: string,
    eventType: 'DATA' | 'MESSAGE',
    eventId: string
  ): Promise<IEventMessage[]> {
    const messages = await this.repository.findByUserEventTypeAndId(userId, eventType, eventId);
    return [...messages].reverse();
  }

  async createEventMessage(eventMessage: Partial<IEventMessage>): Promise<IEventMessage> {
    return this.repository.create(eventMessage);
  }

  async getEventMessageById(id: string): Promise<IEventMessage | null> {
    return this.repository.findById(id);
  }

  async updateEventMessage(id: string, eventMessage: Partial<IEventMessage>): Promise<IEventMessage | null> {
    return this.repository.update(id, eventMessage);
  }

  async deleteEventMessage(id: string): Promise<IEventMessage | null> {
    return this.repository.delete(id);
  }
}
