import { FC, useState } from 'react';
import { Box, Flex, Text, Icon, VStack, IconButton } from '@chakra-ui/react';
import { BiMoviePlay } from 'react-icons/bi';
import { IoClose, IoChevronUp, IoChevronDown } from 'react-icons/io5';
import { VideoPreviewData } from './types';
import { VideoPreviewPlayer } from './VideoPreviewPlayer';
import { VideoAIData } from '../../types';

interface VideoPreviewPanelProps {
  data: VideoPreviewData | null;
  videoAIDataId?: string | null;
  fullVideoData?: VideoAIData | null;
  onClose?: () => void;
}

/**
 * Mobile-only video preview: floating bottom sheet that can be minimized/expanded.
 * Used in chat when a video has been generated (mobile only).
 */
export const VideoPreviewPanel: FC<VideoPreviewPanelProps> = ({ data, videoAIDataId, fullVideoData, onClose }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!data) return null;

  return (
    <Box
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      zIndex={50}
      bg="linear-gradient(180deg, rgba(15, 15, 20, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%)"
      backdropFilter="blur(20px)"
      borderTopRadius="24px"
      boxShadow="0 -4px 30px rgba(0, 0, 0, 0.5), 0 -1px 0 rgba(255, 255, 255, 0.1)"
      transform={isExpanded ? 'translateY(0)' : 'translateY(calc(100% - 72px))'}
      transition="transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
      maxH="85vh"
      overflow="hidden"
      display={{ base: 'block', lg: 'none' }}
    >
      {/* Drag handle / Header */}
      <Flex
        py={3}
        px={4}
        align="center"
        justify="space-between"
        cursor="pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        borderBottom={isExpanded ? '1px solid' : 'none'}
        borderColor="whiteAlpha.100"
      >
        <Box flex={1} display="flex" justifyContent="center" position="absolute" left={0} right={0}>
          <Box w="36px" h="4px" bg="whiteAlpha.300" borderRadius="full" />
        </Box>

        <Flex align="center" gap={2} zIndex={1}>
          <Box p={2} borderRadius="10px" bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)">
            <Icon as={BiMoviePlay} boxSize={4} color="white" />
          </Box>
          <VStack align="start" spacing={0}>
            <Text color="white" fontWeight="600" fontSize="sm">
              Video Preview
            </Text>
            <Text color="whiteAlpha.600" fontSize="xs">
              {isExpanded ? 'Tap to minimize' : 'Tap to expand'}
            </Text>
          </VStack>
        </Flex>

        <Flex gap={1} zIndex={1}>
          <IconButton
            aria-label={isExpanded ? 'Minimize' : 'Expand'}
            icon={isExpanded ? <IoChevronDown size={18} /> : <IoChevronUp size={18} />}
            size="sm"
            variant="ghost"
            colorScheme="whiteAlpha"
            color="white"
            borderRadius="full"
            _hover={{ bg: 'whiteAlpha.200' }}
          />
          {onClose && (
            <IconButton
              aria-label="Close preview"
              icon={<IoClose size={20} />}
              size="sm"
              variant="ghost"
              colorScheme="whiteAlpha"
              color="white"
              borderRadius="full"
              _hover={{ bg: 'whiteAlpha.200' }}
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            />
          )}
        </Flex>
      </Flex>

      <Box
        p={4}
        pb={8}
        display="flex"
        justifyContent="center"
        alignItems="center"
        overflowY="auto"
        maxH="calc(85vh - 72px)"
      >
        <Box w="100%" maxW="280px" mx="auto">
          <VideoPreviewPlayer data={data} videoAIDataId={videoAIDataId} fullVideoData={fullVideoData} />
        </Box>
      </Box>
    </Box>
  );
};
