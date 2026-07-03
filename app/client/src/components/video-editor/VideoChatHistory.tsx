import type { FC } from 'react';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Box, Flex, Text, Icon, VStack, Textarea, Button, Spinner } from '@chakra-ui/react';
import { FaUser } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';
import Markdown from 'react-markdown';
import { useQuery } from 'react-query';
import { useChat } from '../chat/useChat';
import type { ChatMessage as HookChatMessage } from '../chat/types';
import { useApiService } from '../../hooks/useApiService';
import { VoiceSelectorModal } from '../upload/VoiceSelector';
import { getVoices } from '../../utils/voices';
import type { ElevenLabsVoice } from '../../types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  agentUsed?: string | null;
}

type DisplayMessage = Pick<HookChatMessage, 'id' | 'role' | 'content' | 'timestamp' | 'agentUsed'>;

/**
 * Maps agent enum values to human-readable display names
 */
const agentDisplayNames: Record<string, string> = {
  orchestrator: 'Assistant',
  footage_validation: 'Footage Validator',
  scriptwriter: 'Script Writer',
  footage_search: 'Footage Search',
  footage_fetcher: 'Footage Fetcher',
  video_overlay: 'Video Overlay',
  music_generator: 'Music Generator',
  voice_changer: 'Voice Changer'
};

function getAgentDisplayName(agent: string | null | undefined): string | null {
  if (!agent) return null;
  return agentDisplayNames[agent.toLowerCase()] || agent;
}

const ChatMessageBubble: FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <Flex w="100%" justify={isUser ? 'flex-end' : 'flex-start'} mb={3}>
      <Flex
        maxW="90%"
        direction={isUser ? 'row-reverse' : 'row'}
        align="flex-start"
        gap={2}
      >
        {/* Avatar */}
        <Flex
          w="28px"
          h="28px"
          borderRadius="8px"
          bg={isUser ? 'whiteAlpha.200' : 'linear-gradient(135deg, #22D0FF 0%, #0097ff 100%)'}
          align="center"
          justify="center"
          flexShrink={0}
          border="1px solid"
          borderColor={isUser ? 'whiteAlpha.200' : 'transparent'}
        >
          <Icon
            as={isUser ? FaUser : HiSparkles}
            boxSize={3}
            color={isUser ? 'whiteAlpha.700' : 'white'}
          />
        </Flex>

        {/* Message bubble */}
        <Box
          bg={isUser ? 'whiteAlpha.100' : 'whiteAlpha.50'}
          border="1px solid"
          borderColor={isUser ? 'whiteAlpha.200' : 'whiteAlpha.100'}
          px={3}
          py={2}
          borderRadius="12px"
          borderTopRightRadius={isUser ? '4px' : '12px'}
          borderTopLeftRadius={isUser ? '12px' : '4px'}
        >
          <Box
            className="chat-markdown"
            fontSize="sm"
            color="white"
            lineHeight="1.5"
            sx={{
              '& p': { mb: 2, _last: { mb: 0 } },
              '& ul, & ol': { pl: 5, mb: 2 },
              '& li': { mb: 1 },
              '& code': {
                bg: 'whiteAlpha.200',
                px: 1.5,
                py: 0.5,
                borderRadius: 'md',
                fontSize: 'sm',
                fontFamily: 'mono'
              },
              '& pre': {
                bg: 'whiteAlpha.100',
                p: 3,
                borderRadius: 'md',
                overflowX: 'auto',
                mb: 2,
                '& code': { bg: 'transparent', p: 0 }
              },
              '& h1, & h2, & h3, & h4': {
                fontWeight: 'bold',
                mb: 2,
                mt: 2
              },
              '& h1': { fontSize: 'xl' },
              '& h2': { fontSize: 'lg' },
              '& h3': { fontSize: 'md' },
              '& a': { color: 'blue.300', textDecoration: 'underline' },
              '& blockquote': {
                borderLeft: '3px solid',
                borderColor: 'whiteAlpha.300',
                pl: 3,
                ml: 0,
                mb: 2,
                color: 'whiteAlpha.700'
              },
              '& hr': {
                borderColor: 'whiteAlpha.200',
                my: 3
              },
              '& strong': { fontWeight: 'bold' },
              '& em': { fontStyle: 'italic' }
            }}
          >
            <Markdown>{message.content}</Markdown>
          </Box>
          <Flex
            mt={1}
            fontSize="xs"
            color="whiteAlpha.400"
            justify={isUser ? 'flex-end' : 'space-between'}
            align="center"
            gap={2}
          >
            {message.agentUsed && (
              <Text color="whiteAlpha.500" fontWeight="medium" fontSize="xs">
                {getAgentDisplayName(message.agentUsed)}
              </Text>
            )}
            <Text fontSize="xs">
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </Flex>
        </Box>
      </Flex>
    </Flex>
  );
};

interface VideoChatHistoryProps {
  messages: ChatMessage[];
  conversationId?: string | null;
  videoAIDataId?: string;
  segments?: Array<{ timeStart: number; timeEnd: number }>;
  onVideoUpdated?: () => void;
  onEditorDispatch?: (actionType: string, payload: unknown) => void;
}

export const VideoChatHistory: FC<VideoChatHistoryProps> = ({
  messages,
  conversationId,
  videoAIDataId,
  segments,
  onVideoUpdated,
  onEditorDispatch
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [localSystemMessages, setLocalSystemMessages] = useState<ChatMessage[]>([]);
  const apiService = useApiService();

  const { messages: hookMessages, sendMessage, isLoading, currentStatus, workflowState } = useChat({
    conversationId,
    onError: (error) => {
      setLocalSystemMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: error || 'Something went wrong.',
          timestamp: new Date().toISOString()
        }
      ]);
    }
  });

  // Voice selector for voice change flow (triggered by voice_select action from voice_changer node)
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  const { data: premiumVoices } = useQuery<ElevenLabsVoice[]>({
    queryKey: ['premiumVoices'],
    queryFn: async () => apiService.get<ElevenLabsVoice[]>('/api/premium/voices'),
    refetchOnMount: false,
    refetchOnWindowFocus: false
  });
  const voices = useMemo(() => getVoices(premiumVoices), [premiumVoices]);

  const voiceSelectKeysRef = useRef<Set<string>>(new Set());

  // Watch for voice_select actions emitted by the voice_changer node (Phase 1)
  useEffect(() => {
    if (!conversationId) return;

    for (const msg of hookMessages) {
      if (msg.role !== 'assistant') continue;
      const actions = (msg as HookChatMessage).actions ?? [];
      for (const action of actions) {
        if (action.type !== 'voice_select') continue;
        if (action.completed) continue;
        const key = `${(msg as HookChatMessage).id}:${action.type}`;
        if (voiceSelectKeysRef.current.has(key)) continue;
        voiceSelectKeysRef.current.add(key);
        setIsVoiceModalOpen(true);
        break;
      }
    }
  }, [conversationId, hookMessages]);

  const handleVoiceSelect = useCallback(
    (voiceId: string) => {
      setIsVoiceModalOpen(false);
      sendMessage("I've selected a voice, let's update it!", { voiceId, uiContext: 'editor' });
    },
    [sendMessage]
  );

  const voiceChangedKeysRef = useRef<Set<string>>(new Set());

  // Watch for voice_changed actions emitted by voice_changer Phase 2.
  // When detected, immediately refetch the video data so the player picks up the new audio.
  useEffect(() => {
    if (!conversationId || !onVideoUpdated) return;

    for (const msg of hookMessages) {
      if (msg.role !== 'assistant') continue;
      const actions = (msg as HookChatMessage).actions ?? [];
      for (const action of actions) {
        if (action.type !== 'voice_changed') continue;
        const key = `${(msg as HookChatMessage).id}:voice_changed`;
        if (voiceChangedKeysRef.current.has(key)) continue;
        voiceChangedKeysRef.current.add(key);
        onVideoUpdated();
        break;
      }
    }
  }, [conversationId, hookMessages, onVideoUpdated]);

  const processedKeysRef = useRef<Set<string>>(new Set());
  const inFlightKeysRef = useRef<Set<string>>(new Set());

  // Auto-consume one-time editor actions emitted by the backend (e.g. editor_dispatch).
  useEffect(() => {
    if (!conversationId) return;
    if (!onEditorDispatch) return;

    const run = async () => {
      for (const msg of hookMessages) {
        if (msg.role !== 'assistant') continue;
        const actions = msg.actions ?? [];
        for (const action of actions) {
          if (action.type !== 'editor_dispatch') continue;
          if (action.completed) continue;

          const key = `${msg.id}:${action.type}`;
          if (processedKeysRef.current.has(key) || inFlightKeysRef.current.has(key)) continue;

          const payloadObj = action.payload;
          const actionType =
            payloadObj && typeof payloadObj === 'object' && 'actionType' in payloadObj
              ? (payloadObj as { actionType?: unknown }).actionType
              : undefined;
          const innerPayload =
            payloadObj && typeof payloadObj === 'object' && 'payload' in payloadObj
              ? (payloadObj as { payload?: unknown }).payload
              : undefined;
          if (typeof actionType !== 'string' || !actionType) continue;
          inFlightKeysRef.current.add(key);
          try {
            onEditorDispatch(actionType, innerPayload);

            await apiService.post(
              `/api/chat/conversations/${conversationId}/actions/complete`,
              {
                messageId: msg.id,
                actionType: action.type
              },
              {}
            );

            processedKeysRef.current.add(key);
          } catch (e) {
            // If ack fails, leave it unprocessed so it can retry on next poll.
            // Still clear inFlight so we don't deadlock.
            console.error('Failed to apply/ack editor action', e);
          } finally {
            inFlightKeysRef.current.delete(key);
          }
        }
      }
    };

    run();
  }, [apiService, conversationId, hookMessages, onEditorDispatch]);

  const displayMessages = useMemo(() => {
    const base: DisplayMessage[] = (conversationId ? hookMessages : messages)
      .filter(m => m.content)
      // Normalize to a minimal shape that the bubble expects
      .map((m, idx) => ({
        id: (m as HookChatMessage).id ?? `prop-${idx}-${m.timestamp}`,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        agentUsed: m.agentUsed ?? null
      }));

    const extras: DisplayMessage[] = localSystemMessages
      .filter(m => m.content)
      .map((m, idx) => ({
        id: `local-${idx}-${m.timestamp}`,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        agentUsed: m.agentUsed ?? null
      }));

    return [...base, ...extras];
  }, [conversationId, hookMessages, localSystemMessages, messages]);

  useEffect(() => {
    if (displayMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayMessages.length]);

  const canSend = Boolean(conversationId && inputValue.trim() && !isLoading);

  const prevIsLoadingRef = useRef<boolean>(false);
  useEffect(() => {
    const prev = prevIsLoadingRef.current;
    prevIsLoadingRef.current = isLoading;

    if (!prev || isLoading) return;
    if (!videoAIDataId || !onVideoUpdated) return;
    if (workflowState?.videoAIDataId === videoAIDataId) {
      onVideoUpdated();
    }
  }, [isLoading, onVideoUpdated, videoAIDataId, workflowState?.videoAIDataId]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || !conversationId || isLoading) return;

    const segmentContext = segments?.map((seg, index) => ({
      index,
      timeStart: seg.timeStart,
      timeEnd: seg.timeEnd
    }));

    setInputValue('');
    await sendMessage(text, { uiContext: 'editor', segmentContext });
  }, [conversationId, inputValue, isLoading, segments, sendMessage]);

  return (
    <>
    <VStack spacing={0} align="stretch" h="100%" minH={0}>
      <Box flex="1" overflowY="auto" minH={0} pb={2}>
        {displayMessages.map((message) => (
          <ChatMessageBubble
            key={(message as DisplayMessage).id || `${message.role}-${message.timestamp}-${message.content.slice(0, 40)}`}
            message={message as ChatMessage}
          />
        ))}
        {currentStatus && (
          <Flex align="center" gap={2} mt={2} color="whiteAlpha.600" fontSize="sm">
            <Spinner size="sm" />
            <Text>{currentStatus}</Text>
          </Flex>
        )}
        <div ref={messagesEndRef} />
      </Box>
      {conversationId && (
        <Flex mt={2} gap={2} flexShrink={0} align="flex-end">
          <Textarea
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            isDisabled={isLoading}
            bg="whiteAlpha.100"
            borderColor="whiteAlpha.200"
            _placeholder={{ color: 'whiteAlpha.500' }}
            resize="none"
            rows={2}
          />
          <Button
            size="sm"
            colorScheme="blue"
            onClick={handleSend}
            isDisabled={!canSend}
            isLoading={isLoading}
            flexShrink={0}
            mb="2px"
          >
            Send
          </Button>
        </Flex>
      )}
    </VStack>
    <VoiceSelectorModal
      isOpen={isVoiceModalOpen}
      onClose={() => setIsVoiceModalOpen(false)}
      onSelectVoice={handleVoiceSelect}
      voices={voices}
      initialVoiceId={workflowState?.voiceId}
    />
    </>
  );
};
