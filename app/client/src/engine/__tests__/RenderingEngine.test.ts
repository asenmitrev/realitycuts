import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RenderingEngine } from '../RenderingEngine';
import { PLAYBACK_STATE, VideoObject, RecroppedVideoFrame } from '../../types';
import { SubtitleRenderer } from '../SubtitleRenderer';
import { VideoRenderer } from '../VideoRenderer';

vi.mock('../convertToBlobUrl', () => ({
  convertToBlobUrl: vi.fn().mockImplementation(url => Promise.resolve(`blob: ${url}`))
}));
vi.mock('../SubtitleRenderer', () => ({
  SubtitleRenderer: vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
    resize: vi.fn(),
    resizeWithTimeout: vi.fn(),
    setCurrentTime: vi.fn(),
    initOctopus: vi.fn(),
    drawSubtitles: vi.fn()
  }))
}));
vi.mock('../VideoRenderer', () => ({
  VideoRenderer: vi.fn().mockImplementation(() => ({
    drawSource: vi.fn(),
    drawOverlayVideo: vi.fn()
  }))
}));

describe('RenderingEngine', () => {
  let canvas: HTMLCanvasElement;
  let context: CanvasRenderingContext2D;
  let engine: RenderingEngine;
  let renderer: SubtitleRenderer;
  let videoRenderer: VideoRenderer;

  beforeEach(() => {
    // Mock canvas and context
    canvas = document.createElement('canvas');
    canvas.id = 'test-canvas';
    canvas.width = 1920;
    canvas.height = 1080;
    // Create a new cache instance before each test
    HTMLMediaElement.prototype.play = vi.fn();
    HTMLMediaElement.prototype.pause = vi.fn();
    HTMLMediaElement.prototype.load = vi.fn();

    context = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      canvas,
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      drawImage: vi.fn(),
      fill: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      setTransform: vi.fn(),
      getTransform: vi.fn()
    } as unknown as CanvasRenderingContext2D;
    canvas.getContext = vi.fn().mockReturnValue(context);

    renderer = new SubtitleRenderer();
    videoRenderer = new VideoRenderer(canvas);
    engine = new RenderingEngine(canvas, renderer, videoRenderer);
  });

  afterEach(() => {
    engine.destroy();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should throw error if canvas is not found', () => {
      expect(() => new RenderingEngine(null as unknown as HTMLCanvasElement, renderer, videoRenderer)).toThrow(
        new Error('No canvas found on screen.')
      );
    });

    it('should throw error if context is not found', () => {
      vi.spyOn(canvas, 'getContext').mockReturnValue(null);
      expect(() => new RenderingEngine(canvas, renderer, videoRenderer)).toThrow(new Error('No context found.'));
    });

    it('should initialize with correct default values', () => {
      expect(engine.state).toBe(PLAYBACK_STATE.PAUSED);
      expect(engine.audioEnabled).toBe(false);
      expect(engine.buffering).toBe(false);
    });
  });

  describe('caption initialization', () => {
    it('should initialize captions with provided options', () => {
      const options = {
        subContent: 'test content',
        fonts: ['font1', 'font2'],
        workerUrl: 'worker.js'
      };
      engine.initCaptions(options);
      expect(renderer.initOctopus).toHaveBeenCalledWith(options);
    });
  });

  describe('video playback', () => {
    let video: HTMLVideoElement;
    let audio: HTMLAudioElement;

    beforeEach(() => {
      video = document.createElement('video');
      audio = document.createElement('audio');
    });

    it('should initialize source correctly', () => {
      const onPlay = vi.fn();
      const onEnd = vi.fn();

      engine.initSource(video, audio, onPlay, () => {}, onEnd, false);

      expect(engine.source).toBe(video);
      expect(engine.audio).toBe(audio);
    });

    it('should handle seek correctly', () => {
      engine.initSource(
        video,
        audio,
        () => {},
        () => {},
        () => {},
        false
      );
      vi.spyOn(video, 'load');

      engine.seek(10);
      expect(video.currentTime).toBe(10);
    });

    it('should handle seek with segments', () => {
      const segments = [
        { start: 0, end: 5 },
        { start: 10, end: 15 }
      ];

      engine.initSource(
        video,
        audio,
        () => {},
        () => {},
        () => {},
        false,
        segments
      );
      vi.spyOn(video, 'load');

      engine.seek(7);
      expect(video.currentTime).toBe(12); // Should seek to 12 (10 + 2) in second segment
    });

    it('should handle currentlyPlayingVideo setter correctly', () => {
      const videoElement = document.createElement('video');
      videoElement.play = vi.fn().mockResolvedValue(undefined);
      const videoObject = {
        element: videoElement,
        timeStart: 0,
        offsetStart: 0
      };

      engine.currentlyPlayingVideo = videoObject as VideoObject;
      expect(engine.currentlyPlayingVideo).toBe(videoObject);
      expect(videoObject.element.play).toHaveBeenCalled();
    });

    it('should handle currentlyPlayingVideo setter with undefined', () => {
      engine.currentlyPlayingVideo = undefined;
      expect(engine.currentlyPlayingVideo).toBeUndefined();
    });
  });
  describe('vertical recrop info', () => {
    it('should set vertical recrop info correctly', () => {
      const recropInfo = [{ frame: 1, crop: { x: 0, y: 0, width: 100, height: 100 } }];
      engine.verticalRecropInfo = recropInfo as unknown as RecroppedVideoFrame[];
      expect(videoRenderer.verticalRecropInfo).toBe(recropInfo);
    });
  });
  describe('buffering', () => {
    it('should handle buffering state correctly', () => {
      engine.onBuffering();
      expect(engine.buffering).toBe(true);

      engine.onEndBuffering();
      expect(engine.buffering).toBe(false);
    });
  });
  describe('buffering state', () => {
    it('should handle buffering state changes', () => {
      const video = document.createElement('video');
      const audio = document.createElement('audio');

      engine.initSource(
        video,
        audio,
        () => {},
        () => {},
        () => {},
        true
      );

      engine.buffering = true;
      expect(engine.buffering).toBe(true);

      engine.buffering = false;
      expect(engine.buffering).toBe(false);
    });
  });
  describe('cleanup', () => {
    it('should clean up resources on destroy', () => {
      const video = document.createElement('video');
      const audio = document.createElement('audio');

      engine.initSource(
        video,
        audio,
        () => {},
        () => {},
        () => {},
        false
      );

      const clearRectSpy = vi.spyOn(context, 'clearRect');
      engine.destroy();

      expect(clearRectSpy).toHaveBeenCalled();
      expect(engine.source).toBeUndefined();
      expect(engine.audio).toBeUndefined();
    });
  });

  describe('orientation', () => {
    it('should update orientation correctly', () => {
      engine.updateOrientation('VERTICAL');
      expect(engine.layout).toBe('VERTICAL');

      engine.updateOrientation('HORIZONTAL');
      expect(engine.layout).toBe('HORIZONTAL');
    });
  });
});
