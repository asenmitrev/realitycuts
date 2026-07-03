import { FC, useState, KeyboardEvent, useRef, useEffect } from 'react';
import { Box, Textarea, IconButton, Flex, Text } from '@chakra-ui/react';
import { IoSend } from 'react-icons/io5';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export const ChatInput: FC<ChatInputProps> = ({ onSend, isLoading }) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleSend = () => {
    const trimmed = message.trim();
    if (trimmed && !isLoading) {
      onSend(trimmed);
      setMessage('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box
      position="sticky"
      bottom={0}
      bg="linear-gradient(to top, rgb(17, 24, 39) 70%, transparent)"
      pt={10}
      pb={6}
      px={4}
    >
      <Box maxW="900px" mx="auto">
        <Flex
          bg="whiteAlpha.100"
          borderRadius="16px"
          border="1px solid"
          borderColor="whiteAlpha.200"
          p={2}
          align="flex-end"
          gap={2}
          transition="all 0.2s"
          _focusWithin={{
            borderColor: '#448eff',
            boxShadow: '0 0 0 1px #448eff'
          }}
        >
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the video you want to create..."
            resize="none"
            minH="44px"
            maxH="200px"
            rows={1}
            border="none"
            bg="transparent"
            _focus={{ border: 'none', boxShadow: 'none' }}
            _placeholder={{ color: 'whiteAlpha.400' }}
            color="white"
            fontSize="md"
            px={3}
            py={2}
            disabled={isLoading}
            sx={{
              '&::-webkit-scrollbar': {
                width: '6px'
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent'
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'whiteAlpha.300',
                borderRadius: '3px'
              }
            }}
          />
          <IconButton
            aria-label="Send message"
            icon={<IoSend size={18} />}
            onClick={handleSend}
            isLoading={isLoading}
            isDisabled={!message.trim() || isLoading}
            bg="linear-gradient(135deg, #22D0FF 0%, #0097ff 100%)"
            color="white"
            borderRadius="12px"
            size="md"
            h="44px"
            w="44px"
            _hover={{
              bg: 'linear-gradient(135deg, #1bc4f0 0%, #0088ee 100%)',
              transform: 'scale(1.02)'
            }}
            _disabled={{
              bg: 'whiteAlpha.200',
              color: 'whiteAlpha.400',
              cursor: 'not-allowed',
              _hover: { transform: 'none' }
            }}
            transition="all 0.2s"
          />
        </Flex>
        <Text
          textAlign="center"
          mt={3}
          fontSize="xs"
          color="whiteAlpha.400"
        >
          Press Enter to send · Shift+Enter for new line
        </Text>
      </Box>
    </Box>
  );
};
