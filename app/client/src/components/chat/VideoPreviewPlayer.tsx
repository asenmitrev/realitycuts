import { FC, useCallback, useEffect } from 'react';
import { Box, Button, Flex, IconButton, Spinner, Text } from '@chakra-ui/react';
import { FaPlay, FaPause } from 'react-icons/fa';
import { VideoPreviewData } from './types';
import { useVideoPreview } from './useVideoPreview';
import { VideoAIData } from '../../types';
import { RegistrationModal } from './RegistrationModal';

interface VideoPreviewPlayerProps {
  data: VideoPreviewData;
  videoAIDataId?: string | null;
  fullVideoData?: VideoAIData | null;
  onEnded?: () => void;
}

/**
 * Video Preview Player Component
 * 
 * Plays voiceover audio with stacked video clips that switch based on timing.
 * Uses opacity toggling instead of src swapping to avoid buffering.
 */
export const VideoPreviewPlayer: FC<VideoPreviewPlayerProps> = ({ data, videoAIDataId, fullVideoData, onEnded }) => {
  const {
    clips,
    currentClipIndex,
    isPlaying,
    isReady,
    isCompleted,
    isFinalizing,
    showRegistrationModal,
    onCloseRegistrationModal,
    toggle,
    reset,
    audioRef,
    musicAudioRef,
    videoRefs,
    handleTimeUpdate,
    handleAudioEnded,
    handleVideoReady,
    handleViewComplete,
    handleGoToVideo
  } = useVideoPreview({ data, videoAIDataId, fullVideoData, onEnded });

  // Check if video has been finalized (has source)
  const hasSource = fullVideoData?.source?.url != null;

  // Set video ref at specific index
  const setVideoRef = useCallback((index: number) => (el: HTMLVideoElement | null) => {
    videoRefs.current[index] = el;
  }, [videoRefs]);

  // iOS Safari fallback: Check video readyState directly after mount
  // iOS Safari often doesn't fire loadeddata events for muted videos
  useEffect(() => {
    if (clips.length === 0) return;

    // Check readyState after a short delay to allow videos to start loading
    const checkReadyState = () => {
      videoRefs.current.forEach((video, index) => {
        if (video && video.readyState >= 2) {
          // HAVE_CURRENT_DATA or higher means video has loaded enough data
          handleVideoReady(index);
        }
      });
    };

    // Check immediately and after a delay (iOS may need time)
    const timeoutId = setTimeout(checkReadyState, 100);
    const timeoutId2 = setTimeout(checkReadyState, 500);
    const timeoutId3 = setTimeout(checkReadyState, 1000);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
    };
  }, [clips.length, handleVideoReady, videoRefs]);

  if (clips.length === 0) {
    return (
      <Flex
        w="100%"
        aspectRatio="9/16"
        bg="blackAlpha.400"
        borderRadius="12px"
        align="center"
        justify="center"
        color="whiteAlpha.500"
        fontSize="sm"
      >
        No clips available
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap={3} w="100%">
      <Box
        position="relative"
        w="100%"
        aspectRatio="9/16"
        bg="black"
        borderRadius="12px"
        overflow="hidden"
      >
        {/* Hidden audio element - drives the timing */}
        <audio
          ref={audioRef}
          src={data.voiceOver}
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleAudioEnded}
          style={{ display: 'none' }}
        />

        {/* Background music - plays alongside voiceover when audioEnabled */}
        {fullVideoData?.audioEnabled &&
          fullVideoData?.audio?.[fullVideoData.audioIndex ?? 0] && (
            <audio
              ref={musicAudioRef}
              src={fullVideoData.audio[fullVideoData.audioIndex ?? 0].preview}
              preload="auto"
              style={{ display: 'none' }}
            />
          )}

        {/* Stacked video or image elements - all preload, only one visible at a time */}
        {clips.map((clip, index) =>
          clip.brollType === 'AI_PHOTO' ? (
            <Box
              as="img"
              key={`${clip.url}-${index}`}
              src={clip.url}
              alt=""
              onLoad={() => handleVideoReady(index)}
              position="absolute"
              top={0}
              left={0}
              w="100%"
              h="100%"
              objectFit="cover"
              opacity={index === currentClipIndex ? 1 : 0}
              transition="opacity 0.15s ease-in-out"
              pointerEvents="none"
            />
          ) : (
            <Box
              as="video"
              key={`${clip.url}-${index}`}
              ref={setVideoRef(index)}
              src={clip.url}
              muted
              playsInline
              loop
              preload="auto"
              onLoadedMetadata={() => handleVideoReady(index)}
              onLoadedData={() => handleVideoReady(index)}
              onCanPlay={() => handleVideoReady(index)}
              onCanPlayThrough={() => handleVideoReady(index)}
              position="absolute"
              top={0}
              left={0}
              w="100%"
              h="100%"
              objectFit="cover"
              opacity={index === currentClipIndex ? 1 : 0}
              transition="opacity 0.15s ease-in-out"
              pointerEvents="none"
            />
          )
        )}

        {/* Completed overlay - Replay option */}
        {isCompleted ? (
          <Flex
            position="absolute"
            inset={0}
            direction="column"
            align="center"
            justify="center"
            bg="blackAlpha.700"
            gap={4}
          >
            <Text color="white" fontSize="md" fontWeight="600">
              Preview complete
            </Text>
            <Button
              variant="ghost"
              color="whiteAlpha.700"
              size="sm"
              onClick={reset}
              _hover={{ color: 'white', bg: 'whiteAlpha.200' }}
            >
              Replay preview
            </Button>
          </Flex>
        ) : (
          /* Play/Pause button overlay */
          <Flex
            position="absolute"
            inset={0}
            align="center"
            justify="center"
            bg={isPlaying ? 'transparent' : 'blackAlpha.400'}
            transition="background 0.2s ease"
            cursor="pointer"
            onClick={toggle}
            _hover={{
              bg: isPlaying ? 'blackAlpha.200' : 'blackAlpha.500'
            }}
          >
            {!isReady ? (
              <Spinner size="lg" color="white" thickness="3px" />
            ) : (
              <IconButton
                aria-label={isPlaying ? 'Pause' : 'Play'}
                icon={isPlaying ? <FaPause /> : <FaPlay />}
                size="lg"
                variant="solid"
                colorScheme="whiteAlpha"
                bg="whiteAlpha.300"
                color="white"
                borderRadius="full"
                w="64px"
                h="64px"
                fontSize="24px"
                opacity={isPlaying ? 0 : 1}
                transform={isPlaying ? 'scale(0.8)' : 'scale(1)'}
                transition="all 0.2s ease"
                _hover={{
                  bg: 'whiteAlpha.400',
                  transform: 'scale(1.1)'
                }}
                _active={{
                  transform: 'scale(0.95)'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle();
                }}
              />
            )}
          </Flex>
        )}

        {/* Clip indicator dots */}
        <Flex
          position="absolute"
          bottom={3}
          left="50%"
          transform="translateX(-50%)"
          gap={1.5}
        >
          {clips.map((_, index) => (
            <Box
              key={index}
              w="6px"
              h="6px"
              borderRadius="full"
              bg={index === currentClipIndex ? 'white' : 'whiteAlpha.500'}
              transition="background 0.15s ease"
            />
          ))}
        </Flex>
      </Box>

      {/* Finalize button or Go to Video button - always visible below the video */}
      {hasSource ? (
        <Button
          colorScheme="teal"
          size="lg"
          w="100%"
          onClick={handleGoToVideo}
          isDisabled={!videoAIDataId}
        >
          Go to Video
        </Button>
      ) : (
        <Button
          colorScheme="teal"
          size="lg"
          w="100%"
          onClick={handleViewComplete}
          isLoading={isFinalizing}
          loadingText="Starting..."
          isDisabled={!videoAIDataId}
        >
          Finish Generating
        </Button>
      )}

      <RegistrationModal
        isOpen={showRegistrationModal}
        onClose={onCloseRegistrationModal}
      />
    </Flex>
  );
};
