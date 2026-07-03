import { CAPTIONS_TIMELINE_HEIGHT } from '../const';

import { HEADER_HEIGHT } from '../const';

import { PLAYLIST_PREVIEW_HEIGHT } from '../const';

import { PLAYLIST_PREVIEW_HEIGHT_MOBILE } from '../const';

import { useBreakpointValue } from '@chakra-ui/react';
import { VideoMetadata } from '../types';
import { RULER_HEIGHT } from '../const';
import { RULER_HEIGHT_MOBILE } from '../const';
import { useCallback, useEffect, useMemo, useState } from 'react';

export const useVideoPlayerDimensions = ({
  orientation,
  isInline,
  metadata
}: {
  orientation: 'VERTICAL' | 'HORIZONTAL';
  isInline: boolean;
  metadata: VideoMetadata;
}) => {
  const videoStream = metadata?.streams?.find(s => s.codec_type === 'video');
  const aspectRatio =
    orientation === 'HORIZONTAL'
      ? videoStream?.width && videoStream?.height
        ? videoStream.width / videoStream.height
        : 16 / 9
      : 9 / 16;
  const isVertical = useMemo(() => aspectRatio < 1, [aspectRatio]);

  const rulerHeight = useBreakpointValue({
    base: RULER_HEIGHT_MOBILE,
    md: RULER_HEIGHT
  });

  const playlistHeight = useBreakpointValue({
    base: PLAYLIST_PREVIEW_HEIGHT_MOBILE,
    md: PLAYLIST_PREVIEW_HEIGHT
  });

  const calculateDimensions = useCallback(
    (aspectRatio: number, rulerHeight: number, playlistHeight: number, isInline: boolean) => {
      const windowWidth = document.documentElement.clientWidth * 0.7;
      const windowHeight =
        document.documentElement.clientHeight -
        rulerHeight -
        playlistHeight -
        HEADER_HEIGHT -
        CAPTIONS_TIMELINE_HEIGHT -
        (isInline ? 134 : 123);

      return {
        width: Math.abs(Math.min(windowWidth, windowHeight * aspectRatio)),
        height: Math.abs(Math.min(windowHeight, windowWidth / aspectRatio))
      };
    },
    []
  );

  const [dimensions, setDimensions] = useState(() =>
    calculateDimensions(aspectRatio, rulerHeight ?? RULER_HEIGHT, playlistHeight ?? PLAYLIST_PREVIEW_HEIGHT, isInline)
  );

  // Only recalculate dimensions when needed or when window is resized
  useEffect(() => {
    const handleResize = () => {
      setDimensions(
        calculateDimensions(
          aspectRatio,
          rulerHeight ?? RULER_HEIGHT,
          playlistHeight ?? PLAYLIST_PREVIEW_HEIGHT,
          isInline
        )
      );
    };

    // Set initial dimensions
    handleResize();

    // Add event listener for window resize
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [calculateDimensions, aspectRatio, rulerHeight, playlistHeight, isInline]);

  return { dimensions, isVertical };
};
