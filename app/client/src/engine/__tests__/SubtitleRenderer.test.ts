import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SubtitleRenderer } from '../SubtitleRenderer';

// Mock SubtitlesOctopus
vi.mock('../../lib/subtitles-octopus', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      setTrack: vi.fn(),
      dispose: vi.fn(),
      resizeWithTimeout: vi.fn(),
      setCurrentTime: vi.fn()
    }))
  };
});

describe('SubtitleRenderer', () => {
  let renderer: SubtitleRenderer;

  beforeEach(() => {
    renderer = new SubtitleRenderer();
  });

  afterEach(() => {
    renderer.dispose();
  });

  describe('initOctopus', () => {
    it('should initialize octopus with correct options', () => {
      const options = {
        subContent: 'test subtitles',
        fonts: ['font1.ttf'],
        workerUrl: 'worker.js'
      };

      renderer.initOctopus(options);

      expect(renderer.octopus).toBeDefined();
    });

    it('should update track if octopus already exists', () => {
      const options = {
        subContent: 'test subtitles',
        fonts: ['font1.ttf'],
        workerUrl: 'worker.js'
      };

      renderer.initOctopus(options);
      const setTrackSpy = vi.spyOn(renderer.octopus!, 'setTrack');

      renderer.initOctopus({ ...options, subContent: 'new subtitles' });

      expect(setTrackSpy).toHaveBeenCalledWith('new subtitles');
    });
  });

  describe('drawSubtitles', () => {
    it('should draw subtitles when cache exists', () => {
      const mockBufferCanvas = document.createElement('canvas');
      const mockCache = {
        bufferCanvas: mockBufferCanvas,
        x: 10,
        y: 20
      };

      // @ts-expect-error - accessing private property for testing
      renderer.octopusCache = mockCache;

      const mockContext = {
        drawImage: vi.fn()
      };
      renderer.drawSubtitles(mockContext as unknown as CanvasRenderingContext2D);

      expect(mockContext.drawImage).toHaveBeenCalledWith(mockBufferCanvas, mockCache.x, mockCache.y);
    });

    it('should not draw subtitles when cache is empty', () => {
      const mockContext = {
        drawImage: vi.fn()
      };
      renderer.drawSubtitles(mockContext as unknown as CanvasRenderingContext2D);

      expect(mockContext.drawImage).not.toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should dispose octopus and clear reference', () => {
      const options = {
        subContent: 'test subtitles',
        fonts: ['font1.ttf'],
        workerUrl: 'worker.js'
      };

      renderer.initOctopus(options);
      const disposeSpy = vi.spyOn(renderer.octopus!, 'dispose');

      renderer.dispose();

      expect(disposeSpy).toHaveBeenCalled();
      expect(renderer.octopus).toBeUndefined();
    });
  });

  describe('resize', () => {
    it('should call resizeWithTimeout when octopus exists', () => {
      const options = {
        subContent: 'test subtitles',
        fonts: ['font1.ttf'],
        workerUrl: 'worker.js'
      };

      renderer.initOctopus(options);
      const resizeSpy = vi.spyOn(renderer.octopus!, 'resizeWithTimeout');

      renderer.resize();

      expect(resizeSpy).toHaveBeenCalled();
    });

    it('should not throw error when octopus does not exist', () => {
      expect(() => renderer.resize()).not.toThrow();
    });
  });

  describe('setCurrentTime', () => {
    it('should set current time when octopus exists', () => {
      const options = {
        subContent: 'test subtitles',
        fonts: ['font1.ttf'],
        workerUrl: 'worker.js'
      };

      renderer.initOctopus(options);
      const setCurrentTimeSpy = vi.spyOn(renderer.octopus!, 'setCurrentTime');

      renderer.setCurrentTime(42);

      expect(setCurrentTimeSpy).toHaveBeenCalledWith(42);
    });

    it('should not throw error when octopus does not exist', () => {
      expect(() => renderer.setCurrentTime(42)).not.toThrow();
    });
  });
});
