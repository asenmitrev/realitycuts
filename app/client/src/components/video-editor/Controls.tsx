import type { FC } from 'react';
import { FaPlay, FaPause, FaMusic, FaUndo, FaRedo } from 'react-icons/fa';
import { TbMultiplier1X, TbMultiplier2X, TbMultiplier15X } from 'react-icons/tb';
import {
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Text,
  useBreakpointValue,
  Tooltip,
  MenuButton,
  Menu,
  MenuList,
  Box,
  HStack,
  IconButton,
  Flex
} from '@chakra-ui/react';
import { GiSoundOff, GiSoundOn } from 'react-icons/gi';
import { FaSync } from 'react-icons/fa';
import type { Audio } from '../../types';
import { BiCaptions } from 'react-icons/bi';
import { IoPhoneLandscapeOutline, IoPhonePortraitOutline } from 'react-icons/io5';
import { MdFullscreen, MdFullscreenExit } from 'react-icons/md';
import { useVideoEditorStore } from '../../stores/video-editor/store';

const FormattedTime: FC<{ duration: number }> = ({ duration }) => {
  const currentTime = useVideoEditorStore(state => state.currentTime);
  return (
    <Text flexShrink="0" fontSize="sm" fontFamily="mono">
      {new Date(Math.ceil(currentTime) * 1000).toISOString().substr(11, 8)} /{' '}
      {new Date(Math.ceil(duration) * 1000).toISOString().substr(11, 8)}
    </Text>
  );
};

const SimpleSlider = ({ duration, onSeek }: { duration: number; onSeek: (v: number) => void }) => {
  const currentTime = useVideoEditorStore(state => state.currentTime);

  return (
    <Slider aria-label="video-progress" value={currentTime} min={0} max={duration} onChange={onSeek} step={0.1}>
      <SliderTrack>
        <SliderFilledTrack />
      </SliderTrack>
      <SliderThumb height={3} width={3} />
    </Slider>
  );
};

interface ControlsProps {
  isPlaying: boolean;
  onTogglePlayPause: () => void;
  onToggleVideoEnabled?: () => void;
  onToggleAudioEnabled?: () => void;
  onToggleAudio?: () => void;
  onChangeVolume: (volume: number) => void;
  onOpenCaptionSettings: () => void;
  onToggleOrientation?: () => void;
  onReplaceAudio: (audio: Audio[]) => void;
  setPlaybackRate: (rate: number) => void;
  isLandscape: boolean;
  playbackRate: number;
  volume: number;
  duration: number;
  audioEnabled: boolean;
  onSeek: (v: number | number[]) => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}
export const Controls: FC<ControlsProps> = ({
  isPlaying,
  onSeek,
  onTogglePlayPause,
  onToggleAudio,
  onOpenCaptionSettings,
  duration,
  volume,
  playbackRate,
  setPlaybackRate,
  isLandscape,
  onChangeVolume,
  onToggleOrientation,
  onToggleAudioEnabled,
  audioEnabled,
  onToggleFullscreen,
  isFullscreen = false,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false
}) => {
  const playPauseSize = useBreakpointValue({ base: 16, md: 20 });
  const toggleBrollSize = useBreakpointValue({ base: 19, md: 30 });

  return (
    <Box
      bgGradient="linear(to-t, whiteAlpha.200, transparent)"
      display="flex"
      width="100%"
      position="absolute"
      bottom={0}
      borderRadius="lg"
      left={0}
      right={0}
      zIndex={100}
      flexDirection="column"
      alignItems="stretch"
      justifyContent="center"
      pb={2}
    >
      {/* Progress slider at the top */}
      <Box px={4} pb={1}>
        <SimpleSlider duration={duration} onSeek={onSeek} />
      </Box>

      <Flex align="center" justify="space-between" color="white" px={4}>
        <HStack spacing={4}>
          <IconButton
            aria-label={isPlaying ? 'Pause' : 'Play'}
            icon={isPlaying ? <FaPause /> : <FaPlay />}
            variant="ghost"
            size="sm"
            _hover={{ bg: 'whiteAlpha.200' }}
            onClick={e => {
              (e.currentTarget as HTMLElement).blur();
              onTogglePlayPause();
            }}
          />
          {/* Audio controls with menu */}
          {onToggleAudioEnabled && (
            <Menu placement="top-end" size="2xl">
              <MenuButton
                as={IconButton}
                size="sm"
                variant="ghost"
                icon={<FaMusic size={16} />}
                _hover={{ bg: 'whiteAlpha.200' }}
              />
              <MenuList w="300px">
                <Box px={4} display="flex" gap={3} alignItems="center" cursor="pointer">
                  <Tooltip label="Enable/disable background music">
                    <Box onClick={() => onToggleAudioEnabled()}>
                      {audioEnabled ? <GiSoundOff size={toggleBrollSize} /> : <GiSoundOn size={toggleBrollSize} />}
                    </Box>
                  </Tooltip>
                  {onToggleAudio && (
                    <Tooltip label="Reset background music">
                      <Box onClick={() => onToggleAudio()}>
                        <FaSync size={16} />
                      </Box>
                    </Tooltip>
                  )}
                  <Slider
                    aria-label="slider-ex-1"
                    defaultValue={0}
                    value={volume}
                    step={0.01}
                    min={0}
                    max={0.3}
                    onChange={onChangeVolume}
                  >
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb />
                  </Slider>
                </Box>
              </MenuList>
            </Menu>
          )}

          {/* Caption settings */}
          <Tooltip label="Change caption settings">
            <IconButton
              aria-label="open-caption-settings"
              size="sm"
              variant="ghost"
              icon={<BiCaptions size={playPauseSize} />}
              _hover={{ bg: 'whiteAlpha.200' }}
              onClick={e => {
                (e.currentTarget as HTMLElement).blur();
                onOpenCaptionSettings();
              }}
            />
          </Tooltip>

          {/* Orientation toggle */}
          {onToggleOrientation && (
            <Tooltip label="Change orientation">
              <IconButton
                aria-label="toggle-orientation"
                size="sm"
                variant="ghost"
                icon={
                  !isLandscape ? (
                    <IoPhonePortraitOutline size={playPauseSize} />
                  ) : (
                    <IoPhoneLandscapeOutline size={playPauseSize} />
                  )
                }
                _hover={{ bg: 'whiteAlpha.200' }}
                onClick={e => {
                  (e.currentTarget as HTMLElement).blur();
                  onToggleOrientation();
                }}
              />
            </Tooltip>
          )}

          {/* Playback speed control */}
          <Tooltip label="Increase playback speed">
            <Box
              cursor="pointer"
              onClick={e => {
                (e.target as HTMLElement).blur();
                setPlaybackRate(playbackRate === 1.0 ? 1.5 : playbackRate === 1.5 ? 2.0 : 1.0);
              }}
              className="playback-speed-control"
              _hover={{ opacity: 0.7 }}
            >
              {playbackRate === 1.5 ? (
                <TbMultiplier15X color="white" size={toggleBrollSize} />
              ) : playbackRate === 1.0 ? (
                <TbMultiplier1X color="white" size={toggleBrollSize} />
              ) : (
                <TbMultiplier2X color="white" size={toggleBrollSize} />
              )}
            </Box>
          </Tooltip>
        </HStack>

        <HStack spacing={4}>
          {onUndo && (
            <Tooltip label="Undo">
              <IconButton
                aria-label="undo-edit"
                icon={<FaUndo />}
                variant="ghost"
                size="sm"
                _hover={{ bg: 'whiteAlpha.200' }}
                onClick={onUndo}
                isDisabled={!canUndo}
              />
            </Tooltip>
          )}
          {onRedo && (
            <Tooltip label="Redo">
              <IconButton
                aria-label="redo-edit"
                icon={<FaRedo />}
                variant="ghost"
                size="sm"
                _hover={{ bg: 'whiteAlpha.200' }}
                onClick={onRedo}
                isDisabled={!canRedo}
              />
            </Tooltip>
          )}
          <FormattedTime duration={duration} />

          {/* Fullscreen toggle */}
          {onToggleFullscreen && (
            <Tooltip label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
              <IconButton
                aria-label={isFullscreen ? 'exit-fullscreen' : 'enter-fullscreen'}
                size="sm"
                variant="ghost"
                icon={isFullscreen ? <MdFullscreenExit size={playPauseSize} /> : <MdFullscreen size={playPauseSize} />}
                _hover={{ bg: 'whiteAlpha.200' }}
                onClick={e => {
                  (e.currentTarget as HTMLElement).blur();
                  onToggleFullscreen();
                }}
              />
            </Tooltip>
          )}
        </HStack>
      </Flex>
    </Box>
  );
};
