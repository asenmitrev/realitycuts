import { forwardRef, memo, useImperativeHandle, useMemo, useRef, useState, useCallback, useEffect } from 'react';
import type { IHighlightInstance, Segment, VideoAIData, VideoMetadata, VideoObject, WordBaseEdited } from '../../types';
import 'rc-slider/assets/index.css';
import { useNavigate } from 'react-router-dom';
import { GiSaveArrow } from 'react-icons/gi';
import { AUDIO_VOLUME_MODIFIER } from '../../const';
import { Button, ButtonGroup, useDisclosure, useToast, Text, Box, VStack } from '@chakra-ui/react';
import styled from '@emotion/styled';
import { Timeline } from './Timeline';
import { Controls } from './Controls';
import { useApiService } from '../../hooks/useApiService';
import { ExportModal } from './ExportModal';
import { CaptionModal } from './CaptionModal';
import { useQueryClient } from 'react-query';
import { ApiError } from '../../service/apiService';
import { useVideoHighlightShim } from '../../hooks/useVideoHighlightShim';
import { FaPortrait } from 'react-icons/fa';
import { useConfirmDialogV2 } from '../../hooks/useConfirmDialog';
import { noop } from 'lodash';
import { useProfile } from '../../contexts/profile/hooks';
import { useVideoEngine } from '../../hooks/useVideoEngine';
import { useVideoPlayer } from '../../hooks/useVideoPlayer';
import { useVideoRepositioning } from '../../hooks/useVideoRepositioning';
import { useVideoCaptions } from '../../hooks/useVideoCaptions';
import { useVideoPlayerDimensions } from '../../hooks/useVideoPlayerDimensions';
import { useVideoEditorStore, useVideoEditorStoreApi } from '../../stores/video-editor/store';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';

export type PopulatedVideoAIData = VideoAIData & { _id: string };

// Type definitions for fullscreen API cross-browser support
interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element;
  mozFullScreenElement?: Element;
  msFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

const Canvas: React.FC<{
  canvasId: string;
  currentlyPlayingVideo: VideoObject;
  isVertical: boolean;
  dimensions: {
    width: number;
    height: number;
  };
  dragging: boolean;
  canvas: React.RefObject<HTMLCanvasElement>;
  handleStart: (e: React.MouseEvent<HTMLCanvasElement, MouseEvent> | React.TouchEvent<HTMLCanvasElement>) => void;
  handleMove: (e: React.MouseEvent<HTMLCanvasElement, MouseEvent> | React.TouchEvent<HTMLCanvasElement>) => void;
}> = ({ canvasId, dragging, handleStart, handleMove, dimensions, canvas }) => {
  const thereIsBroll = useVideoEditorStore(state => !!state.currentBroll);
  return (
    <canvas
      ref={canvas}
      id={canvasId}
      style={{
        willChange: 'contents',
        transform: 'translateZ(0)',
        cursor: thereIsBroll ? (dragging ? 'grabbing' : 'grab') : 'default'
      }}
      {...dimensions}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
      onMouseMove={handleMove}
      onTouchMove={handleMove}
    ></canvas>
  );
};
interface VideoProps {
  data: PopulatedVideoAIData;
  highlight?: IHighlightInstance;
  isGeneratingBroll?: boolean;
  isInline?: boolean;
  generateBroll: () => void;
  editedWordsList?: WordBaseEdited[];
  isGeneratingRecropData?: boolean;
  isHighlight?: boolean;
  onGenerateVertical?: () => void;
  onBeforeSave?: () => void;
  onRefresh?: () => void;
  isDirty?: boolean;
  isDeleting?: boolean;
}

export const Video = memo(
  forwardRef<{ save: () => void; onStartExport: () => void }, VideoProps>(
    (
      {
        data,
        isInline = false,
        editedWordsList,
        generateBroll,
        onBeforeSave,
        isHighlight = true,
        isGeneratingBroll,
        isGeneratingRecropData,
        highlight,
        onGenerateVertical,
        isDirty,
        isDeleting
      },
      ref
    ) => {
      const canvasId = 'canvas-id';
      const navigate = useNavigate();
      useProfile();
      const queryClient = useQueryClient();

      const { dialogContent, awaitConfirmation } = useConfirmDialogV2({
        title: 'Remove Overlay',
        type: 'delete'
      });
      const canvas = useRef<HTMLCanvasElement>(null);
      const videoContainerRef = useRef<HTMLDivElement>(null);

      const derivedDuration =
        data.segments?.length ? Math.max(...data.segments.map(s => s.timeEnd)) : 20;
      const metadata: VideoMetadata =
        highlight?.source?.metadata ??
        data.source?.metadata ??
        ({ format: { duration: derivedDuration }, streams: [] } as unknown as VideoMetadata);
      const [isSaving, setIsSaving] = useState(false);
      const [isFullscreen, setIsFullscreen] = useState(false);
      const [chatSearchRequest, setChatSearchRequest] = useState<{ video: VideoObject; query?: string } | null>(null);
      const { isOpen: isExportModalOpen, onClose: onExportModalClose, onOpen: setIsExportModalOpen } = useDisclosure();
      const toast = useToast();
      const apiService = useApiService();

      const { duration, segments } = useVideoHighlightShim({
        data: useMemo(() => editedWordsList ?? [], [editedWordsList]),
        duration: metadata?.format.duration ?? 20
      });
      const editorStore = useVideoEditorStoreApi();
      const undo = useVideoEditorStore(state => state.undo);
      const redo = useVideoEditorStore(state => state.redo);
      const canUndo = useVideoEditorStore(state => state.canUndo);
      const canRedo = useVideoEditorStore(state => state.canRedo);
      const {
        playlistState,
        debouncedDispatch,
        currentlyPlayingVideo,
        playlistAfterSegmentation,
        onToggleVideoEnabled,
        onRemoveSegment,
        onToggleVideo,
        onChangeTimeVideo,
        onToggleVisible,
        handleReplaceSegments,
        handleReplaceVideoAlternatives,
        handleAddVideoAlts
      } = useVideoPlayer({ data, awaitConfirmation, segments });
      const {
        captions,
        captionWords,
        captionsState,
        captionPresets,
        isCaptionsModalOpen,
        onCaptionsModalClose,
        setIsCaptionsModalOpen,
        refetchCaptionPresets,
        onSaveCaptionPreset,
        downloadSubtitles
      } = useVideoCaptions({ editedWordsList, data });
      const {
        audio,
        audioIndex,
        volume,
        audioEnabled,
        orientation,
        isPlaying,
        toggleAudio,
        playbackRate,
        setVolume,
        onSeek,
        toggleAudioEnabled,
        onTogglePlayPause,
        setPlaybackRate,
        updateOrientation,
        onReplaceAudio
      } = useVideoEngine({
        canvas: canvas.current,
        playlistState,
        data,
        segments,
        captions,
        captionsState
      });


      const { dimensions, isVertical } = useVideoPlayerDimensions({
        orientation,
        isInline,
        metadata
      });
      const jumpCuts = useMemo(() => {
        const jumpCuts: number[] = [];
        let newStartTime = 0;
        const segs = segments.length > 0 ? segments : data.highlightSegments ?? [];
        for (let i = 0; i < segs.length; i++) {
          jumpCuts.push(newStartTime);

          // Calculate the duration of the current segment
          const duration = segs[i].end - segs[i].start;

          // Update the new start time for the next segment
          newStartTime += duration;
        }

        return jumpCuts;
      }, [data.highlightSegments, segments]);

      const exportData = useCallback(() => {
        const segments = playlistState.videoMap.map((map, index) => {
          let timeStart: number = 0,
            timeEnd: number = 0,
            keywords: string = '';
          const alternatives = map.map((vidObj, vidObjindex) => {
            timeStart = vidObj.timeStart;
            timeEnd = vidObj.timeEnd;
            keywords = vidObj.keywords;
            return {
              preview: vidObj.url,
              thumbnailUrl: vidObj.thumbnail,
              title: vidObj.title,
              link: vidObj.link,
              videoId: vidObj.videoId,
              duration: vidObj.duration,
              offsetStart: vidObj.offsetStart,
              score: vidObj.score,
              id: vidObj.id,
              dbId: vidObj.dbId,
              type: vidObj.type,
              isVisible: vidObj.isVisible,
              leftPosition: vidObj.leftPosition,
              topPosition: vidObj.topPosition,
              brollType: vidObj.brollType,
              isFocused: playlistState.altMap[index] === vidObjindex
            };
          });
          return { keywords, timeStart, timeEnd, alternatives };
        });
        const out = {
          ...data,
          audioEnabled,
          audioIndex,
          segments
        };
        if (editedWordsList !== undefined) {
          out.editedWordsList = editedWordsList;
        }
        return out;
      }, [playlistState.videoMap, playlistState.altMap, data, audioEnabled, audioIndex, editedWordsList]);

      const onSave = useCallback(
        async (title?: string) => {
          const changedData = exportData();
          if (changedData) {
            setIsSaving(true);
            try {
              const savedModel: VideoAIData = {
                ...changedData,
                captions: captions ?? data.captions,
                audio,
                audioVolume: volume,
                title: title ?? data.title
              };
              await apiService.put<VideoAIData, VideoAIData>(`/api/videos/${data._id}`, savedModel);
              queryClient.setQueryData<VideoAIData | undefined>(['videoAiData', savedModel._id], savedModel);
              onBeforeSave?.();

              toast({
                title: 'Video saved.',
                description: 'Your changes have been saved and you can close the video.',
                status: 'success',
                duration: 2000,
                isClosable: true
              });
            } catch (e) {
              if (e instanceof ApiError) {
                const errorData = e.data as { message?: string };
                const message = errorData?.message || e.message || 'An error occurred saving the video.';
                toast({
                  title: 'Error!',
                  description: message,
                  status: 'error',
                  duration: 5000,
                  isClosable: true
                });
              } else {
                toast({
                  title: 'Error!',
                  description: 'An error occurred saving the video.',
                  status: 'error',
                  duration: 5000,
                  isClosable: true
                });
              }
            } finally {
              setIsSaving(false);
              debouncedDispatch({ type: 'SET_IS_DIRTY', payload: { isDirty: false } });
            }
          }
        },
        [
          apiService,
          audio,
          captions,
          data._id,
          data.captions,
          data.title,
          exportData,
          queryClient,
          onBeforeSave,
          toast,
          volume,
          debouncedDispatch
        ]
      );
      const onStartExport = useCallback(async () => {
        // Pause video if it's currently playing
        if (isPlaying) {
          onTogglePlayPause();
        }
        await onSave();

        setIsExportModalOpen();
      }, [navigate, onSave, setIsExportModalOpen, isPlaying, onTogglePlayPause]);

      const { handleStart, handleMove, dragging } = useVideoRepositioning({
        canvas,
        currentlyPlayingVideo,
        debouncedDispatch
      });

      useImperativeHandle(
        ref,
        () => ({
          save: (title?: string) => onSave(title),
          onStartExport: () => onStartExport(),
          onRegenerateBroll: (startTime: number, endTime: number, segments: Segment[]) => {
            if (segments.length === 0) {
              return;
            }
            handleReplaceSegments(segments, startTime, endTime);
          },
          editorTogglePlayPause: () => onTogglePlayPause(),
          editorSeekBySeconds: (deltaSeconds: number) => {
            const currentTime = editorStore.getState().currentTime;
            const next = Math.max(0, Math.min(duration, currentTime + deltaSeconds));
            onSeek(next);
          },
          editorToggleCurrentAltVariation: () => {
            if (!currentlyPlayingVideo) return;
            onToggleVideo(currentlyPlayingVideo);
          },
          editorToggleCurrentAltEnabled: () => {
            onToggleVideoEnabled();
          },
          editorToggleCurrentAltVariationAtTime: (seconds: number) => {
            if (!Number.isFinite(seconds)) return;
            const idx = playlistState.videoMap.findIndex(altPlaylist =>
              altPlaylist.some(v => v.timeStart <= seconds && seconds < v.timeEnd)
            );
            if (idx < 0) return;
            const altPlaylist = playlistState.videoMap[idx];
            if (!altPlaylist || altPlaylist.length === 0) return;
            const altIdx = playlistState.altMap[idx] ?? 0;
            const video = altPlaylist[altIdx] ?? altPlaylist[0];
            if (!video) return;
            onToggleVideo(video);
          },
          editorToggleCurrentAltEnabledAtTime: (seconds: number) => {
            if (!Number.isFinite(seconds)) return;
            debouncedDispatch({
              type: 'TOGGLE_CURRENT_ALT_ENABLED',
              payload: {
                currentTime: seconds
              }
            });
          },
          editorToggleCurrentAltVisible: () => {
            if (!currentlyPlayingVideo) return;
            onToggleVisible(currentlyPlayingVideo);
          },
          editorToggleCurrentAltVisibleAtTime: (seconds: number) => {
            if (!Number.isFinite(seconds)) return;
            const idx = playlistState.videoMap.findIndex(altPlaylist =>
              altPlaylist.some(v => v.timeStart <= seconds && seconds < v.timeEnd)
            );
            if (idx < 0) return;
            const altPlaylist = playlistState.videoMap[idx];
            if (!altPlaylist || altPlaylist.length === 0) return;
            const altIdx = playlistState.altMap[idx] ?? 0;
            const video = altPlaylist[altIdx] ?? altPlaylist[0];
            if (!video) return;
            onToggleVisible(video);
          },
          editorRemoveCurrentSegment: () => {
            if (!currentlyPlayingVideo) return;
            debouncedDispatch({
              type: 'REMOVE_SEGMENT',
              payload: { video: currentlyPlayingVideo }
            });
          },
          editorRemoveSegmentAtTime: (seconds: number) => {
            if (!Number.isFinite(seconds)) return;
            const idx = playlistState.videoMap.findIndex(altPlaylist =>
              altPlaylist.some(v => v.timeStart <= seconds && seconds < v.timeEnd)
            );
            if (idx < 0) return;
            const altPlaylist = playlistState.videoMap[idx];
            if (!altPlaylist || altPlaylist.length === 0) return;
            const altIdx = playlistState.altMap[idx] ?? 0;
            const video = altPlaylist[altIdx] ?? altPlaylist[0];
            if (!video) return;
            debouncedDispatch({
              type: 'REMOVE_SEGMENT',
              payload: { video }
            });
          },
          editorOpenSearchForCurrentSegment: (query?: string) => {
            if (!currentlyPlayingVideo) return;
            setChatSearchRequest({ video: currentlyPlayingVideo, query });
          },
          editorOpenSearchAtTime: (seconds: number, query?: string) => {
            if (!Number.isFinite(seconds)) return;
            const idx = playlistState.videoMap.findIndex(altPlaylist =>
              altPlaylist.some(v => v.timeStart <= seconds && seconds < v.timeEnd)
            );
            if (idx < 0) return;
            const altPlaylist = playlistState.videoMap[idx];
            if (!altPlaylist || altPlaylist.length === 0) return;
            const altIdx = playlistState.altMap[idx] ?? 0;
            const video = altPlaylist[altIdx] ?? altPlaylist[0];
            if (!video) return;
            setChatSearchRequest({ video, query });
          },
          editorToggleBackgroundMusic: () => {
            if (audioEnabled) {
              setVolume(0);
              toggleAudioEnabled(false);
            } else {
              setVolume(AUDIO_VOLUME_MODIFIER);
              toggleAudioEnabled(true);
            }
          },
          editorSetBackgroundMusicVolume: (v: number) => {
            const clamped = Math.max(0, Math.min(0.3, v));
            setVolume(clamped);
            if (clamped <= 0) {
              toggleAudioEnabled(false);
            } else {
              toggleAudioEnabled(true);
            }
          }
        }),
        [
          audioEnabled,
          editorStore,
          duration,
          handleReplaceSegments,
          onSave,
          onSeek,
          onStartExport,
          onTogglePlayPause,
          currentlyPlayingVideo,
          playlistState.videoMap,
          playlistState.altMap,
          onToggleVideo,
          onToggleVideoEnabled,
          onToggleVisible,
          debouncedDispatch,
          toggleAudioEnabled,
          setVolume
        ]
      );

      const { dialogContent: unsavedChangesDialog } = useUnsavedChanges(
        isDeleting ? false : isDirty || playlistState.isDirty
      );

      // Fullscreen functionality
      const handleFullscreenChange = useCallback(() => {
        const doc = document as FullscreenDocument;
        const isCurrentlyFullscreen = !!(
          document.fullscreenElement ||
          doc.webkitFullscreenElement ||
          doc.mozFullScreenElement ||
          doc.msFullscreenElement
        );
        setIsFullscreen(isCurrentlyFullscreen);
      }, []);

      const toggleFullscreen = useCallback(async () => {
        if (!videoContainerRef.current) return;

        try {
          if (!isFullscreen) {
            // Enter fullscreen
            const element = videoContainerRef.current as FullscreenElement;
            if (element.requestFullscreen) {
              await element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
              await element.webkitRequestFullscreen();
            } else if (element.mozRequestFullScreen) {
              await element.mozRequestFullScreen();
            } else if (element.msRequestFullscreen) {
              await element.msRequestFullscreen();
            }
          } else {
            // Exit fullscreen
            const doc = document as FullscreenDocument;
            if (document.exitFullscreen) {
              await document.exitFullscreen();
            } else if (doc.webkitExitFullscreen) {
              await doc.webkitExitFullscreen();
            } else if (doc.mozCancelFullScreen) {
              await doc.mozCancelFullScreen();
            } else if (doc.msExitFullscreen) {
              await doc.msExitFullscreen();
            }
          }
        } catch (error) {
          console.error('Error toggling fullscreen:', error);
        }
      }, [isFullscreen]);

      useEffect(() => {
        // Keyboard event handler for fullscreen toggle
        const handleKeyDown = (event: KeyboardEvent) => {
          // Check if F key is pressed and no modifier keys are held
          if (event.key === 'f' || event.key === 'F') {
            // Prevent triggering when user is typing in input fields
            const target = event.target as HTMLElement;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
              return;
            }

            event.preventDefault();
            toggleFullscreen();
          }
        };

        // Add fullscreen event listeners
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);

        // Add keyboard event listener
        document.addEventListener('keydown', handleKeyDown);

        return () => {
          // Cleanup event listeners
          document.removeEventListener('fullscreenchange', handleFullscreenChange);
          document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
          document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
          document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
          document.removeEventListener('keydown', handleKeyDown);
        };
      }, [handleFullscreenChange, toggleFullscreen]);

      return (
        <div
          ref={videoContainerRef}
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxWidth: '100vw',
            height: '100%',
            ...(isFullscreen && {
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 9999,
              backgroundColor: 'black'
            })
          }}
        >
          <Box
            position="relative"
            borderRadius={isFullscreen ? '0' : '2xl'}
            overflow="hidden"
            bg="blackAlpha.200"
            backdropFilter="blur(4px)"
            border={isFullscreen ? 'none' : '1px solid'}
            borderColor="whiteAlpha.100"
            width={isFullscreen ? '100%' : 'auto'}
            height={isFullscreen ? '100%' : 'auto'}
          >
            <Box
              aspectRatio={isFullscreen ? 'auto' : 16 / 9}
              bgGradient="linear(to-br, gray.800, gray.900)"
              display="flex"
              alignItems="center"
              justifyContent="center"
              width={isFullscreen ? '100%' : 'auto'}
              height={isFullscreen ? '100%' : 'auto'}
            >
              <VStack spacing={4} textAlign="center">
                <Canvas
                  canvasId={canvasId}
                  currentlyPlayingVideo={currentlyPlayingVideo}
                  isVertical={isVertical}
                  dimensions={isFullscreen ? { width: window.innerWidth, height: window.innerHeight } : dimensions}
                  canvas={canvas}
                  dragging={dragging}
                  handleStart={handleStart}
                  handleMove={handleMove}
                />
              </VStack>
            </Box>
          </Box>

          <div style={{ position: 'relative', width: '100%' }}>
            {/* Preview Quality Alert */}
            {!isFullscreen && (
              <Text
                color="white"
                fontSize="sm"
                position="absolute"
                bottom="60px"
                right={0}
                p={2}
                zIndex={1000}
                textShadow="0 0 10px black"
              >
                This is a preview. Exported video will be higher quality.
              </Text>
            )}
            <Controls
              isPlaying={isPlaying}
              onTogglePlayPause={onTogglePlayPause}
              onToggleVideoEnabled={data.transcriptionJob?.jobType === 'SCRIPT' ? undefined : onToggleVideoEnabled}
              onToggleAudioEnabled={audio.length === 0 ? undefined : () => {
                if (audioEnabled) {
                  setVolume(0);
                } else {
                  setVolume(AUDIO_VOLUME_MODIFIER);
                }
                toggleAudioEnabled();
              }}
              setPlaybackRate={setPlaybackRate}
              playbackRate={playbackRate}
              onOpenCaptionSettings={setIsCaptionsModalOpen}
              volume={volume}
              onToggleOrientation={data.croppedInfo?.length ? updateOrientation : undefined}
              isLandscape={orientation === 'HORIZONTAL'}
              onChangeVolume={v => {
                setVolume(v);
                if (v <= 0) {
                  toggleAudioEnabled(false);
                } else {
                  toggleAudioEnabled(true);
                }
              }}
              audioEnabled={audioEnabled}
              onToggleAudio={
                audio.length > 1
                  ? () => {
                    toggleAudio();
                  }
                  : undefined
              }
              onReplaceAudio={onReplaceAudio}
              duration={duration}
              onSeek={onSeek}
              onToggleFullscreen={toggleFullscreen}
              isFullscreen={isFullscreen}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
            />
          </div>

          {/* Hide other UI elements in fullscreen mode */}
          {!isFullscreen && (
            <>

              <StyledButtonGroup gap={4} flexDir="column" alignItems="flex-end">
                {isHighlight && (
                  <Button
                    variant="outline"
                    gap={3}
                    size={{ base: 'sm', md: 'md' }}
                    display="flex"
                    colorScheme="gray"
                    onClick={onStartExport}
                    isLoading={isSaving}
                  >
                    <Text as="span" display={{ base: 'none', md: 'inline' }}>
                      Export
                    </Text>
                    <GiSaveArrow size={24} />
                  </Button>
                )}
                {onGenerateVertical && !data.croppedInfo?.length && (
                  <Button
                    variant="outline"
                    gap={3}
                    size={{ base: 'sm', md: 'md' }}
                    display="flex"
                    colorScheme="gray"
                    onClick={onGenerateVertical}
                    isLoading={isGeneratingRecropData}
                    isDisabled={isGeneratingRecropData}
                  >
                    <Text as="span" display={{ base: 'none', md: 'inline' }}>
                      Generate Vertical
                    </Text>
                    <FaPortrait size={24} />
                  </Button>
                )}
              </StyledButtonGroup>

              <Timeline
                onChangeTimeVideo={onChangeTimeVideo}
                onReplaceVideoAlts={handleReplaceVideoAlternatives}
                onAddVideoAlts={handleAddVideoAlts}
                onRemoveSegment={onRemoveSegment}
                onToggleAlt={onToggleVideo}
                onSaveCaption={noop}
                generateBroll={generateBroll}
                isGeneratingBroll={isGeneratingBroll}
                metadata={metadata}
                transcript={captionWords}
                onSeek={onSeek}
                duration={duration}
                initialScale={9 / (data.transcriptionJob?.brollDuration ?? 3)}
                playlist={playlistAfterSegmentation}
                jumpCuts={jumpCuts}
                onToggleVisible={onToggleVisible}
                privateLibraryIds={data.privateLibraryIds ?? []}
                publicLibraryIds={data.publicLibraryIds ?? []}
                chatSearchRequest={chatSearchRequest}
                onChatSearchRequestHandled={() => setChatSearchRequest(null)}
              />
            </>
          )}

          {isExportModalOpen && (
            <ExportModal
              captions={captions}
              orientationType={orientation}
              onSave={async (title?: string) => {
                await onSave(title);
              }}
              videoTitle={data.title}
              isHighlight={isHighlight}
              videoAiDataId={data._id}
              isOpen={isExportModalOpen}
              onClose={onExportModalClose}
              canExportVertical={!!data.croppedInfo?.length}
            />
          )}
          {isCaptionsModalOpen && (
            <CaptionModal
              onSave={onSaveCaptionPreset}
              downloadSubtitles={downloadSubtitles}
              captions={captions}
              captionPresets={captionPresets}
              videoAiDataId={data._id}
              reloadCaptions={refetchCaptionPresets}
              isOpen={isCaptionsModalOpen}
              onClose={onCaptionsModalClose}
            />
          )}

          {dialogContent}
          {unsavedChangesDialog}
        </div>
      );
    }
  )
);
const StyledButtonGroup = styled(ButtonGroup)`
  position: absolute;
  top: 36px;
  right: 48px;
  @media screen and (max-width: 968px) {
    top: 14px;
    right: 18px;
  }
`;
