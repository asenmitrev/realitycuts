import { createContext } from 'react';
import { Message } from '../../types';

export type SocketDataEventPayload = { _id: string; isHighlight: boolean; highlightId?: string; videoUrl?: string };
interface SocketContext {
  messages?: Message[];
  data?: { eventId: string; data: SocketDataEventPayload };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setData?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setMessages?: any;
}
export const SocketContext = createContext<SocketContext>({ messages: [] });
