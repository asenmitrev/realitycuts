import { FC, useMemo } from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Button,
  Flex,
  Spinner,
  Card,
  CardBody,
  CardHeader,
  Badge,
  Icon,
  Divider,
  Code,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Spacer
} from '@chakra-ui/react';
import { useQuery } from 'react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useApiService } from '../../hooks/useApiService';
import { FiArrowLeft, FiUser, FiClock, FiMessageSquare, FiVideo, FiSettings } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { FaUser } from 'react-icons/fa';
import { VideoPreviewPlayer } from '../chat/VideoPreviewPlayer';
import { VideoPreviewData } from '../chat/types';
import { VideoAIData } from '../../types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  agentUsed?: string | null;
}

interface WorkflowState {
  requestedTopic?: string;
  generatedScript?: string;
  scriptConfirmed?: boolean;
  libraryIds?: string[];
  voiceId?: string;
  footageDecision?: string;
  footageFetchStatus?: string;
  videoAIDataId?: string;
  audioUrl?: string;
}

interface ConversationDetail {
  _id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  workflowState?: WorkflowState;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ConversationResponse {
  conversation: ConversationDetail;
}

/**
 * Maps agent enum values to human-readable display names
 */
const agentDisplayNames: Record<string, string> = {
  orchestrator: 'Assistant',
  footage_validation: 'Footage Validator',
  scriptwriter: 'Script Writer',
  footage_search: 'Footage Search',
  footage_fetcher: 'Footage Fetcher',
  video_overlay: 'Video Overlay'
};

function getAgentDisplayName(agent: string | null | undefined): string | null {
  if (!agent) return null;
  return agentDisplayNames[agent.toLowerCase()] || agent;
}

/**
 * Transform VideoAIData to VideoPreviewData format
 */
const transformToPreviewData = (videoData: VideoAIData): VideoPreviewData => ({
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
});

/**
 * Read-only chat message component for admin viewing
 */
const AdminChatMessage: FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <Flex w="100%" justify={isUser ? 'flex-end' : 'flex-start'} mb={4}>
      <Flex
        maxW={{ base: '95%', md: '80%', lg: '70%' }}
        direction={isUser ? 'row-reverse' : 'row'}
        align="flex-start"
        gap={3}
      >
        {/* Avatar */}
        <Flex
          w="36px"
          h="36px"
          borderRadius="10px"
          bg={isUser ? 'whiteAlpha.200' : 'linear-gradient(135deg, #22D0FF 0%, #0097ff 100%)'}
          align="center"
          justify="center"
          flexShrink={0}
          border="1px solid"
          borderColor={isUser ? 'whiteAlpha.200' : 'transparent'}
        >
          <Icon
            as={isUser ? FaUser : HiSparkles}
            boxSize={4}
            color={isUser ? 'whiteAlpha.700' : 'white'}
          />
        </Flex>

        {/* Message bubble */}
        <Box
          bg={isUser ? 'whiteAlpha.100' : 'whiteAlpha.50'}
          border="1px solid"
          borderColor={isUser ? 'whiteAlpha.200' : 'whiteAlpha.100'}
          px={4}
          py={3}
          borderRadius="16px"
          borderTopRightRadius={isUser ? '4px' : '16px'}
          borderTopLeftRadius={isUser ? '16px' : '4px'}
        >
          <Text whiteSpace="pre-wrap" fontSize="md" color="white" lineHeight="1.6">
            {message.content}
          </Text>
          <Flex
            mt={2}
            fontSize="xs"
            color="whiteAlpha.400"
            justify={isUser ? 'flex-end' : 'space-between'}
            align="center"
            gap={2}
          >
            {message.agentUsed && (
              <Badge colorScheme="teal" variant="subtle" fontSize="xs">
                {getAgentDisplayName(message.agentUsed)}
              </Badge>
            )}
            <Text>
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

export const AdminChatViewer: FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const apiService = useApiService();

  const { data, isLoading, error } = useQuery<ConversationResponse>({
    queryKey: ['adminChat', chatId],
    queryFn: async () => {
      return apiService.get<ConversationResponse>(`/api/chat/admin/conversations/${chatId}`);
    },
    enabled: !!chatId
  });

  const conversation = data?.conversation;
  const videoAIDataId = conversation?.workflowState?.videoAIDataId;

  // Fetch video data if videoAIDataId exists
  const { data: videoData, isLoading: isLoadingVideo } = useQuery<VideoAIData | null>({
    queryKey: ['adminVideoData', videoAIDataId],
    queryFn: async () => {
      if (!videoAIDataId) return null;
      return apiService.get<VideoAIData>(`/api/videos/${videoAIDataId}`);
    },
    enabled: !!videoAIDataId
  });

  // Transform video data to preview format
  const videoPreviewData = useMemo<VideoPreviewData | null>(() => {
    if (!videoData) return null;
    return transformToPreviewData(videoData);
  }, [videoData]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  if (error) {
    return (
      <Container maxW="container.xl" py={8}>
        <VStack spacing={4}>
          <Heading color="red.500">Error Loading Chat</Heading>
          <Text>Could not load this conversation.</Text>
          <Button onClick={() => navigate('/admin/chats')}>Back to Chat List</Button>
        </VStack>
      </Container>
    );
  }

  if (isLoading || !conversation) {
    return (
      <Container maxW="container.xl" py={8}>
        <Flex justify="center" align="center" minH="400px">
          <Spinner size="xl" color="teal.400" />
        </Flex>
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Flex align="center" wrap="wrap" gap={4}>
          <Button
            leftIcon={<Icon as={FiArrowLeft} />}
            variant="ghost"
            onClick={() => navigate('/admin/chats')}
          >
            Back to Chats
          </Button>
          <Spacer />
          <Badge colorScheme={conversation.isActive ? 'green' : 'red'} fontSize="sm" px={3} py={1}>
            {conversation.isActive ? 'Active' : 'Deleted'}
          </Badge>
        </Flex>

        {/* Chat Info Card */}
        <Card>
          <CardHeader pb={2}>
            <VStack align="start" spacing={2}>
              <Heading size="lg" color="white">
                {conversation.title || 'Untitled Conversation'}
              </Heading>
              <HStack spacing={4} flexWrap="wrap">
                <HStack color="gray.400" fontSize="sm">
                  <Icon as={FiUser} />
                  <Code fontSize="sm">{conversation.userId}</Code>
                </HStack>
                <HStack color="gray.400" fontSize="sm">
                  <Icon as={FiMessageSquare} />
                  <Text>{conversation.messages.length} messages</Text>
                </HStack>
                <HStack color="gray.400" fontSize="sm">
                  <Icon as={FiClock} />
                  <Text>Created {formatDate(conversation.createdAt)}</Text>
                </HStack>
              </HStack>
            </VStack>
          </CardHeader>
        </Card>

        {/* Workflow State (if present) */}
        {conversation.workflowState && Object.keys(conversation.workflowState).some(
          k => conversation.workflowState?.[k as keyof WorkflowState]
        ) && (
            <Accordion allowToggle>
              <AccordionItem border="1px solid" borderColor="whiteAlpha.200" borderRadius="md">
                <AccordionButton>
                  <HStack flex="1" textAlign="left">
                    <Icon as={FiSettings} color="teal.400" />
                    <Text fontWeight="medium">Workflow State</Text>
                  </HStack>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel pb={4}>
                  <VStack align="stretch" spacing={3}>
                    {conversation.workflowState.requestedTopic && (
                      <Box>
                        <Text fontSize="sm" color="gray.400" mb={1}>Requested Topic</Text>
                        <Text>{conversation.workflowState.requestedTopic}</Text>
                      </Box>
                    )}
                    {conversation.workflowState.generatedScript && (
                      <Box>
                        <Text fontSize="sm" color="gray.400" mb={1}>Generated Script</Text>
                        <Box bg="whiteAlpha.100" p={3} borderRadius="md">
                          <Text whiteSpace="pre-wrap" fontSize="sm">
                            {conversation.workflowState.generatedScript}
                          </Text>
                        </Box>
                      </Box>
                    )}
                    <HStack spacing={4} flexWrap="wrap">
                      {conversation.workflowState.scriptConfirmed !== undefined && (
                        <Badge colorScheme={conversation.workflowState.scriptConfirmed ? 'green' : 'yellow'}>
                          Script {conversation.workflowState.scriptConfirmed ? 'Confirmed' : 'Pending'}
                        </Badge>
                      )}
                      {conversation.workflowState.footageDecision && (
                        <Badge colorScheme="blue">
                          Footage: {conversation.workflowState.footageDecision}
                        </Badge>
                      )}
                      {conversation.workflowState.footageFetchStatus && (
                        <Badge colorScheme="purple">
                          Fetch: {conversation.workflowState.footageFetchStatus}
                        </Badge>
                      )}
                    </HStack>
                    {conversation.workflowState.videoAIDataId && (
                      <HStack>
                        <Icon as={FiVideo} color="green.400" />
                        <Text fontSize="sm">Video ID: </Text>
                        <Code fontSize="sm">{conversation.workflowState.videoAIDataId}</Code>
                        <Button
                          size="xs"
                          colorScheme="teal"
                          variant="outline"
                          onClick={() => navigate(`/videos/${conversation.workflowState?.videoAIDataId}`)}
                        >
                          View Video
                        </Button>
                      </HStack>
                    )}
                    {conversation.workflowState.libraryIds && conversation.workflowState.libraryIds.length > 0 && (
                      <Box>
                        <Text fontSize="sm" color="gray.400" mb={1}>Library IDs</Text>
                        <HStack flexWrap="wrap">
                          {conversation.workflowState.libraryIds.map((id, i) => (
                            <Code key={i} fontSize="xs">{id}</Code>
                          ))}
                        </HStack>
                      </Box>
                    )}
                  </VStack>
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
          )}

        {/* Video Preview */}
        {videoAIDataId && (
          <Card>
            <CardHeader>
              <HStack>
                <Icon as={FiVideo} color="teal.400" />
                <Heading size="md">Video Preview</Heading>
              </HStack>
            </CardHeader>
            <Divider borderColor="whiteAlpha.200" />
            <CardBody>
              {isLoadingVideo ? (
                <Flex justify="center" align="center" minH="400px">
                  <Spinner size="xl" color="teal.400" />
                </Flex>
              ) : videoPreviewData ? (
                <Box maxW="400px" mx="auto">
                  <VideoPreviewPlayer
                    data={videoPreviewData}
                    videoAIDataId={videoAIDataId}
                    fullVideoData={videoData || null}
                  />
                </Box>
              ) : (
                <Flex justify="center" align="center" minH="200px">
                  <Text color="gray.500">Video preview not available</Text>
                </Flex>
              )}
            </CardBody>
          </Card>
        )}

        {/* Messages */}
        <Card>
          <CardHeader>
            <HStack>
              <Icon as={FiMessageSquare} color="teal.400" />
              <Heading size="md">Conversation</Heading>
            </HStack>
          </CardHeader>
          <Divider borderColor="whiteAlpha.200" />
          <CardBody>
            {conversation.messages.length === 0 ? (
              <Flex justify="center" align="center" minH="200px">
                <Text color="gray.500">No messages in this conversation</Text>
              </Flex>
            ) : (
              <VStack spacing={0} align="stretch">
                {conversation.messages.map((message, index) => (
                  <AdminChatMessage key={index} message={message} />
                ))}
              </VStack>
            )}
          </CardBody>
        </Card>

        {/* Footer info */}
        <Flex justify="center">
          <Text fontSize="sm" color="gray.500">
            Last updated: {formatDate(conversation.updatedAt)}
          </Text>
        </Flex>
      </VStack>
    </Container>
  );
};
