import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useIsFirebaseInitializing } from '../../contexts/firebase/hooks';
import { useApiService } from '../../hooks/useApiService';
import type { ChatMessage, ConversationDetail, PendingMessage } from './types';

// Polling interval in milliseconds (while pendingMessage is processing)
const POLL_INTERVAL = 1000;

export interface UseChatOptions {
  conversationId?: string | null;
  onConversationCreated?: (conversationId: string) => void;
  onError?: (error: string) => void;
}

/**
 * Simplified chat hook that uses conversation as the single source of truth.
 * All derived state (isLoading, currentStatus, messages) comes from the conversation.
 */
export const useChat = (options: UseChatOptions = {}) => {
  const { conversationId, onConversationCreated, onError } = options;

  // Optimistic user message (shown immediately before server confirms)
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<ChatMessage | null>(null);
  const [localPendingOverride, setLocalPendingOverride] = useState<PendingMessage | null>(null);

  const { get, post } = useApiService();
  const isFirebaseInitializing = useIsFirebaseInitializing();
  const queryClient = useQueryClient();
  const hasNotifiedRef = useRef(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(conversationId ?? null);
  const prevExternalConversationIdRef = useRef<string | null>(conversationId ?? null);
  // Ref to track optimistic message content (avoids stale closure issues)
  const optimisticContentRef = useRef<string | null>(null);

  // Keep local active conversation id in sync with external prop
  useEffect(() => {
    const nextExternalId = conversationId ?? null;
    const prevExternalId = prevExternalConversationIdRef.current;
    prevExternalConversationIdRef.current = nextExternalId;

    setActiveConversationId(conversationId ?? null);

    // If the external conversation changes (including to null), clear optimistic/local pending state
    if (prevExternalId !== nextExternalId) {
      optimisticContentRef.current = null;
      setOptimisticUserMessage(null);
      setLocalPendingOverride(null);
    }

    if (!conversationId) {
      hasNotifiedRef.current = false;
    }
  }, [conversationId]);

  const fetchConversation = useCallback(
    async (id: string): Promise<ConversationDetail> => {
      const data = await get<{ conversation: ConversationDetail }>(`/api/chat/conversations/${id}`, {
        // New conversations can briefly 404 while the backend finishes creating them.
        // React Query will retry, so avoid spamming the user with a toast during this expected window.
        suppressToast: { statusCodes: [404] }
      });
      return data.conversation;
    },
    [get]
  );

  const conversationQuery = useQuery(
    ['chat-conversation', activeConversationId],
    () => fetchConversation(activeConversationId as string),
    {
      enabled: Boolean(activeConversationId),
      retry: 5,
      retryDelay: attemptIndex => Math.min(500 * 2 ** attemptIndex, 5000),
      refetchInterval: activeConversationId ? POLL_INTERVAL : false,
      onSuccess: conv => {
        // Clear optimistic message once server has the user message
        const optimisticContent = optimisticContentRef.current;
        if (optimisticContent && conv.messages.some(m => m.content === optimisticContent)) {
          optimisticContentRef.current = null;
          setOptimisticUserMessage(null);
        }

        // Clear any local pending override if server has a newer pending state
        setLocalPendingOverride(prev =>
          prev && conv.pendingMessage?.messageId !== prev.messageId ? null : prev
        );
      }
    }
  );

  const conversation: ConversationDetail | null = useMemo(() => {
    const conv = conversationQuery.data ?? null;
    if (!conv) return null;
    if (!localPendingOverride) return conv;
    return { ...conv, pendingMessage: localPendingOverride };
  }, [conversationQuery.data, localPendingOverride]);

  const isLoadingConversation = useMemo(() => {
    if (isFirebaseInitializing && !!activeConversationId) return true;
    return conversationQuery.isLoading || (conversationQuery.isFetching && !conversationQuery.data);
  }, [activeConversationId, conversationQuery.data, conversationQuery.isFetching, conversationQuery.isLoading, isFirebaseInitializing]);

  // Derive isLoading from conversation's pendingMessage status
  const isLoading = useMemo(() => {
    return conversation?.pendingMessage?.status === 'processing';
  }, [conversation?.pendingMessage?.status]);

  // Derive currentStatus from conversation's pendingMessage
  const currentStatus = useMemo(() => {
    if (conversation?.pendingMessage?.status === 'processing') {
      return conversation.pendingMessage.currentStatus || 'Processing...';
    }
    return null;
  }, [conversation?.pendingMessage]);

  // Derive workflowState from conversation
  const workflowState = useMemo(() => {
    return conversation?.workflowState || null;
  }, [conversation?.workflowState]);

  // Derive messages from conversation + pending message response
  const messages = useMemo((): ChatMessage[] => {
    if (!conversation) {
      // New conversation - only show optimistic message if present
      return optimisticUserMessage ? [optimisticUserMessage] : [];
    }

    const baseMessages: ChatMessage[] = conversation.messages.map((msg, idx) => ({
      id: msg.id || `msg-${idx}`,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      agentUsed: msg.agentUsed,
      actions: msg.actions
    }));

    // Add optimistic user message ONLY if server doesn't have it yet (prevents duplicates)
    const serverHasOptimistic = optimisticUserMessage &&
      conversation.messages.some(m => m.role === 'user' && m.content === optimisticUserMessage.content);
    if (optimisticUserMessage && !serverHasOptimistic) {
      baseMessages.push(optimisticUserMessage);
    }

    // Add assistant message from pendingMessage while processing (streaming)
    const pending = conversation.pendingMessage;
    if (pending?.status === 'processing') {
      baseMessages.push({
        id: `pending-${pending.messageId}`,
        role: 'assistant',
        content: pending.response || '',
        timestamp: pending.startedAt,
        agentUsed: pending.agentUsed,
        isStreaming: true
      });
    }

    return baseMessages;
  }, [conversation, optimisticUserMessage]);

  /**
   * Send a message
   * @param content - The message content
   * @param options - Optional parameters like voiceId for voice selection
   */
  const sendMessage = useCallback(
    async (
      content: string,
      options?: {
        voiceId?: string;
        uiContext?: 'chat' | 'editor';
        segmentContext?: Array<{ index: number; timeStart: number; timeEnd: number }>;
      }
    ) => {
      // Add optimistic user message immediately
      const userMessage: ChatMessage = {
        id: `optimistic-user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date().toISOString()
      };
      optimisticContentRef.current = content;
      setOptimisticUserMessage(userMessage);
      setLocalPendingOverride(null);

      try {
        const data = await post<
          { conversationId: string },
          {
            message: string;
            conversationId: string | null;
            voiceId?: string;
            uiContext?: 'chat' | 'editor';
            segmentContext?: Array<{ index: number; timeStart: number; timeEnd: number }>;
          }
        >(
          '/api/chat',
          {
            message: content,
            conversationId: activeConversationId,
            voiceId: options?.voiceId,
            uiContext: options?.uiContext,
            segmentContext: options?.segmentContext
          }
        );

        // Update conversation ID and notify
        const newConvId = data.conversationId;
        setActiveConversationId(newConvId);

        if (!hasNotifiedRef.current && onConversationCreated) {
          hasNotifiedRef.current = true;
          onConversationCreated(newConvId);
        }

        conversationQuery.refetch();
      } catch (error) {
        console.error('Chat error:', error);
        optimisticContentRef.current = null;
        setOptimisticUserMessage(null);

        const errorMessage = error instanceof Error ? error.message : 'Sorry, something went wrong. Please try again.';

        // Notify parent component of the error
        if (onError) {
          onError(errorMessage);
        }

        // Provide a local pending error override if we already have a conversation loaded
        if (activeConversationId) {
          setLocalPendingOverride({
            messageId: 'error',
            userMessage: content,
            status: 'error',
            response: '',
            error: errorMessage,
            startedAt: new Date().toISOString()
          });
        }
      }
    },
    [post, activeConversationId, onConversationCreated, conversationQuery, onError]
  );

  /**
   * Cancel the current request/polling
   */
  const cancelStream = useCallback(() => {
    if (activeConversationId) {
      queryClient.cancelQueries(['chat-conversation', activeConversationId]);
    }
  }, [activeConversationId, queryClient]);

  /**
   * Clear messages for a new conversation
   */
  const clearMessages = useCallback(() => {
    cancelStream();
    optimisticContentRef.current = null;
    setOptimisticUserMessage(null);
    setLocalPendingOverride(null);
    setActiveConversationId(null);
    hasNotifiedRef.current = false;
  }, [cancelStream]);

  /**
   * Reload the current conversation (for external refresh)
   */
  const loadConversation = useCallback(
    async (id: string) => {
      setActiveConversationId(id);
      await queryClient.invalidateQueries(['chat-conversation', id]);
    },
    [queryClient]
  );

  return {
    messages,
    isLoading,
    isLoadingConversation,
    currentStatus,
    conversationId: activeConversationId,
    workflowState,
    sendMessage,
    cancelStream,
    clearMessages,
    loadConversation
  };
};
