import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HighlightSegment } from '../../types';
import { Box, Button, Flex, Slider, SliderFilledTrack, SliderThumb, SliderTrack } from '@chakra-ui/react';
import { FaPlay, FaPause } from 'react-icons/fa';
import { useHotkeys } from 'react-hotkeys-hook';

interface HighlightPlayerProps {
  segments: HighlightSegment[];
  setCurrentTime: (time: number) => void;
  videoUrl: string;
}

export const HighlightPlayer: React.FC<HighlightPlayerProps> = ({ videoUrl, setCurrentTime, segments }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentSegmentIndex = useRef<number>(0);
  const requestIdRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [compositeCurrentTime, setCompositeCurrentTime] = useState<number>(0);
  const duration = useMemo(() => segments.reduce((acc, segment) => acc + (segment.end - segment.start), 0), [segments]);

  const onTogglePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      videoRef.current?.pause();
    } else {
      setIsPlaying(true);
      if (!isInitialized) {
        // If not initialized, play from start
        setIsInitialized(true);
        playSegment(segments[0]);
      } else {
        seekAndPlay(compositeCurrentTime);
      }
    }
  };
  useHotkeys(['Space'], () => {
    onTogglePlayPause();
  });
  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current && isPlaying) {
        const currentSegment = segments[currentSegmentIndex.current];
        const adjustedTime =
          segments
            .slice(0, currentSegmentIndex.current)
            .reduce((acc, segment) => acc + (segment.end - segment.start), 0) +
          (videoRef.current.currentTime - currentSegment.start);
        setCompositeCurrentTime(adjustedTime);
        setCurrentTime(videoRef.current.currentTime);
      }
    }, 1000 / 60); // update approximately every animation frame

    return () => clearInterval(interval);
  }, [segments, setCurrentTime, isPlaying]);

  const playSegment = useCallback(
    function playSegment(segment: HighlightSegment) {
      const video = videoRef.current;

      if (requestIdRef.current !== null) {
        cancelAnimationFrame(requestIdRef.current); // Cancel the previous frame request
      }

      function checkTime() {
        if (video && video.currentTime >= segment.end) {
          // Move to the next segment if it exists
          if (currentSegmentIndex.current + 1 < segments.length) {
            currentSegmentIndex.current = currentSegmentIndex.current + 1;
            playSegment(segments[currentSegmentIndex.current]);
          } else {
            video.pause();
          }
        } else {
          requestIdRef.current = requestAnimationFrame(checkTime);
        }
      }
      if (video) {
        // Go to the start of the segment and play
        video.currentTime = segment.start;
        video.play();

        checkTime();
      }
    },
    [segments, videoUrl]
  );
  const seekAndPlay = useCallback(
    (time: number) => {
      let cumulativeTime = 0;
      // Find the correct segment and the exact time within it
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const segmentDuration = segment.end - segment.start;
        if (cumulativeTime + segmentDuration > time || i === segments.length - 1) {
          // Ensure it works for the last segment as well
          playSegment(segments[i]); // Start playing from this segment
          const segmentTime = time - cumulativeTime;
          videoRef.current!.currentTime = segment.start + segmentTime;
          currentSegmentIndex.current = i;
          setIsPlaying(true); // Make sure we set isPlaying state to true
          break;
        }
        cumulativeTime += segmentDuration;
      }
    },
    [playSegment, segments]
  );

  return (
    <Box>
      <video ref={videoRef} src={videoUrl}></video>

      <Flex alignItems="center" mt={4} mb={4}>
        <Button mr={4} variant="ghost" onClick={onTogglePlayPause}>
          {!isPlaying ? <FaPlay /> : <FaPause />}
        </Button>
        <Box whiteSpace="nowrap" mr={4}>
          {Math.ceil(compositeCurrentTime)} / {Math.ceil(duration)}s
        </Box>
        <Slider
          aria-label="slider-ex-1"
          defaultValue={0}
          value={compositeCurrentTime}
          min={0}
          max={duration}
          onChange={v => {
            seekAndPlay(v);
          }}
        >
          <SliderTrack>
            <SliderFilledTrack />
          </SliderTrack>
          <SliderThumb />
        </Slider>
      </Flex>
    </Box>
  );
};
