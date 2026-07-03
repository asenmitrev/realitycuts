import { useCallback, useMemo, useRef } from 'react';
import { useEffect } from 'react';
import { PlaybackManager } from '../engine';
import type {
  VideoAIData,
  PlaylistState,
  Audio,
  CaptionsState,
  HighlightSegment,
  CaptionSettings,
  VideoMetadata
} from '../types';
import { useHotkeys } from 'react-hotkeys-hook';
import _ from 'lodash';
import { RenderingEngine } from '../engine/RenderingEngine';
import { SubtitleRenderer } from '../engine/SubtitleRenderer';
import { VideoRenderer } from '../engine/VideoRenderer';
import { VideoPlaylist } from '../engine/VideoPlaylist';
import { VideoElementCache } from '../engine/VideoElementCache';
import { useVideoEditorStore } from '../stores/video-editor/store';
export const useVideoEngine = ({
  canvas,
  playlistState,
  data,
  segments,
  captions,
  captionsState
}: {
  canvas: HTMLCanvasElement | null;
  playlistState: PlaylistState;
  data: VideoAIData;
  segments: HighlightSegment[];
  captions: CaptionSettings;
  captionsState: CaptionsState;
}) => {
  const playbackRate = useVideoEditorStore(state => state.playbackRate);
  const orientation = useVideoEditorStore(state => state.orientation);
  const audioEnabled = useVideoEditorStore(state => state.audioEnabled);
  const audioIndex = useVideoEditorStore(state => state.audioIndex);
  const audio = useVideoEditorStore(state => state.audio);
  const isPlaying = useVideoEditorStore(state => state.isPlaying);
  const volume = useVideoEditorStore(state => state.volume);
  const setPlaybackRate = useVideoEditorStore(state => state.setPlaybackRate);
  const setOrientation = useVideoEditorStore(state => state.setOrientation);
  const dispatchPlaylist = useVideoEditorStore(state => state.dispatchPlaylist);
  const setAudioEnabled = useVideoEditorStore(state => state.setAudioEnabled);
  const setAudioIndex = useVideoEditorStore(state => state.setAudioIndex);
  const setAudio = useVideoEditorStore(state => state.setAudio);
  const beginTransaction = useVideoEditorStore(state => state.beginTransaction);
  const commitTransaction = useVideoEditorStore(state => state.commitTransaction);
  const setIsPlaying = useVideoEditorStore(state => state.setIsPlaying);
  const setCurrentTime = useVideoEditorStore(state => state.setCurrentTime);
  const setAbsoluteCurrentTime = useVideoEditorStore(state => state.setAbsoluteCurrentTime);
  const setCurrentBroll = useVideoEditorStore(state => state.setCurrentBroll);
  const prevServerAudioRef = useRef<Audio[]>(data.audio);
  const sourceUrl = data.source?.url ?? data.voiceOver;
  const sourceType = data.source ? 'video' : 'audio';
  // biome-ignore lint/correctness/useExhaustiveDependencies: Manager should only re-create when source changes; playlist is updated separately.
  const pbManager = useMemo(
    () => {
      return new PlaybackManager(
        sourceUrl,
        new VideoPlaylist(playlistState.videoMap, playlistState.altMap, new VideoElementCache()),
        sourceType
      );
    },
    // Manager created once per source; playlist is updated via setPlaylist in another effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sourceUrl, sourceType]
  );
  const engine = useRef(pbManager);
  const throttledSetCurrentTime = useRef(
    _.throttle((value: number, absTime: number) => {
      setCurrentTime(value);
      setAbsoluteCurrentTime(absTime);
    }, 34)
  );
  const lastSegmentEnd =
    segments.length > 0 ? Math.max(...segments.map(s => s.end)) : 0;
  const metadata = useMemo<VideoMetadata>(
    () =>
      data.source?.metadata ??
      ({ format: { duration: lastSegmentEnd }, streams: [] } as unknown as VideoMetadata),
    [data.source?.metadata, lastSegmentEnd]
  );

  useEffect(() => {
    const prevAudio = prevServerAudioRef.current;
    const newAudio = data.audio ?? [];

    const audioChanged =
      prevAudio.length !== newAudio.length || prevAudio.some((a, i) => a.preview !== newAudio[i]?.preview);

    if (!audioChanged) return;

    prevServerAudioRef.current = newAudio;
    setAudio(newAudio);
    setAudioEnabled(!!data.audioEnabled);
    setAudioIndex(data.audioIndex ?? 0);
  }, [data.audio, data.audioEnabled, data.audioIndex, setAudio, setAudioEnabled, setAudioIndex]);

  useEffect(() => {
    if (!canvas) return;
    const eng = engine.current;
    eng.init(
      segments,
      audioEnabled,
      new RenderingEngine(canvas, new SubtitleRenderer(), new VideoRenderer(canvas)),
      (relTime, absTime) => {
        throttledSetCurrentTime.current(relTime, absTime);
      },
      broll => {
        setCurrentBroll(broll ?? null);
      }
    );

    engine.current.initCaptions(captions, metadata, captionsState.transcript, canvas);
    engine.current.redraw();
    return () => {
      // eng.pause();
    };
  }, [segments, captions, canvas, captionsState.transcript, metadata, audioEnabled, setCurrentBroll]);

  useEffect(() => {
    engine.current?.updateOrientation(orientation);
  }, [orientation]);

  useHotkeys('Space', () => {
    onTogglePlayPause();
  });
  useEffect(() => {
    if (data.croppedInfo) {
      engine.current.updateRecropInfo(data.croppedInfo);
    }
  }, [data.croppedInfo]);
  useEffect(() => {
    const eng = engine.current;
    const throttledSetcurrentTime = throttledSetCurrentTime.current;
    return () => {
      throttledSetcurrentTime.cancel();
      eng.destroy();
      setCurrentTime(0);
      setAbsoluteCurrentTime(0);
    };
  }, [setCurrentTime, setAbsoluteCurrentTime]);

  useEffect(() => {
    const item = audio?.[audioIndex];
    if (canvas && item) {
      engine.current.setAudio(item);
      engine.current.toggleAudio(audioEnabled);
    }
  }, [audioIndex, audio, canvas, audioEnabled]);

  useEffect(() => {
    if (canvas) {
      engine.current.setAudioVolume(volume);
    }
  }, [volume, canvas]);

  useEffect(() => {
    if (canvas && playlistState.needsRedraw) {
      engine.current.setPlaylist(playlistState.videoMap, playlistState.altMap);
      engine.current.redraw();
    }
  }, [playlistState, canvas]);

  useEffect(() => {
    if (canvas) {
      engine.current.setPlaybackRate(playbackRate);
    }
  }, [playbackRate, canvas]);

  const toggleAudioEnabled = useCallback(
    (v?: boolean) => {
      const newV = v ?? !audioEnabled;
      dispatchPlaylist({
        type: 'SET_AUDIO_ENABLED',
        payload: { audioEnabled: newV }
      });
      engine.current.toggleAudio(newV);
    },
    [audioEnabled, dispatchPlaylist]
  );

  const toggleAudio = useCallback(() => {
    const audioLength = audio?.length ?? 0;
    if (audioLength > 1) {
      dispatchPlaylist({
        type: 'SET_AUDIO_INDEX',
        payload: { audioIndex: (audioIndex + 1) % audioLength }
      });
    }
  }, [audio, audioIndex, dispatchPlaylist]);

  const onReplaceAudio = useCallback((newAudio: Audio[]) => {
    beginTransaction();
    dispatchPlaylist({
      type: 'SET_AUDIO',
      payload: { audio: newAudio }
    });
    dispatchPlaylist({
      type: 'SET_AUDIO_INDEX',
      payload: { audioIndex: 0 }
    });
    commitTransaction();
  }, [beginTransaction, commitTransaction, dispatchPlaylist]);

  const setAudioVolume = useCallback((newVolume: number) => {
    dispatchPlaylist({
      type: 'SET_AUDIO_VOLUME',
      payload: {
        volume: newVolume
      }
    });
  }, [dispatchPlaylist]);

  const onTogglePlayPause = useCallback(() => {
    if (isPlaying) {
      engine.current.pause();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      engine.current.play();
    }
  }, [isPlaying, setIsPlaying]);

  const onSeek = useCallback(
    (v: number | number[]) => {
      if (typeof v === 'number') {
        engine.current.pause();
        setIsPlaying(false);
        engine.current.seek(v);
        setCurrentTime(v);
      }
    },
    [setCurrentTime, setIsPlaying]
  );

  const updateOrientation = useCallback(() => {
    const newOrientation = orientation === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL';
    setOrientation(newOrientation);
  }, [orientation, setOrientation]);

  return {
    audio,
    playbackRate,
    audioIndex,
    orientation,
    volume,
    audioEnabled,
    isPlaying,
    toggleAudioEnabled,
    toggleAudio,
    onReplaceAudio,
    updateOrientation,
    onSeek,
    onTogglePlayPause,
    setVolume: setAudioVolume,
    setPlaybackRate
  };
};
