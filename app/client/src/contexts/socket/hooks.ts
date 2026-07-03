import { useContext } from 'react';
import { SocketContext } from './context';

export const useSetMessages = () => {
  const ctx = useContext(SocketContext);
  return ctx.setMessages;
};

export const useSetData = () => {
  const ctx = useContext(SocketContext);
  return ctx.setData;
};
