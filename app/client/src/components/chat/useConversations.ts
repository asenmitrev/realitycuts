import { useState, useCallback, useEffect } from 'react';
import { useRefetchToken } from '../../contexts/firebase/hooks';
import { ConversationSummary } from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface UseConversationsOptions {
  autoFetch?: boolean;
}

export const useConversations = (options: UseConversationsOptions = {}) => {
  const { autoFetch = true } = options;
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refetchToken = useRefetchToken();

  /**
   * Fetch all conversations for the current user
   */
  const fetchConversations = useCallback(async () => {
    const token = await refetchToken(false);
    if (!token || typeof token === 'boolean') {
      console.error('Failed to get auth token');
      return;
    }

    setIsLoading(true);
    setError(null);

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
      setError('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, [refetchToken]);

  /**
   * Delete a conversation
   */
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

  /**
   * Add a conversation to the list (for optimistic updates)
   */
  const addConversation = useCallback((conversation: ConversationSummary) => {
    setConversations(prev => [conversation, ...prev]);
  }, []);

  /**
   * Update a conversation in the list
   */
  const updateConversation = useCallback((conversationId: string, updates: Partial<ConversationSummary>) => {
    setConversations(prev =>
      prev.map(c => (c._id === conversationId ? { ...c, ...updates } : c))
    );
  }, []);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      fetchConversations();
    }
  }, [autoFetch, fetchConversations]);

  return {
    conversations,
    isLoading,
    error,
    fetchConversations,
    deleteConversation,
    addConversation,
    updateConversation
  };
};
