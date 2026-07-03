import { FC, useState, useRef } from 'react';
import {
  Box,
  VStack,
  Button,
  Text,
  Flex,
  IconButton,
  Spinner,
  Tooltip,
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay
} from '@chakra-ui/react';
import { Link as RouterLink, useParams, useNavigate } from 'react-router-dom';
import { IoAdd, IoTrashOutline } from 'react-icons/io5';
import { IoChatbubbleEllipsesOutline } from 'react-icons/io5';
import { useChatContext } from './ChatContext';

interface ChatSidebarProps {
  isCollapsed?: boolean;
}

export const ChatSidebar: FC<ChatSidebarProps> = ({ isCollapsed = false }) => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { conversations, isLoadingConversations: isLoading, deleteConversation } = useChatContext();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const handleNewChat = () => {
    navigate('/');
  };

  const handleDeleteClick = (e: React.MouseEvent, conversationId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(conversationId);
    onOpen();
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;

    const success = await deleteConversation(deletingId);
    if (success && chatId === deletingId) {
      // If we deleted the current conversation, navigate to new chat
      navigate('/');
    }
    setDeletingId(null);
    onClose();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  if (isCollapsed) {
    return (
      <Box
        w="60px"
        h="100%"
        bg="whiteAlpha.50"
        borderRight="1px solid"
        borderColor="whiteAlpha.100"
        py={4}
        display="flex"
        flexDirection="column"
        alignItems="center"
      >
        <Tooltip label="New Chat" placement="right">
          <IconButton
            aria-label="New chat"
            icon={<IoAdd size={20} />}
            onClick={handleNewChat}
            variant="ghost"
            colorScheme="whiteAlpha"
            color="white"
            borderRadius="10px"
            size="md"
            _hover={{ bg: 'whiteAlpha.200' }}
          />
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box
      w="280px"
      h="100%"
      bg="whiteAlpha.50"
      borderRight="1px solid"
      borderColor="whiteAlpha.100"
      display="flex"
      flexDirection="column"
    >
      {/* Header with New Chat button */}
      <Box p={4} borderBottom="1px solid" borderColor="whiteAlpha.100">
        <Button
          leftIcon={<IoAdd size={20} />}
          onClick={handleNewChat}
          w="100%"
          bg="whiteAlpha.100"
          color="white"
          borderRadius="10px"
          _hover={{ bg: 'whiteAlpha.200' }}
          fontWeight="500"
          size="md"
          style={{
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation'
          }}
        >
          New Chat
        </Button>
      </Box>

      {/* Conversations list */}
      <Box
        flex="1"
        overflowY="auto"
        py={2}
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y'
        }}
      >
        {isLoading ? (
          <Flex justify="center" py={8}>
            <Spinner size="sm" color="whiteAlpha.600" />
          </Flex>
        ) : conversations.length === 0 ? (
          <VStack py={8} spacing={2}>
            <IoChatbubbleEllipsesOutline size={32} color="rgba(255,255,255,0.3)" />
            <Text color="whiteAlpha.400" fontSize="sm" textAlign="center" px={4}>
              No conversations yet. Start a new chat!
            </Text>
          </VStack>
        ) : (
          <VStack spacing={1} align="stretch" px={2}>
            {conversations.map(conversation => {
              const isActive = chatId === conversation._id;
              return (
                <Box
                  key={conversation._id}
                  as={RouterLink}
                  to={`/chats/${conversation._id}`}
                  display="block"
                  px={3}
                  py={2.5}
                  borderRadius="10px"
                  bg={isActive ? 'whiteAlpha.200' : 'transparent'}
                  _hover={{ bg: isActive ? 'whiteAlpha.200' : 'whiteAlpha.100' }}
                  transition="background 0.15s"
                  role="group"
                  position="relative"
                  cursor="pointer"
                  style={{
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation',
                    WebkitTouchCallout: 'none'
                  }}
                  onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                    // Ensure navigation works on iOS
                    e.stopPropagation();
                  }}
                  onTouchStart={(e: React.TouchEvent<HTMLDivElement>) => {
                    // Prevent double-tap zoom and ensure touch works
                    e.stopPropagation();
                  }}
                >
                  <Flex justify="space-between" align="center">
                    <Box flex="1" minW="0" pr={2} pointerEvents="none">
                      <Text
                        color="white"
                        fontSize="sm"
                        fontWeight={isActive ? '500' : '400'}
                        noOfLines={1}
                        title={conversation.title || 'Untitled'}
                      >
                        {conversation.title || 'Untitled'}
                      </Text>
                      <Text
                        color="whiteAlpha.500"
                        fontSize="xs"
                        mt={0.5}
                      >
                        {formatDate(conversation.updatedAt)}
                      </Text>
                    </Box>
                    <IconButton
                      aria-label="Delete conversation"
                      icon={<IoTrashOutline size={14} />}
                      onClick={(e) => handleDeleteClick(e, conversation._id)}
                      variant="ghost"
                      size="xs"
                      color="whiteAlpha.400"
                      opacity={0}
                      _groupHover={{ opacity: 1 }}
                      _hover={{ color: 'red.300', bg: 'whiteAlpha.200' }}
                      transition="all 0.15s"
                      pointerEvents="auto"
                    />
                  </Flex>
                </Box>
              );
            })}
          </VStack>
        )}
      </Box>

      {/* Delete confirmation dialog */}
      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent bg="gray.800" borderRadius="12px">
            <AlertDialogHeader fontSize="lg" fontWeight="600" color="white">
              Delete Conversation
            </AlertDialogHeader>

            <AlertDialogBody color="whiteAlpha.800">
              Are you sure you want to delete this conversation? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter gap={3}>
              <Button
                ref={cancelRef}
                onClick={onClose}
                variant="ghost"
                colorScheme="whiteAlpha"
              >
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={handleConfirmDelete}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};
