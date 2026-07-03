import { useQuery } from 'react-query';
import { useApiService } from './useApiService';
import { Message } from '../types';

export const useMessages = (eventId: string, eventType: 'MESSAGE' | 'DATA' = 'MESSAGE') => {
  const apiService = useApiService();

  const { data: messages } = useQuery({
    queryKey: ['eventMessages', eventId, eventType],
    queryFn: async () => {
      return await apiService.get<Message[]>(`/api/events/${eventId}?eventType=${eventType}`);
    },
    enabled: !!eventId,
    refetchInterval: 5000
  });

  return messages;
};
