import { FC, ReactNode, useState } from 'react';
import { SocketContext, SocketDataEventPayload } from './context';
import { Message } from '../../types';

interface UserIdProviderProps {
  children?: ReactNode;
}
export const SocketMessagesProvider: FC<UserIdProviderProps> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [data, setData] = useState<{ eventId: string; data: SocketDataEventPayload }>();

  return <SocketContext.Provider value={{ messages, data, setData, setMessages }}>{children}</SocketContext.Provider>;
};
