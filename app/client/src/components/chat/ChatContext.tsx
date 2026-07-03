import { createContext, useContext, FC, PropsWithChildren, useCallback, useState, useEffect } from 'react';
import { useRefetchToken } from '../../contexts/firebase/hooks';
import { ConversationSummary } from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface ChatContextValue {
  conversations: ConversationSummary[];
  isLoadingConversations: boolean;
  refreshConversations: () => Promise<void>;
  deleteConversation: (id: string) => Promise<boolean>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export const ChatProvider: FC<PropsWithChildren> = ({ children }) => {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const refetchToken = useRefetchToken();

  const refreshConversations = useCallback(async () => {
    const token = await refetchToken(false);
    if (!token || typeof token === 'boolean') {
      console.error('Failed to get auth token');
      return;
    }

    setIsLoadingConversations(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { conversations: data } = await response.json();
      setConversations(data);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [refetchToken]);

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      const token = await refetchToken(false);
      if (!token || typeof token === 'boolean') {
        console.error('Failed to get auth token');
        return false;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/chat/conversations/${conversationId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Remove from local state
        setConversations(prev => prev.filter(c => c._id !== conversationId));
        return true;
      } catch (err) {
        console.error('Failed to delete conversation:', err);
        return false;
      }
    },
    [refetchToken]
  );

  // Fetch conversations on mount
  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  return (
    <ChatContext.Provider
      value={{
        conversations,
        isLoadingConversations,
        refreshConversations,
        deleteConversation
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};
