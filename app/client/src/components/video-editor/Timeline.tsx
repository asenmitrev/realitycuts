import { FC, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Stage, Layer, Rect, Group, Text, Line, Transformer } from 'react-konva';
import { PIXELS_PER_SEC, PLAYLIST_PREVIEW_HEIGHT, RULER_HEIGHT } from '../../const';
import { VideoAlternative, VideoMetadata, VideoObject, WordBase } from '../../types';
import {
  Box,
  HStack,
  VStack,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Button,
  useDisclosure,
  IconButton
} from '@chakra-ui/react';
import { FaMagnifyingGlass, FaMagnifyingGlassPlus } from 'react-icons/fa6';
import { isHotkeyPressed, useHotkeys } from 'react-hotkeys-hook';
import { noop } from 'lodash';

import { LuRefreshCw } from 'react-icons/lu';
import { Html } from 'react-konva-utils';
import { SearchFootageModal } from './SearchFootageModal';
import { DownloadModal } from './DownloadModal';
import { useVideoEditorStore } from '../../stores/video-editor/store';
interface TimelineItemProps {
  videoObject: VideoObject;
  scale: number;
  rulerHeight: number;
  currentIndex: number;
  duration: number;
  playlist: VideoObject[];
  playlistHeight: number;
  isSelected: boolean;
  onDownloadClick: (video: VideoObject) => void;
  onOpenSearch: (video: VideoObject) => void;
  onRemoveSegment: (video: VideoObject) => void;
  onSelect: () => void;
  onToggleAlt: (video: VideoObject) => void;
  onDragEnd: (video: VideoObject, newStart: number, newEnd: number, offsetStart: number) => void;
  onToggleVisible: (video: VideoObject) => void;
}

const TimelineItem: FC<TimelineItemProps> = memo(
  ({
    videoObject,
    scale,
    rulerHeight,
    currentIndex,
    duration,
    playlist,
    playlistHeight,
    onOpenSearch,
    onSelect,
    onDragEnd,
    onToggleAlt
  }) => {
    const [isCurrentlyDragging, setIsCurrentlyDragging] = useState(false);
    const groupRef = useRef(null);
    const offsetStartRef = useRef(videoObject.offsetStart || 0);
    const rectRef = useRef(null);
    const imgRef = useRef<HTMLImageElement>(new Image());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformerRef = useRef<any>(null);
    const handleDragStart = () => {
      setIsCurrentlyDragging(true);
      onSelect();
    };
    const [isHovered, setIsHovered] = useState(false);

    const isVisible = videoObject.isVisible;
    useEffect(() => {
      // we need to attach transformer manually
      transformerRef.current?.nodes([rectRef.current]);
      transformerRef.current?.getLayer().batchDraw();
    }, []);
    const previousVideo = useMemo(() => {
      if (currentIndex === 0) {
        return { timeEnd: 0 };
      } else {
        return playlist[currentIndex - 1];
      }
    }, [playlist, currentIndex]);
    const nextVideo = useMemo(() => {
      if (currentIndex + 1 === playlist.length) {
        return { timeStart: duration };
      } else {
        return playlist[currentIndex + 1];
      }
    }, [playlist, currentIndex, duration]);
    const handleDragBounds = (pos: { x: number; y: number }) => {
      let x = pos.x;
      if (previousVideo.timeEnd * PIXELS_PER_SEC * scale > x) {
        x = previousVideo.timeEnd * PIXELS_PER_SEC * scale;
      }
      if (
        nextVideo.timeStart * PIXELS_PER_SEC * scale <
        x + (videoObject.timeEnd - videoObject.timeStart) * PIXELS_PER_SEC * scale
      ) {
        x =
          nextVideo.timeStart * PIXELS_PER_SEC * scale -
          (videoObject.timeEnd - videoObject.timeStart) * PIXELS_PER_SEC * scale;
      }
      return {
        x,
        y: rulerHeight
      };
    };

    const handleTransformBounds = (
      oldBox: { x: number; y: number; width: number; height: number; rotation: number },
      newBox: { x: number; y: number; width: number; height: number; rotation: number }
    ) => {
      newBox.y = rulerHeight;
      newBox.height = oldBox.height;
      // Minimum width check

      let movingLeftEdge = false;
      // Check if dragging left edge
      if (newBox.x !== oldBox.x) {
        // Left edge constraints
        if (newBox.width < 0.5 * scale * PIXELS_PER_SEC) {
          newBox.width = 0.5 * scale * PIXELS_PER_SEC;
          newBox.x = oldBox.x;
        } else if (newBox.x + newBox.width > nextVideo.timeStart * PIXELS_PER_SEC * scale) {
          newBox.width = nextVideo.timeStart * PIXELS_PER_SEC * scale - newBox.x;
        } else if (newBox.x < previousVideo.timeEnd * PIXELS_PER_SEC * scale) {
          const originalRight = oldBox.x + oldBox.width;
          const newRight = originalRight;
          newBox.x = previousVideo.timeEnd * PIXELS_PER_SEC * scale;
          const newWidth = newRight - newBox.x;
          newBox.width = newWidth;
        }
        if (newBox.width > videoObject.duration * PIXELS_PER_SEC * scale) {
          newBox.width = videoObject.duration * PIXELS_PER_SEC * scale;
          newBox.x = oldBox.x;
        } else if (newBox.x < 0) {
          newBox.x = 0;
          newBox.width = oldBox.x + oldBox.width;
        }

        offsetStartRef.current = Math.min(
          Math.max(0, offsetStartRef.current + (newBox.x - oldBox.x) / (PIXELS_PER_SEC * scale)),
          videoObject.duration
        );

        movingLeftEdge = true;
      }

      // Check if dragging right edge
      if (!movingLeftEdge && newBox.width !== oldBox.width) {
        if (newBox.width < 0.5 * scale * PIXELS_PER_SEC) {
          newBox.width = 0.5 * scale * PIXELS_PER_SEC;
        } else if (newBox.x + newBox.width > nextVideo.timeStart * PIXELS_PER_SEC * scale) {
          newBox.width = nextVideo.timeStart * PIXELS_PER_SEC * scale - newBox.x;
        }

        if (newBox.width > (videoObject.duration - offsetStartRef.current) * PIXELS_PER_SEC * scale) {
          newBox.width = (videoObject.duration - offsetStartRef.current) * PIXELS_PER_SEC * scale;
        }
      }
      return newBox;
    };
    const handleTransformStart = () => {
      setIsCurrentlyDragging(true);
    };
    const handleDragEnd = () => {
      setIsCurrentlyDragging(false);
      if (groupRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node = groupRef.current as any;
        const newX = node.attrs.x;
        const newStart = newX / (PIXELS_PER_SEC * scale);
        const newEnd = newStart + (videoObject.timeEnd - videoObject.timeStart);
        onDragEnd(videoObject, newStart, newEnd, offsetStartRef.current);
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleTransformEnd = (e: any) => {
      setIsCurrentlyDragging(false);
      const newX = e.target.attrs.x;
      const newStart = videoObject.timeStart + newX / (PIXELS_PER_SEC * scale);
      const newDuration = (e.target.attrs.width * e.target.attrs.scaleX) / (PIXELS_PER_SEC * scale);
      const newEnd = newStart + newDuration;
      if (newX !== undefined) {
        onDragEnd(videoObject, newStart, newEnd, offsetStartRef.current);
      }
    };
    const [imageLoaded, setImageLoaded] = useState(false);
    useEffect(() => {
      imgRef.current.src = videoObject.thumbnail;

      // Add onload handler
      imgRef.current.onload = () => {
        setImageLoaded(true);
      };
    }, [videoObject.thumbnail]);

    return (
      <Group
        ref={groupRef}
        x={videoObject.timeStart * PIXELS_PER_SEC * scale}
        y={rulerHeight}
        draggable
        opacity={isVisible ? 1 : 0.5}
        onDragStart={handleDragStart}
        onMouseEnter={() => {
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
        onDragEnd={handleDragEnd}
        dragBoundFunc={handleDragBounds}
      >
        <Rect
          ref={rectRef}
          width={Math.abs(videoObject.timeEnd - videoObject.timeStart) * PIXELS_PER_SEC * scale}
          height={playlistHeight}
          fillPatternImage={imageLoaded ? imgRef.current : undefined}
          fill={!imageLoaded ? 'rgba(0,0,0,0.3)' : undefined}
          fillPatternRepeat="repeat"
          fillPatternScaleY={1}
          stroke={isCurrentlyDragging ? 'white' : 'rgba(255,255,255,0.6)'}
          onTransformEnd={handleTransformEnd}
          onTransformStart={handleTransformStart}
          strokeWidth={2}
          cornerRadius={8}
        />
        <Group x={Math.abs(videoObject.timeEnd - videoObject.timeStart) * PIXELS_PER_SEC * scale - 50} y={4}>
          <Html>
            <Box
              display="flex"
              maxW="100%"
              overflow="hidden"
              position="relative"
              alignItems="flex-end"
              justifyContent="flex-start"
              flexShrink="1"
              flexDir="column"
              flexGrow="1"
              gap={1}
              opacity={isVisible ? 1 : 0.5}
              transition="opacity 0.2s ease-in-out"
              _groupHover={{
                opacity: 1
              }}
              px={1}
              pr={3}
            >
              <IconButton
                size="xs"
                variant="solid"
                colorScheme="white"
                aria-label="Open Search"
                onMouseDown={e => {
                  e.stopPropagation();
                }}
                onKeyDown={e => e.preventDefault()}
                onClick={() => {
                  onOpenSearch(videoObject);
                }}
              >
                <FaMagnifyingGlassPlus />
              </IconButton>
              <IconButton
                size="xs"
                variant="solid"
                colorScheme="white"
                onMouseDown={e => {
                  e.stopPropagation();
                }}
                onKeyDown={e => e.preventDefault()}
                onClick={() => {
                  onToggleAlt(videoObject);
                }}
                aria-label="Toggle Alt"
              >
                <LuRefreshCw size={12} />
              </IconButton>
            </Box>
          </Html>
        </Group>
        {!isCurrentlyDragging && (
          <Rect
            width={Math.abs(videoObject.timeEnd - videoObject.timeStart) * PIXELS_PER_SEC * scale}
            height={playlistHeight}
            fillLinearGradientStartPoint={{ x: 0, y: playlistHeight / 2 }}
            fillLinearGradientEndPoint={{ x: 0, y: playlistHeight }}
            fillLinearGradientColorStops={[0, 'rgba(0,0,0,0)', 1, 'rgba(0,0,0,0.7)']}
            cornerRadius={8}
          />
        )}
        {/* {!isCurrentlyDragging && scale > 2 && (
          <Text
            text={videoObject.dbId}
            fill="white"
            fontSize={12}
            fontWeight="'bold'"
            fontFamily="'IBM Plex Sans Hebrew'"
            padding={8}
            width={Math.abs(videoObject.timeEnd - videoObject.timeStart) * PIXELS_PER_SEC * scale}
            y={playlistHeight - 40}
            height={40}
            maxLines={2}
            ellipsis={true}
          />
        )} */}
        <Transformer
          borderEnabled={false}
          flipEnabled={false}
          anchorSize={16}
          anchorCornerRadius={8}
          anchorFill="white"
          anchorStroke="black"
          boundBoxFunc={handleTransformBounds}
          enabledAnchors={isHovered ? ['middle-left', 'middle-right'] : []}
          ref={transformerRef}
        />
      </Group>
    );
  }
);

interface RulerProps {
  width: number;
  scale: number;
  rulerHeight: number;
  jumpCuts: number[];
}

const Ruler: FC<RulerProps> = memo(({ width, scale, rulerHeight, jumpCuts }) => {
  const secondMarkers = [];

  const totalSeconds = Math.ceil(width / (PIXELS_PER_SEC * scale));

  const markerInterval = scale > 1 ? (scale > 3 ? 0.5 : 1) : 2;

  for (let i = 0; i <= totalSeconds; i += markerInterval) {
    const x = i * PIXELS_PER_SEC * scale;
    secondMarkers.push(
      <Group key={i}>
        <Line points={[x, 0, x, rulerHeight / 3]} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
        <Text
          x={x - 10}
          y={rulerHeight / 3 + 5}
          text={`${Math.floor(i / 60)}:${(i % 60).toString().padStart(2, '0')}`}
          fill="rgba(255,255,255,0.7)"
          fontFamily="monospace"
          fontSize={10}
        />
      </Group>
    );
  }

  // Add jump cut markers
  const jumpCutMarkers = jumpCuts.map((time, index) => (
    <Line
      key={`jump-${index}`}
      points={[time * PIXELS_PER_SEC * scale, 0, time * PIXELS_PER_SEC * scale, rulerHeight]}
      stroke="rgba(0,255,255,0.6)"
      strokeWidth={3}
    />
  ));

  return (
    <Group>
      {secondMarkers}
      {jumpCutMarkers}
    </Group>
  );
});

interface Gap {
  timeStart: number;
  timeEnd: number;
  originalTimeStart?: number;
  originalTimeEnd?: number;
}

interface GapProps {
  gap: Gap;
  rulerHeight: number;
  scale: number;
  onGapClick: (gap: Gap) => void;
}
const Gap: FC<GapProps> = memo(({ gap, rulerHeight, scale, onGapClick }) => {
  return (
    <Group x={gap.timeEnd * PIXELS_PER_SEC * scale - 35} y={rulerHeight + 5}>
      <Html>
        <Button
          variant="solid"
          colorScheme="white"
          size="xs"
          onClick={e => {
            e.preventDefault();
            onGapClick(gap);
          }}
        >
          <FaMagnifyingGlassPlus />
        </Button>
      </Html>
    </Group>
  );
});

interface ProgressIndicatorLineProps {
  height: number;
  scale: number;
}
const ProgressIndicatorLine: FC<ProgressIndicatorLineProps> = memo(({ height, scale }) => {
  const currentTime = useVideoEditorStore(state => state.currentTime);
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        transform: `translateX(${currentTime * scale * PIXELS_PER_SEC}px)`,
        width: '2px',
        height: height,
        backgroundColor: '#90CDF4'
      }}
    ></div>
  );
});
interface TimelineProps {
  duration: number;
  playlist: VideoObject[];
  initialScale: number;
  metadata: VideoMetadata;
  transcript: WordBase[];
  jumpCuts: number[];
  isGeneratingBroll?: boolean;
  privateLibraryIds: string[];
  publicLibraryIds: string[];
  onToggleAlt: (video: VideoObject) => void;
  generateBroll: () => void;
  onToggleVisible: (video: VideoObject) => void;
  onSaveCaption: (v: WordBase) => void;
  onSeek: (v: number | number[]) => void;
  onChangeTimeVideo: (v: VideoObject, timeStart: number, timeEnd: number, offsetStart: number) => void;
  onReplaceVideoAlts: (v: VideoObject, alts: VideoAlternative[], keywords: string) => void;
  onRemoveSegment: (v: VideoObject) => void;
  onAddVideoAlts: (timeStart: number, timeEnd: number, alts: VideoAlternative[], keywords: string) => void;
  /** When set, automatically opens the footage search modal for the given video with an optional query override. */
  chatSearchRequest?: { video: VideoObject; query?: string } | null;
  /** Called after chatSearchRequest has been consumed so the parent can clear it. */
  onChatSearchRequestHandled?: () => void;
}
export const Timeline: FC<TimelineProps> = memo(
  ({
    duration,
    initialScale,
    playlist,
    jumpCuts,
    onToggleVisible,
    onSeek,
    onToggleAlt,
    onChangeTimeVideo,
    onReplaceVideoAlts,
    onRemoveSegment,
    onAddVideoAlts,
    privateLibraryIds,
    publicLibraryIds,
    chatSearchRequest,
    onChatSearchRequestHandled
  }) => {
    const [scale, setScale] = useState(initialScale);
    const [selectedId] = useState<number>();
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef(null);

    const { isOpen: isDownloadModalOpen, onClose: onCloseDownloadModal, onOpen: onOpenDownloadModal } = useDisclosure();
    const [clipForDownload, setClipForDownload] = useState(0);

    useHotkeys(['Alt'], () => null);

    const handleWheel = useCallback(
      (e: React.WheelEvent) => {
        if (isHotkeyPressed(['Alt'])) {
          e.preventDefault();
          const newScale = scale - e.deltaY * 0.001;
          setScale(Math.min(Math.max(0.7, newScale), 20));
        }
      },
      [scale]
    );

    const timelineWidth = duration * PIXELS_PER_SEC * scale;
    const rulerHeight = RULER_HEIGHT;
    const playlistHeight = PLAYLIST_PREVIEW_HEIGHT;

    // Calculate visible range with buffer for smoother scrolling

    const handleStageClick = useCallback(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stage = stageRef.current as any;
      if (!stage) return;
      const pointerPosition = stage.getPointerPosition();
      if (!pointerPosition) return;
      const x = (pointerPosition.x + stage.container().scrollLeft) / (PIXELS_PER_SEC * scale);
      onSeek(x);
    }, [onSeek, scale]);

    const gaps = useMemo(() => {
      let lastRight = 0;
      let lastOriginalRight = 0;
      const out: Gap[] = [];

      const sortedElements = playlist.sort(function (a, b) {
        return a.timeStart - b.timeStart;
      });

      sortedElements.forEach(function (element) {
        const elementLeft = element.timeStart;
        const elementWidth = element.timeEnd - element.timeStart;
        const originalElementLeft = element.originalTimeStart;
        const originalElementWidth =
          element.originalTimeEnd !== undefined && element.originalTimeStart !== undefined
            ? element.originalTimeEnd - element.originalTimeStart
            : 0;

        if (elementLeft - lastRight > 1) {
          const gapWidth = elementLeft - lastRight;
          const originalGapWidth = originalElementLeft ? originalElementLeft - lastOriginalRight : 0;
          const gap: Gap = {
            timeStart: lastRight,
            timeEnd: lastRight + gapWidth,
            originalTimeStart: lastOriginalRight,
            originalTimeEnd: lastOriginalRight + originalGapWidth
          };

          out.push(gap);
        }

        // Update the 'lastRight' to the rightmost point of the current element
        lastRight = elementLeft + elementWidth;
        lastOriginalRight =
          originalElementLeft !== undefined && originalElementWidth !== undefined
            ? originalElementLeft + originalElementWidth
            : lastOriginalRight;
      });

      const lastElement = sortedElements[sortedElements.length - 1];
      if (lastElement && lastElement.timeEnd < duration - 0.5) {
        const gap: Gap = {
          timeStart: lastElement.timeEnd,
          timeEnd: duration
        };
        out.push(gap);
      }
      return out;
    }, [playlist, duration]);

    const handleDragEnd = useCallback(
      (video: VideoObject, newStart: number, newEnd: number, offsetStart: number) => {
        onChangeTimeVideo(video, newStart, newEnd, offsetStart);
      },
      [onChangeTimeVideo]
    );

    const { isOpen: isSearchModalOpen, onClose: onSearchModalClose, onOpen: onSearchModalOpen } = useDisclosure();

    const [videoForSearch, setVideoForSearch] = useState<VideoObject>();
    const [gapForSearch, setGapForSearch] = useState<Gap>();

    const onGapSearch = useCallback(
      (gap: Gap) => {
        setGapForSearch(gap);
        onSearchModalOpen();
      },
      [onSearchModalOpen]
    );

    const onOpenSearch = useCallback(
      (v: VideoObject) => {
        setVideoForSearch(v);
        onSearchModalOpen();
      },
      [onSearchModalOpen]
    );

    // Handle external (chat-triggered) search requests
    useEffect(() => {
      if (!chatSearchRequest) return;
      // If a query override is provided, inject it into the video's keywords so the modal pre-fills it
      const video = chatSearchRequest.query
        ? { ...chatSearchRequest.video, keywords: chatSearchRequest.query }
        : chatSearchRequest.video;
      setVideoForSearch(video);
      onSearchModalOpen();
      onChatSearchRequestHandled?.();
    }, [chatSearchRequest, onSearchModalOpen, onChatSearchRequestHandled]);

    const onDownloadClick = useCallback(
      (videoObject: VideoObject) => {
        onOpenDownloadModal();
        setClipForDownload(videoObject.id);
      },
      [onOpenDownloadModal, setClipForDownload]
    );

    return (
      <HStack gap={0} w="100%" mt={4}>
        <VStack
          py={2}
          h="100%"
          px={1}
          bg="whiteAlpha.100"
          border="1px solid"
          borderColor="whiteAlpha.200"
          borderRadius="lg"
          alignItems="center"
          mr={2}
          gap={3}
        >
          <FaMagnifyingGlass size={12} />
          <Slider
            colorScheme="gray"
            value={scale}
            orientation="vertical"
            onChange={setScale}
            min={0.7}
            max={5}
            step={0.001}
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb />
          </Slider>
        </VStack>

        {(!!videoForSearch || !!gapForSearch) && isSearchModalOpen && (
          <SearchFootageModal
            isOpen={isSearchModalOpen}
            keywords={videoForSearch?.keywords ?? ''}
            privateLibraryIds={privateLibraryIds}
            publicLibraryIds={publicLibraryIds}
            onClose={() => {
              setVideoForSearch(undefined);
              setGapForSearch(undefined);
              onSearchModalClose();
            }}
            onFootageSelect={(alts, keywords) => {
              if (videoForSearch) {
                onReplaceVideoAlts(videoForSearch, alts, keywords);
                setVideoForSearch(undefined);
              } else if (gapForSearch) {
                const timeStart = gapForSearch.originalTimeStart ?? gapForSearch.timeStart;
                const timeEnd = Math.min(
                  gapForSearch.originalTimeEnd ?? gapForSearch.timeEnd,
                  timeStart + alts[0].duration
                );
                onAddVideoAlts(timeStart, timeEnd, alts, keywords);
                setGapForSearch(undefined);
              }
            }}
          />
        )}
        {isDownloadModalOpen && (
          <DownloadModal isOpen={isDownloadModalOpen} onClose={onCloseDownloadModal} brollId={clipForDownload} />
        )}
        <Box
          ref={containerRef}
          onWheel={handleWheel}
          bg="whiteAlpha.100"
          border="1px solid"
          borderColor="whiteAlpha.200"
          borderRadius="lg"
          style={{
            width: '100%',
            height: rulerHeight + playlistHeight,
            overflowX: 'scroll',
            overflowY: 'hidden',
            position: 'relative'
          }}
        >
          <div style={{ width: timelineWidth, height: '1px' }} />
          <Stage
            ref={stageRef}
            height={rulerHeight + playlistHeight}
            width={timelineWidth}
            onClick={handleStageClick}
            style={{ position: 'absolute', top: 0, left: 0 }}
          >
            <Layer>
              <Ruler width={timelineWidth} scale={scale} rulerHeight={rulerHeight} jumpCuts={jumpCuts} />
              {playlist.map((video, index) => {
                return (
                  <TimelineItem
                    key={video.id + video.timeStart + video.url}
                    videoObject={video}
                    scale={scale}
                    currentIndex={index}
                    duration={duration}
                    playlist={playlist}
                    onDownloadClick={onDownloadClick}
                    rulerHeight={rulerHeight}
                    playlistHeight={playlistHeight}
                    isSelected={selectedId === index}
                    onOpenSearch={onOpenSearch}
                    onRemoveSegment={onRemoveSegment}
                    onSelect={noop}
                    onToggleAlt={onToggleAlt}
                    onDragEnd={handleDragEnd}
                    onToggleVisible={onToggleVisible}
                  />
                );
              })}
              {gaps.map(gap => (
                <Gap key={gap.timeStart} gap={gap} rulerHeight={rulerHeight} scale={scale} onGapClick={onGapSearch} />
              ))}
            </Layer>
          </Stage>
          <ProgressIndicatorLine height={rulerHeight + playlistHeight} scale={scale} />
        </Box>
      </HStack>
    );
  }
);
