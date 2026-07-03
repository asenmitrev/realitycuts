import { FC } from 'react';
import { Box, Flex, Text, Icon } from '@chakra-ui/react';
import Markdown from 'react-markdown';
import { ChatMessage as ChatMessageType } from './types';
import { ChatActionButtons, ChatAction } from './ChatActionButtons';
import { FaUser } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';

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

/**
 * Get beautified agent name from enum value
 */
function getAgentDisplayName(agent: string | null | undefined): string | null {
  if (!agent) return null;
  return agentDisplayNames[agent.toLowerCase()] || agent;
}

interface ChatMessageProps {
  message: ChatMessageType;
  /** Optional action buttons rendered below the message bubble */
  actions?: ChatAction[];
}

export const ChatMessageComponent: FC<ChatMessageProps> = ({ message, actions }) => {
  const isUser = message.role === 'user';

  return (
    <Flex
      w="100%"
      justify={isUser ? 'flex-end' : 'flex-start'}
      mb={4}
    >
      <Flex
        maxW={{ base: '95%', md: '80%', lg: '70%' }}
        direction="column"
      >
        <Flex
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
            <Box
              className="chat-markdown"
              fontSize="md"
              color="white"
              lineHeight="1.6"
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
                  fontFamily: 'mono',
                },
                '& pre': {
                  bg: 'whiteAlpha.100',
                  p: 3,
                  borderRadius: 'md',
                  overflowX: 'auto',
                  mb: 2,
                  '& code': { bg: 'transparent', p: 0 },
                },
                '& h1, & h2, & h3, & h4': {
                  fontWeight: 'bold',
                  mb: 2,
                  mt: 2,
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
                  color: 'whiteAlpha.700',
                },
                '& hr': {
                  borderColor: 'whiteAlpha.200',
                  my: 3,
                },
                '& strong': { fontWeight: 'bold' },
                '& em': { fontStyle: 'italic' },
              }}
            >
              <Markdown>{message.content}</Markdown>
            </Box>
            <Flex
              mt={2}
              fontSize="xs"
              color="whiteAlpha.400"
              justify={isUser ? 'flex-end' : 'space-between'}
              align="center"
              gap={2}
            >
              {message.agentUsed && (
                <Text
                  color="whiteAlpha.500"
                  fontWeight="medium"
                >
                  {getAgentDisplayName(message.agentUsed)}
                </Text>
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

        {/* Action buttons anchored to this message */}
        {actions && actions.length > 0 && (
          <Box ml="48px">
            <ChatActionButtons actions={actions} />
          </Box>
        )}
      </Flex>
    </Flex>
  );
};
