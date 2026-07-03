import { FC, useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { Box, Container, Flex, Heading, Text, VStack, Icon, HStack, useToast, useBreakpointValue } from '@chakra-ui/react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery as useReactQuery } from 'react-query';
import { ChatMessageComponent } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { LoadingIndicator } from './LoadingIndicator';
import { ChatAction } from './ChatActionButtons';
import { useChat } from './useChat';
import { useChatContext } from './ChatContext';
import { useVideoPreviewContext } from './ChatLayout';
import { apiService } from '../../service/apiService';
import { ElevenLabsVoice, VideoAIData } from '../../types';
import { VideoPreviewData } from './types';
import { BiSolidVideoPlus } from 'react-icons/bi';
import { HiSparkles, HiMicrophone } from 'react-icons/hi2';
import { VoiceSelectorModal } from '../upload/VoiceSelector';
import { getVoices } from '../../utils/voices';

const SuggestionChip: FC<{ text: string; onClick: () => void }> = ({ text, onClick }) => (
  <Box
    as="button"
    px={4}
    py={2}
    bg="whiteAlpha.100"
    border="1px solid"
    borderColor="whiteAlpha.200"
    borderRadius="full"
    color="whiteAlpha.800"
    fontSize="sm"
    transition="all 0.2s"
    _hover={{
      bg: 'whiteAlpha.200',
      borderColor: 'whiteAlpha.300',
      transform: 'translateY(-1px)'
    }}
    onClick={onClick}
  >
    {text}
  </Box>
);

function transformToPreviewData(videoData: VideoAIData): VideoPreviewData {
  return {
    voiceOver: videoData.voiceOver || '',
    segments: (videoData.segments || []).map(seg => ({
      timeStart: seg.timeStart,
      timeEnd: seg.timeEnd,
      alternatives: (seg.alternatives || []).map(alt => ({
        link: alt.link || alt.preview || '',
        preview: alt.preview || '',
        thumbnailUrl: alt.thumbnailUrl || ''
      }))
    }))
  };
}

export const ChatPage: FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialMessage = (location.state as { initialMessage?: string } | null)?.initialMessage;
  const hasAutoSentRef = useRef(false);
  const { refreshConversations } = useChatContext();
  const { setVideoPreviewData, clearVideoPreview } = useVideoPreviewContext();
  const isDesktop = useBreakpointValue({ base: false, lg: true });
  const toast = useToast();

  // Voice selection modal state
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // Fetch premium voices for voice selector
  const { data: premiumVoices } = useReactQuery({
    queryKey: ['premiumVoices'],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      return await apiService.get<ElevenLabsVoice[]>('/api/premium/voices');
    }
  });
  const voices = useMemo(() => getVoices(premiumVoices), [premiumVoices]);

  const handleConversationCreated = useCallback(
    (conversationId: string) => {
      // Navigate to the chat URL without adding to history stack (replace)
      navigate(`/chats/${conversationId}`, { replace: true });
      // Refresh the conversation list to include the new chat
      refreshConversations();
    },
    [navigate, refreshConversations]
  );

  const handleError = useCallback(
    (errorMessage: string) => {
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top'
      });
    },
    [toast]
  );

  const { messages, isLoading, isLoadingConversation, currentStatus, workflowState, sendMessage } = useChat({
    conversationId: chatId,
    onConversationCreated: handleConversationCreated,
    onError: handleError
  });

  const videoAIDataId = workflowState?.videoAIDataId;

  // Fetch video when we have videoAIDataId (for mobile preview)
  const { data: videoData } = useReactQuery<VideoAIData | null>({
    queryKey: ['chatVideoPreview', videoAIDataId],
    queryFn: async () => {
      if (!videoAIDataId) return null;
      return apiService.get<VideoAIData>(`/api/videos/${videoAIDataId}`);
    },
    enabled: !!videoAIDataId
  });

  // Set or clear preview data for mobile panel
  useEffect(() => {
    if (!videoAIDataId) {
      clearVideoPreview();
      return;
    }
    if (videoData) {
      setVideoPreviewData(transformToPreviewData(videoData), videoAIDataId, videoData);
    }
  }, [videoAIDataId, videoData, setVideoPreviewData, clearVideoPreview]);

  // Desktop: redirect to editor when generation is ready. Mobile: show preview panel, no auto-redirect.
  useEffect(() => {
    if (videoAIDataId && isDesktop) {
      navigate(`/videos/${videoAIDataId}`);
    }
  }, [videoAIDataId, isDesktop, navigate]);

  // Track which initial message we've already sent to prevent duplicates
  const sentInitialMessageRef = useRef<string | null>(null);

  // Auto-send initial message when arriving from preuser-prompt (onboarding)
  useEffect(() => {
    // Only proceed if we have an initial message, no chatId, and haven't sent this specific message yet
    if (initialMessage && !chatId && sentInitialMessageRef.current !== initialMessage) {
      sentInitialMessageRef.current = initialMessage;
      hasAutoSentRef.current = true;
      sendMessage(initialMessage);
      navigate('/', { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage, chatId]); // sendMessage and navigate are stable functions, intentionally excluded to prevent duplicate chat creation

  // Action-type handler registry: backend sends action types, we map to callbacks (and optional icons)
  const actionHandlers = useMemo(
    () =>
      ({
        voice_select: () => setIsVoiceModalOpen(true)
        // future: library_select, music_choose, etc.
      }) as Record<string, () => void>,
    []
  );
  const actionIcons: Record<string, typeof HiMicrophone> = useMemo(
    () => ({ voice_select: HiMicrophone }),
    []
  );

  // Convert message.actions (from backend) into ChatAction[] for ChatActionButtons; skip completed actions
  const getActionsForMessage = useCallback(
    (message: { actions?: Array<{ type: string; label: string; completed?: boolean }> }): ChatAction[] | undefined => {
      const actions = message.actions?.filter(a => !a.completed) ?? [];
      if (actions.length === 0) return undefined;
      const out: ChatAction[] = [];
      for (const a of actions) {
        const onClick = actionHandlers[a.type];
        if (!onClick) continue;
        out.push({
          key: a.type,
          label: a.label,
          onClick,
          icon: actionIcons[a.type]
        });
      }
      return out.length ? out : undefined;
    },
    [actionHandlers, actionIcons]
  );

  // Handle voice selection
  const handleVoiceSelect = useCallback(
    (voiceId: string) => {
      setIsVoiceModalOpen(false);
      sendMessage("I've selected a voice, let's create the video!", { voiceId });
    },
    [sendMessage]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const suggestions = [
    'Create a video about World War II',
    'Edutainment video on archery history',
    'Cool video on esoteric magic'
  ];

  return (
    <Flex direction="column" h="100%" minH={0} position="relative">
      {/* Messages area */}
      <Box flex="1" minH={0} overflowY="auto" px={4}>
        <Container maxW="900px" py={8}>
          {isLoadingConversation ? (
            <VStack spacing={4} py={{ base: 10, md: 20 }} justify="center" minH="200px">
              <LoadingIndicator status="Loading conversation..." />
            </VStack>
          ) : messages.length === 0 ? (
            <VStack spacing={8} py={{ base: 10, md: 20 }} textAlign="center">
              {/* Icon */}
              <Box
                p={5}
                borderRadius="24px"
                bg="whiteAlpha.100"
                border="1px solid"
                borderColor="whiteAlpha.200"
              >
                <Icon as={BiSolidVideoPlus} boxSize={12} color="teal.200" />
              </Box>

              {/* Heading */}
              <VStack spacing={3}>
                <Heading
                  size="xl"
                  color="white"
                  fontFamily="Outfit, sans-serif"
                  fontWeight="600"
                >
                  Create videos with AI
                </Heading>
                <Text
                  color="whiteAlpha.600"
                  maxW="lg"
                  fontSize="md"
                  lineHeight="1.7"
                >
                  Describe what you want to create and I'll help you generate professional videos.
                  Just tell me your idea and let's get started.
                </Text>
              </VStack>

              {/* Suggestions */}
              <VStack spacing={4} pt={4}>
                <HStack spacing={2} align="center">
                  <Icon as={HiSparkles} color="teal.200" boxSize={4} />
                  <Text color="whiteAlpha.500" fontSize="sm" fontWeight="500">
                    Try one of these
                  </Text>
                </HStack>
                <Flex gap={3} flexWrap="wrap" justify="center">
                  {suggestions.map((suggestion, i) => (
                    <SuggestionChip
                      key={i}
                      text={suggestion}
                      onClick={() => sendMessage(suggestion)}
                    />
                  ))}
                </Flex>
              </VStack>
            </VStack>
          ) : (
            <VStack spacing={0} align="stretch">
              {messages.filter((message) => message.content).map(message => (
                <ChatMessageComponent
                  key={message.id}
                  message={message}
                  actions={getActionsForMessage(message)}
                />
              ))}
              {isLoading && <LoadingIndicator status={currentStatus} />}
              <div ref={messagesEndRef} />
            </VStack>
          )}
        </Container>
      </Box>

      {/* Input area */}
      <ChatInput onSend={(msg) => sendMessage(msg)} isLoading={isLoading} />

      {/* Voice Selection Modal */}
      <VoiceSelectorModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onSelectVoice={handleVoiceSelect}
        voices={voices}
        initialVoiceId={workflowState?.voiceId}
      />
    </Flex>
  );
};
