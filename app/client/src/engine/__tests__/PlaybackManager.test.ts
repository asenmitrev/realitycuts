import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlaybackManager } from '../PlaybackManager';
import { VideoPlaylist } from '../VideoPlaylist';
import { RenderingEngine } from '../RenderingEngine';
import { PLAYBACK_STATE, HighlightSegment, AudioData, CaptionSettings, VideoMetadata, WordBase } from '../../types';
import { VideoElementCache } from '../VideoElementCache';
import { SubtitleRenderer } from '../SubtitleRenderer';
import { VideoRenderer } from '../VideoRenderer';
// Mock dependencies
vi.mock('../VideoPlaylist', () => ({
  VideoPlaylist: vi.fn().mockImplementation(() => ({
    handlePlay: vi.fn().mockReturnValue([null, null]),
    reloadCache: vi.fn(),
    destroy: vi.fn(),
    setPlaylist: vi.fn(),
    updatePlaybackRate: vi.fn()
  }))
}));

vi.mock('../RenderingEngine', () => ({
  RenderingEngine: vi.fn().mockImplementation(() => ({
    initSource: vi.fn(),
    initCaptions: vi.fn(),
    draw: vi.fn(),
    destroy: vi.fn(),
    state: PLAYBACK_STATE.PAUSED,
    audioEnabled: false,
    currentlyPlayingVideo: undefined,
    updateOrientation: vi.fn(),
    seek: vi.fn()
  }))
}));

vi.mock('../convertToBlobUrl', () => ({
  convertToBlobUrl: vi.fn().mockImplementation(url => Promise.resolve(`blob:${url}`))
}));

describe('PlaybackManager', () => {
  let playbackManager: PlaybackManager;
  const mockCanvas = document.createElement('canvas');
  let mockPlaylist: VideoPlaylist;
  let mockRenderer: RenderingEngine;
  const testUrl = 'https://example.com/video.mp4';

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock HTML elements
    HTMLMediaElement.prototype.play = vi.fn();
    HTMLMediaElement.prototype.pause = vi.fn();
    HTMLMediaElement.prototype.load = vi.fn();

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
      clearRect: vi.fn()
    } as unknown as CanvasRenderingContext2D);
    // Create instance
    mockPlaylist = new VideoPlaylist([], [], new VideoElementCache());
    playbackManager = new PlaybackManager(testUrl, mockPlaylist, 'video');
    mockRenderer = new RenderingEngine(mockCanvas, new SubtitleRenderer(), new VideoRenderer(mockCanvas));
  });

  afterEach(() => {
    playbackManager.destroy();
  });

  describe('initialization', () => {
    it('should initialize with correct default values', () => {
      // @ts-expect-error - accessing private property for testing
      expect(playbackManager.currentTime).toBe(0);
      // @ts-expect-error - accessing private property for testing
      expect(playbackManager.source.url).toBe(testUrl);
      // @ts-expect-error - accessing private property for testing
      expect(playbackManager.source.element).toBeInstanceOf(HTMLVideoElement);
    });

    it('should initialize with correct video element properties', () => {
      // @ts-expect-error - accessing private property for testing
      const videoElement = playbackManager.source.element as HTMLVideoElement | undefined;
      if (!videoElement) throw new Error('Video element should be defined');

      expect(videoElement.volume).toBe(1);
      expect(videoElement.muted).toBe(false);
      expect(videoElement.autoplay).toBe(false);
      expect(videoElement.loop).toBe(false);
      expect(videoElement.playsInline).toBe(true);
    });
  });

  describe('init', () => {
    it('should initialize renderer and callbacks', () => {
      const segments: HighlightSegment[] = [];
      const onPlay = vi.fn();
      const onBrollChange = vi.fn();

      playbackManager.init(segments, true, mockRenderer, onPlay, onBrollChange);

      expect(mockRenderer.initSource).toHaveBeenCalled();
      expect(playbackManager.onPlay).toBe(onPlay);
      // @ts-expect-error - accessing private property for testing
      expect(playbackManager.onBrollChange).toBe(onBrollChange);
    });

    it('should update segments if renderer already exists', () => {
      const segments: HighlightSegment[] = [];
      playbackManager.init(segments, true, mockRenderer, vi.fn(), vi.fn());
      playbackManager.init(segments, true, mockRenderer, vi.fn(), vi.fn());

      expect(mockRenderer.initSource).toHaveBeenCalledTimes(1);
    });
  });

  describe('playback control', () => {
    beforeEach(() => {
      playbackManager.init([], true, mockRenderer, vi.fn(), vi.fn());
    });

    it('should play source video and audio', async () => {
      await playbackManager.play();
      // @ts-expect-error - accessing private property for testing
      expect(playbackManager.source.element?.play).toHaveBeenCalled();
      expect(mockRenderer.state).toBe(PLAYBACK_STATE.PLAYING);
    });

    it('should pause source video and audio', () => {
      playbackManager.pause();
      // @ts-expect-error - accessing private property for testing
      expect(playbackManager.source.element?.pause).toHaveBeenCalled();
      expect(mockRenderer.state).toBe(PLAYBACK_STATE.PAUSED);
    });

    it('should seek to correct time', () => {
      const seekTime = 5;
      playbackManager.seek(seekTime);
      expect(mockRenderer.seek).toHaveBeenCalledWith(seekTime);
    });
  });

  describe('audio control', () => {
    const mockAudioData: AudioData = {
      id: 1,
      preview: 'https://example.com/audio.mp3',
      title: 'Test Audio',
      audioType: 'music',
      thumbnailUrl: 'https://example.com/thumbnail.jpg',
      waveformUrl: 'https://example.com/waveform.json',
      duration: 180,
      bpm: 120
    };

    beforeEach(() => {
      playbackManager.init([], true, mockRenderer, vi.fn(), vi.fn());
    });

    it('should initialize audio with correct properties', async () => {
      await playbackManager.setAudio(mockAudioData);
      // @ts-expect-error - accessing private property for testing
      expect(playbackManager.audio).toBeInstanceOf(HTMLAudioElement);
      // @ts-expect-error - accessing private property for testing
      expect(playbackManager.audio?.volume).toBe(0.1);
    });

    it('should toggle audio correctly', () => {
      playbackManager.toggleAudio(false);
      expect(mockRenderer.audioEnabled).toBe(false);

      playbackManager.toggleAudio(true);
      expect(mockRenderer.audioEnabled).toBe(true);
    });

    it('should set audio volume correctly', () => {
      const volume = 0.5;
      playbackManager.setAudioVolume(volume);
      // @ts-expect-error - accessing private property for testing
      expect(playbackManager.audioVolume).toBe(volume);
    });
  });

  describe('captions', () => {
    const mockCaptions: CaptionSettings = {
      primaryColor: '#ffffff',
      outlineColor: '#000000',
      highlightedWordColor: '#ffffff',
      fontFamily: 'Montserrat-Bold',
      isUppercase: true,
      maxCharactersPerLine: 20,
      numberOfLines: 1,
      type: 'WORD_HIGHLIGHT',
      fontSize: 90,
      activeWordFontSize: 90,
      verticalFontSize: 120,
      verticalActiveWordFontSize: 120,
      marginV: 15,
      outlineWidth: 5,
      shadow: 4
    };

    const mockMetadata = {
      streams: [
        {
          codec_type: 'video',
          width: 1920,
          height: 1080,
          index: 0,
          codec_name: 'h264',
          codec_long_name: 'H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10',
          profile: 2,
          level: '41',
          r_frame_rate: '30/1',
          avg_frame_rate: '30/1',
          time_base: '1/30',
          start_pts: 0,
          start_time: 0,
          duration_ts: '1800',
          duration: '60',
          bit_rate: '5000000',
          nb_frames: '1800',
          disposition: {
            default: 1,
            dub: 0,
            original: 0,
            comment: 0,
            lyrics: 0,
            karaoke: 0,
            forced: 0,
            hearing_impaired: 0,
            visual_impaired: 0,
            clean_effects: 0,
            attached_pic: 0,
            timed_thumbnails: 0
          }
        }
      ]
    } as VideoMetadata;

    const mockWords: WordBase[] = [];

    it('should initialize captions with correct options', () => {
      const canvas = document.createElement('canvas');
      playbackManager.init([], true, mockRenderer, vi.fn(), vi.fn());
      playbackManager.initCaptions(mockCaptions, mockMetadata, mockWords, canvas);
      expect(mockRenderer.initCaptions).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should clean up resources on destroy', () => {
      playbackManager.init([], true, mockRenderer, vi.fn(), vi.fn());
      playbackManager.destroy();

      expect(mockPlaylist.destroy).toHaveBeenCalled();
      expect(mockRenderer.destroy).toHaveBeenCalled();
      expect(playbackManager.onPlay).toBeUndefined();
    });
  });

  describe('playback rate', () => {
    it('should set playback rate for source video and audio', () => {
      const rate = 1.5;
      playbackManager.setPlaybackRate(rate);
      // @ts-expect-error - accessing private property for testing
      expect(playbackManager.source.element?.playbackRate).toBe(rate);
      expect(mockPlaylist.updatePlaybackRate).toHaveBeenCalledWith(rate);
    });

    it('should not set invalid playback rate', () => {
      // @ts-expect-error - accessing private property for testing
      const originalRate = playbackManager.source.element?.playbackRate;
      playbackManager.setPlaybackRate(0);
      // @ts-expect-error - accessing private property for testing
      expect(playbackManager.source.element?.playbackRate).toBe(originalRate);
    });
  });

  describe('orientation', () => {
    it('should update orientation correctly', () => {
      playbackManager.init([], true, mockRenderer, vi.fn(), vi.fn());
      playbackManager.updateOrientation('VERTICAL');
      expect(mockRenderer.updateOrientation).toHaveBeenCalledWith('VERTICAL');
    });
  });
});
