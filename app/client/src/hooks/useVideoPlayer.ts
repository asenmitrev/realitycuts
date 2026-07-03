import { useCallback, useMemo, useEffect } from 'react';
import type { Segment, VideoAIData, VideoAlternative, VideoObject, HighlightSegment } from '../types';
import { debounce } from 'lodash';
import { useVideoTimelineRecutter } from './useVideoTimelineRecutter';
import { useVideoEditorStore, useVideoEditorStoreApi } from '../stores/video-editor/store';
export const useVideoPlayer = ({
  data,
  segments,
  awaitConfirmation
}: {
  data: VideoAIData;
  segments: HighlightSegment[];
  awaitConfirmation: () => Promise<void>;
}) => {
  const playlistState = useVideoEditorStore(state => state.playlistState);
  const playlistDispatch = useVideoEditorStore(state => state.dispatchPlaylist);
  const hydratePlaylist = useVideoEditorStore(state => state.hydratePlaylist);
  const editorStore = useVideoEditorStoreApi();
  useEffect(() => {
    hydratePlaylist(data);
  }, [hydratePlaylist, data]);
  const debouncedDispatch = useMemo(() => debounce(playlistDispatch, 100), [playlistDispatch]);

  const onToggleVideo = (video: VideoObject) => {
    playlistDispatch({
      type: 'TOGGLE_CURRENT_ALT_VARIATION',
      payload: {
        video
      }
    });
  };

  const onToggleVideoEnabled = () => {
    playlistDispatch({
      type: 'TOGGLE_CURRENT_ALT_ENABLED',
      payload: {
        currentTime: editorStore.getState().currentTime
      }
    });
  };

  const onRemoveSegment = useCallback(
    async (video: VideoObject) => {
      await awaitConfirmation();
      playlistDispatch({
        type: 'REMOVE_SEGMENT',
        payload: {
          video
        }
      });
    },
    [playlistDispatch, awaitConfirmation]
  );
  const onChangeTimeVideo = useCallback(
    (video: VideoObject, timeStart: number, timeEnd: number, offsetStart: number) => {
      const timeStartDelta = timeStart - video.timeStart;
      const timeEndDelta = timeEnd - video.timeEnd;

      playlistDispatch({
        type: 'CHANGE_VIDEO_TIME',
        payload: {
          video,
          timeStart: (video.originalTimeStart ?? video.timeStart) + timeStartDelta,
          timeEnd: (video.originalTimeEnd ?? video.timeEnd) + timeEndDelta,
          offsetStart
        }
      });
    },
    [playlistDispatch]
  );

  const handleReplaceVideoAlternatives = useCallback(
    (video: VideoObject, alternatives: VideoAlternative[], keywords: string) => {
      playlistDispatch({
        type: 'REPLACE_ALTS',
        payload: {
          video,
          alternatives,
          keywords
        }
      });
    },
    [playlistDispatch]
  );

  const handleAddVideoAlts = useCallback(
    (timeStart: number, timeEnd: number, alternatives: VideoAlternative[], keywords: string) => {
      let end = timeEnd;
      if (timeEnd - timeStart > 3) {
        end = timeStart + 3;
      }
      playlistDispatch({
        type: 'ADD_ALTS',
        payload: {
          timeStart,
          timeEnd: end,
          alternatives,
          keywords
        }
      });
    },
    [playlistDispatch]
  );

  const onToggleVisible = useCallback(
    (video: VideoObject) => {
      playlistDispatch({
        type: 'TOGGLE_VIDEO_VISIBLE',
        payload: {
          video
        }
      });
    },
    [playlistDispatch]
  );

  const handleReplaceSegments = (segments: Segment[], startTime: number, endTime: number) => {
    return playlistDispatch({
      type: 'REPLACE_SEGMENTS',
      payload: {
        segments,
        timeStart: startTime,
        timeEnd: endTime
      }
    });
  };

  const playlistAfterSegmentation = useVideoTimelineRecutter(segments ?? [], playlistState.playlist);

  const currentlyPlayingVideo = useMemo(() => {
    return playlistAfterSegmentation[0]; // TODO: Fix
  }, [playlistAfterSegmentation]);

  return {
    playlistState,
    playlistAfterSegmentation,
    debouncedDispatch,
    currentlyPlayingVideo,
    handleReplaceSegments,
    onToggleVideo,
    onToggleVideoEnabled,
    onRemoveSegment,
    onChangeTimeVideo,
    handleReplaceVideoAlternatives,
    handleAddVideoAlts,
    onToggleVisible
  };
};
