import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Text,
  Spinner,
  Image,
  IconButton,
  HStack,
  Code,
  Checkbox,
  useColorModeValue,
  Badge,
  Tooltip
} from '@chakra-ui/react';
import { FaPlay, FaTrash, FaInfo, FaSearch } from 'react-icons/fa';
import {
  DEPTH_OF_FIELD_CATEGORIES_REVERSE,
  CAMERA_ANGLE_CATEGORIES_REVERSE,
  FRAMING_CATEGORIES_REVERSE,
  PERSPECTIVE_CATEGORIES_REVERSE,
  IBrollFootageMetadata,
  VideoCategorizationMetadata,
  COMPLEXITY_CATEGORIES_REVERSE,
  FOCUS_POSITION_CATEGORIES_REVERSE
} from '../../types';
import { VideoAlternative } from '../../types';

interface LibraryItemProps {
  item: IBrollFootageMetadata | VideoAlternative;
  videoUrl: string;
  isOwner: boolean;
  deleteId: string;
  onDelete: (itemId: string) => Promise<void>;
  isAdmin: boolean;
  isSelected: boolean;
  onSelectionChange: (itemId: string, selected: boolean) => void;
  onFindSimilar?: (itemId: string) => Promise<void>;
}

export const LibraryItem = memo<LibraryItemProps>(
  ({ item, videoUrl, isOwner, deleteId, onDelete, isAdmin, isSelected, onSelectionChange, onFindSimilar }) => {
    const [isShowVideo, setIsShowVideo] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isInfoVisible, setIsInfoVisible] = useState(false);
    const [isFindingSimilar, setIsFindingSimilar] = useState(false);
    const borderColor = useColorModeValue('gray.200', 'gray.600');
    const selectedBorderColor = useColorModeValue('blue.500', 'blue.300');
    const selectedBgColor = useColorModeValue('blue.50', 'blue.900');

    const metadata: VideoCategorizationMetadata | null =
      item.framing &&
      item.cameraAngle &&
      item.perspective &&
      item.depthOfField &&
      item.complexity &&
      item.arollBroll &&
      item.focusPosition
        ? {
            framing: item.framing,
            cameraAngle: item.cameraAngle,
            perspective: item.perspective,
            depthOfField: item.depthOfField,
            complexity: item.complexity,
            arollBroll: item.arollBroll,
            focusPosition: item.focusPosition
          }
        : null;

    useEffect(() => {
      if (isShowVideo) {
        setIsLoading(true);
        videoRef.current?.play();
      } else {
        setIsLoading(false);
        videoRef.current?.pause();
      }
    }, [isShowVideo]);

    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
      setIsShowVideo(true);
      setIsLoading(true);
      videoRef.current?.play();
    }, []);

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
      if (!isSelected) {
        setIsShowVideo(false);
        setIsLoading(false);
        videoRef.current?.pause();
      }
    }, [isSelected]);

    const handleDelete = useCallback(async () => {
      try {
        setIsDeleting(true);
        await onDelete(deleteId);
      } finally {
        setIsDeleting(false);
      }
    }, [deleteId, onDelete]);

    const handleInfo = useCallback(() => {
      setIsInfoVisible(prev => !prev);
    }, []);

    const handleFindSimilar = useCallback(async () => {
      if (!onFindSimilar) return;
      try {
        setIsFindingSimilar(true);
        await onFindSimilar(deleteId);
      } finally {
        setIsFindingSimilar(false);
      }
    }, [onFindSimilar, deleteId]);

    const handleItemClick = useCallback(() => {
      if (!isOwner && !isAdmin) {
        return;
      }
      onSelectionChange(deleteId, !isSelected);
    }, [isSelected, deleteId, onSelectionChange, isOwner, isAdmin]);

    const showCheckbox = (isOwner || isAdmin) && (isHovered || isSelected);

    return (
      <Box
        borderWidth="1px"
        borderRadius="lg"
        overflow="hidden"
        borderColor={isSelected ? selectedBorderColor : borderColor}
        bg={isSelected ? selectedBgColor : 'transparent'}
        cursor="pointer"
        onClick={handleItemClick}
        transition="all 0.2s"
        position="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {showCheckbox && (
          <Checkbox
            position="absolute"
            top={2}
            left={2}
            zIndex={300}
            pointerEvents="none"
            isChecked={isSelected}
            size="lg"
            borderColor="yellow.500"
            colorScheme="yellow"
          />
        )}
        <Box position="relative">
          {isLoading && isShowVideo && (
            <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" zIndex={2}>
              <Spinner color="white" />
            </Box>
          )}
          {!isShowVideo ? (
            <Box position="relative">
              <Box
                position="absolute"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                backgroundColor="rgba(0,0,0,0.3)"
                borderRadius="50%"
                padding={4}
              >
                <FaPlay size={24} color="white" />
              </Box>
              <Image
                src={item.thumbnailUrl}
                alt={item.title}
                objectFit="cover"
                w="100%"
                aspectRatio={item.isVertical ? '9/16' : '16/9'}
              />
            </Box>
          ) : (
            <video
              ref={videoRef}
              src={videoUrl}
              muted={true}
              autoPlay={true}
              loop={true}
              style={{ objectFit: 'cover', width: '100%', aspectRatio: item.isVertical ? '9/16' : '16/9' }}
              onPlaying={() => setIsLoading(false)}
            />
          )}
        </Box>
        <Box p={4}>
          <HStack justifyContent="space-between">
            <Text fontWeight="semibold" noOfLines={2} title={item.title}>
              {item.title}{' '}
            </Text>
            <HStack>
              {onFindSimilar && isOwner && !isSelected && (
                <Tooltip label="Find similar videos using vector similarity search" placement="top">
                  <IconButton
                    aria-label="find similar videos"
                    colorScheme="blue"
                    variant="outline"
                    size="sm"
                    icon={<FaSearch />}
                    onClick={e => {
                      e.stopPropagation();
                      handleFindSimilar();
                    }}
                    isLoading={isFindingSimilar}
                  />
                </Tooltip>
              )}
              {isOwner && !isSelected && (
                <IconButton
                  aria-label="delete"
                  colorScheme="red"
                  variant="outline"
                  size="sm"
                  icon={<FaTrash />}
                  onClick={e => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                  isLoading={isDeleting}
                />
              )}
              {metadata && !isSelected && (
                <IconButton
                  aria-label="info"
                  colorScheme="white"
                  variant="outline"
                  size="sm"
                  icon={<FaInfo />}
                  onClick={e => {
                    e.stopPropagation();
                    handleInfo();
                  }}
                />
              )}
            </HStack>
          </HStack>
          {metadata && isInfoVisible && (
            <Code fontSize="sm" color="gray.500" whiteSpace="pre-wrap">
              {`Framing: ${item.framing ? FRAMING_CATEGORIES_REVERSE[item.framing] : 'Unknown'}
Camera Angle: ${item.cameraAngle ? CAMERA_ANGLE_CATEGORIES_REVERSE[item.cameraAngle] : 'Unknown'}
Perspective: ${item.perspective ? PERSPECTIVE_CATEGORIES_REVERSE[item.perspective] : 'Unknown'}
Depth of Field: ${item.depthOfField ? DEPTH_OF_FIELD_CATEGORIES_REVERSE[item.depthOfField] : 'Unknown'}
Complexity: ${item.complexity ? COMPLEXITY_CATEGORIES_REVERSE[item.complexity] : 'Unknown'}
Focus Position: ${item.focusPosition ? FOCUS_POSITION_CATEGORIES_REVERSE[item.focusPosition] : 'Unknown'}
Type (LLM): ${item.arollBroll ? `${item.arollBroll}` : 'Unknown'}${
                'arollBrollHeuristic' in item && item.arollBrollHeuristic
                  ? `
Type (Heuristic): ${item.arollBrollHeuristic}`
                  : ''
              }`}
              {'backgroundMotionScore' in item && item.backgroundMotionScore ? (
                <Badge colorScheme="green">
                  Background Motion Score: ${item.backgroundMotionScore?.toFixed(2) ?? 'N/A'}
                </Badge>
              ) : (
                ''
              )}
              {'mouthMovementScores' in item && item.mouthMovementScores ? (
                <Badge colorScheme="blue">{item.mouthMovementScores.map(score => score.toFixed(2)).join(', ')}</Badge>
              ) : (
                ''
              )}
            </Code>
          )}
          <Text fontSize="sm" color="gray.500">
            Duration: {Math.round(item.duration)} seconds
          </Text>
        </Box>
      </Box>
    );
  }
);

LibraryItem.displayName = 'LibraryItem';
