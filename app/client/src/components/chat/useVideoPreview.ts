import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { VideoPreviewData, VideoPreviewClip } from './types';
import { useApiService } from '../../hooks/useApiService';
import { VideoAIData } from '../../types';
import { ApiError } from '../../service/apiService';

const MAX_CLIPS = 5;

export interface UseVideoPreviewOptions {
  data: VideoPreviewData | null;
  videoAIDataId?: string | null;
  fullVideoData?: VideoAIData | null;
  onEnded?: () => void;
}

export interface UseVideoPreviewReturn {
  clips: VideoPreviewClip[];
  currentClipIndex: number;
  isPlaying: boolean;
  isReady: boolean;
  isCompleted: boolean;
  isFinalizing: boolean;
  showRegistrationModal: boolean;
  onCloseRegistrationModal: () => void;
  play: () => Promise<void>;
  pause: () => void;
  toggle: () => Promise<void>;
  reset: () => void;
  audioRef: React.RefObject<HTMLAudioElement>;
  musicAudioRef: React.RefObject<HTMLAudioElement>;
  videoRefs: React.MutableRefObject<(HTMLVideoElement | null)[]>;
  handleTimeUpdate: () => void;
  handleAudioEnded: () => void;
  handleVideoReady: (index: number) => void;
  handleViewComplete: () => void;
  handleGoToVideo: () => void;
}

/**
 * Hook to manage video preview playback state.
 * 
 * Uses stacked video elements approach:
 * - All videos are rendered and preloaded upfront
 * - Switching clips only changes opacity (no buffering)
 * - Audio from voiceOver drives the timing
 */
export const useVideoPreview = ({
  data,
  videoAIDataId,
  fullVideoData,
  onEnded
}: UseVideoPreviewOptions): UseVideoPreviewReturn => {
  const navigate = useNavigate();
  const apiService = useApiService();
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [readyCount, setReadyCount] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const musicAudioRef = useRef<HTMLAudioElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Process segments into clips (max 5, first alternative of each)
  const clips = useMemo<VideoPreviewClip[]>(() => {
    if (!data?.segments) return [];

    return data.segments
      .slice(0, MAX_CLIPS)
      .filter(seg => seg.alternatives && seg.alternatives.length > 0)
      .map(seg => ({
        url: seg.alternatives[0].link || seg.alternatives[0].preview,
        thumbnail: seg.alternatives[0].thumbnailUrl,
        timeStart: seg.timeStart,
        timeEnd: seg.timeEnd,
        brollType: seg.alternatives[0].brollType
      }));
  }, [data?.segments]);

  // Ready when we have clips (loadeddata will be handled per-video)
  // We consider it ready once at least the first video has loaded
  useEffect(() => {
    if (clips.length > 0 && readyCount >= 1) {
      setIsReady(true);
    } else {
      setIsReady(false);
    }
  }, [clips.length, readyCount]);

  // Reset state when data changes
  useEffect(() => {
    setCurrentClipIndex(0);
    setIsPlaying(false);
    setIsCompleted(false);
    setReadyCount(0);
    setIsReady(false);
    videoRefs.current = [];
  }, [data]);

  // Set music volume when fullVideoData changes (e.g. after refetch when music is added)
  useEffect(() => {
    if (musicAudioRef.current && fullVideoData?.audioVolume !== undefined) {
      musicAudioRef.current.volume = fullVideoData.audioVolume;
    }
  }, [fullVideoData?.audioVolume, fullVideoData?.audio, fullVideoData?.audioEnabled]);

  // Handle audio timeupdate to switch visible video
  const handleTimeUpdate = useCallback(() => {
    const currentTime = audioRef.current?.currentTime ?? 0;

    // Check if we've passed the end of the last clip (preview complete)
    if (clips.length > 0) {
      const lastClip = clips[clips.length - 1];
      if (currentTime >= lastClip.timeEnd && !isCompleted) {
        // Pause everything when all preview clips are done
        setIsPlaying(false);
        setIsCompleted(true);
        setCurrentClipIndex(clips.length - 1); // Stay on last clip
        audioRef.current?.pause();
        musicAudioRef.current?.pause();
        videoRefs.current.forEach(video => video?.pause());
        onEnded?.();
        return;
      }
    }

    // Find which clip should be visible based on current time
    const newIndex = clips.findIndex(
      clip => currentTime >= clip.timeStart && currentTime < clip.timeEnd
    );

    if (newIndex !== -1 && newIndex !== currentClipIndex) {
      setCurrentClipIndex(newIndex);
    }
  }, [clips, currentClipIndex, isCompleted, onEnded]);

  // Handle audio ended
  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false);
    setIsCompleted(true);

    // Pause voiceover, music and all videos (keep at final position for completed state)
    audioRef.current?.pause();
    musicAudioRef.current?.pause();
    videoRefs.current.forEach(video => {
      if (video) {
        video.pause();
      }
    });

    onEnded?.();
  }, [onEnded]);

  // Play all media (voiceover, optional music, videos)
  const hasMusic = fullVideoData?.audioEnabled && fullVideoData?.audio?.[fullVideoData.audioIndex ?? 0];
  const play = useCallback(async () => {
    if (!audioRef.current) return;

    try {
      // Start voiceover (this drives timing)
      await audioRef.current.play();

      // Start music if enabled
      if (musicAudioRef.current && hasMusic) {
        musicAudioRef.current.play().catch(() => {
          // Ignore music play errors (e.g. autoplay policy)
        });
      }

      // Start all video elements (skip null refs — e.g. AI_PHOTO clips use img, no video ref)
      const playPromises = videoRefs.current
        .filter((video): video is HTMLVideoElement => video !== null)
        .map(video => video.play().catch(() => {
          // Ignore individual video play errors
        }));

      await Promise.all(playPromises);
      setIsPlaying(true);
    } catch (error) {
      console.warn('Failed to play preview:', error);
    }
  }, [hasMusic]);

  // Pause all media (voiceover, music, videos)
  const pause = useCallback(() => {
    audioRef.current?.pause();
    musicAudioRef.current?.pause();
    videoRefs.current.forEach(video => video?.pause());
    setIsPlaying(false);
  }, []);

  // Toggle play/pause
  const toggle = useCallback(async () => {
    if (isPlaying) {
      pause();
    } else {
      await play();
    }
  }, [isPlaying, play, pause]);

  // Reset to beginning (voiceover, music, videos)
  const reset = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    if (musicAudioRef.current) {
      musicAudioRef.current.currentTime = 0;
    }
    videoRefs.current.forEach(video => {
      if (video) {
        video.currentTime = 0;
      }
    });
    setCurrentClipIndex(0);
    setIsPlaying(false);
    setIsCompleted(false);
  }, []);

  // Handle view complete video action - finalize and navigate to progress page
  const handleViewComplete = useCallback(async () => {
    if (!videoAIDataId) {
      console.warn('No videoAIDataId available for finalization');
      return;
    }

    // Check if video already has a source (already finalized)
    if (fullVideoData?.source?.url) {
      // If already finalized, navigate to video editor instead
      navigate(`/videos/${videoAIDataId}`);
      return;
    }

    if (isFinalizing) return; // Prevent double-clicks

    try {
      setIsFinalizing(true);
      const response = await apiService.post<{ eventId: string }, { videoAIDataId: string }>('/api/chat/finalize-video', {
        videoAIDataId
      });

      if (response.eventId) {
        navigate(`/upload-progress/${response.eventId}`);
      }
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.statusCode === 403 &&
        (error.data as { error?: string })?.error === 'registration_required'
      ) {
        setShowRegistrationModal(true);
      } else {
        console.error('Failed to finalize video:', error);
      }
      setIsFinalizing(false);
    }
  }, [videoAIDataId, navigate, isFinalizing, apiService, fullVideoData]);

  // Handle go to video editor action
  const handleGoToVideo = useCallback(() => {
    if (!videoAIDataId) {
      console.warn('No videoAIDataId available');
      return;
    }
    navigate(`/videos/${videoAIDataId}`);
  }, [videoAIDataId, navigate]);

  // Track which video indices are ready (prevents double-counting)
  const readyIndices = useRef<Set<number>>(new Set());

  // Register video element ready state - called from onCanPlayThrough in component
  const handleVideoReady = useCallback((index: number) => {
    if (!readyIndices.current.has(index)) {
      readyIndices.current.add(index);
      setReadyCount(readyIndices.current.size);
    }
  }, []);

  // Reset ready tracking when data changes
  useEffect(() => {
    readyIndices.current = new Set();
  }, [data]);

  return {
    clips,
    currentClipIndex,
    isPlaying,
    isReady,
    isCompleted,
    isFinalizing,
    showRegistrationModal,
    onCloseRegistrationModal: () => setShowRegistrationModal(false),
    play,
    pause,
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
  };
};
