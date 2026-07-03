import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VideoRenderer } from '../VideoRenderer';
import { RecroppedVideoFrame, VideoObject } from '../../types';

describe('VideoRenderer', () => {
  let canvas: HTMLCanvasElement;
  let renderer: VideoRenderer;
  let mockContext: CanvasRenderingContext2D;

  beforeEach(() => {
    // Mock canvas and context
    mockContext = {
      drawImage: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '#000'
    } as unknown as CanvasRenderingContext2D;

    canvas = {
      getContext: vi.fn().mockReturnValue(mockContext),
      width: 1920,
      height: 1080
    } as unknown as HTMLCanvasElement;

    renderer = new VideoRenderer(canvas);
  });

  describe('constructor', () => {
    it('should initialize with default horizontal layout', () => {
      expect(renderer.layout).toBe('VERTICAL');
    });

    it('should throw error if context cannot be created', () => {
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue(null)
      } as unknown as HTMLCanvasElement;

      const consoleSpy = vi.spyOn(console, 'error');
      new VideoRenderer(mockCanvas);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get 2D context from canvas');
    });
  });

  describe('drawOverlayVideo', () => {
    it('should draw even if source is missing (uses canvas dimensions)', () => {
      const currentlyPlayingVideo = { videoWidth: 1280, videoHeight: 720 } as HTMLVideoElement;
      const currentlyPlayingVideoObject: VideoObject = {
        url: '',
        timeStart: 0,
        timeEnd: 0,
        offsetStart: 0,
        duration: 0,
        keywords: '',
        type: 'pinecone',
        score: 0,
        id: 0,
        thumbnail: '',
        leftPosition: 0,
        topPosition: 0,
        isVertical: false,
        link: '',
        isFocused: false,
        title: '',
        isVisible: true
      };

      renderer.drawOverlayVideo(
        null,
        currentlyPlayingVideo,
        currentlyPlayingVideoObject
      );
      expect(mockContext.drawImage).toHaveBeenCalledWith(
        currentlyPlayingVideo,
        0,
        0,
        1280,
        720,
        0,
        0,
        1920,
        1080
      );
    });

    it.each([
      {
        name: 'center positioning with 1280x720',
        source: { videoWidth: 1920, videoHeight: 1080 },
        overlay: { videoWidth: 1280, videoHeight: 720 },
        position: { leftPosition: 0.5, topPosition: 0.5 },
        expected: [0, 0, 1280, 720, 0, 0, 1920, 1080]
      },
      {
        name: 'top-left positioning with 640x360',
        source: { videoWidth: 1920, videoHeight: 1080 },
        overlay: { videoWidth: 500, videoHeight: 500 },
        position: { leftPosition: 0, topPosition: 0 },
        expected: [-0, 0, 500, 281.25, 0, 0, 1920, 1080]
      },
      {
        name: 'bottom-right positioning with 960x540',
        source: { videoWidth: 1920, videoHeight: 1080 },
        overlay: { videoWidth: 540, videoHeight: 960 },
        position: { leftPosition: 1, topPosition: 1 },
        expected: [0, 328.13, 540, 303.75, 0, 0, 1920, 1080]
      },
      {
        name: 'custom positioning with 800x450',
        source: { videoWidth: 1920, videoHeight: 1080 },
        overlay: { videoWidth: 800, videoHeight: 450 },
        position: { leftPosition: 0.25, topPosition: 0.75 },
        expected: [0, 0, 800, 450, 0, 0, 1920, 1080]
      },
      {
        name: 'center positioning with 1000x500',
        source: { videoWidth: 1080, videoHeight: 1920 },
        overlay: { videoWidth: 1000, videoHeight: 500 },
        position: { leftPosition: 0.5, topPosition: 0.5 },
        expected: [27.78, 0, 888.89, 500, 0, 0, 1920, 1080]
      },
      {
        name: 'top-left positioning with 640x640',
        source: { videoWidth: 1080, videoHeight: 1920 },
        overlay: { videoWidth: 640, videoHeight: 640 },
        position: { leftPosition: 0, topPosition: 0 },
        expected: [0, 0, 640, 360, 0, 0, 1920, 1080]
      },
      {
        name: 'bottom-right positioning with 1920x1080',
        source: { videoWidth: 1080, videoHeight: 1920 },
        overlay: { videoWidth: 1920, videoHeight: 1080 },
        position: { leftPosition: 1, topPosition: 1 },
        expected: [0, 0, 1920, 1080, 0, 0, 1920, 1080]
      },
      {
        name: 'custom positioning with 450x800',
        source: { videoWidth: 1080, videoHeight: 1920 },
        overlay: { videoWidth: 600, videoHeight: 800 },
        position: { leftPosition: 0.25, topPosition: 0.75 },
        expected: [0, 173.44, 600, 337.5, 0, 0, 1920, 1080]
      }
    ])('should draw overlay video with $name', ({ source, overlay, position, expected }) => {
      const sourceVideo = { ...source } as HTMLVideoElement;
      const currentlyPlayingVideo = { ...overlay } as HTMLVideoElement;

      const currentlyPlayingVideoObject: VideoObject = {
        url: '',
        timeStart: 0,
        timeEnd: 0,
        offsetStart: 0,
        duration: 0,
        keywords: '',
        type: 'pinecone',
        score: 0,
        id: 0,
        thumbnail: '',
        leftPosition: position.leftPosition,
        topPosition: position.topPosition,
        isVertical: false,
        link: '',
        isFocused: false,
        title: '',
        isVisible: true
      };

      renderer.drawOverlayVideo(sourceVideo, currentlyPlayingVideo, currentlyPlayingVideoObject);
      expect(mockContext.drawImage).toHaveBeenCalledWith(currentlyPlayingVideo, ...expected);
    });
  });

  describe('drawSource', () => {
    it('should not draw if source is missing', () => {
      renderer.drawSource(null as unknown as HTMLVideoElement);
      expect(mockContext.drawImage).not.toHaveBeenCalled();
      expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, 1920, 1080);
    });

    it('should draw standard source in horizontal layout', () => {
      const video = {
        videoWidth: 1920,
        videoHeight: 1080,
        currentTime: 0
      } as HTMLVideoElement;

      renderer.layout = 'HORIZONTAL';
      renderer.drawSource(video);
      expect(mockContext.drawImage).toHaveBeenCalledWith(video, 0, 0, 1920, 1080);
    });

    it('should draw vertical source with recrop info', () => {
      const video = {
        videoWidth: 1920,
        videoHeight: 1080,
        currentTime: 0
      } as HTMLVideoElement;

      const recropInfo: RecroppedVideoFrame[] = [
        {
          x1: 0,
          y1: 0,
          x2: 1080,
          y2: 1920,
          frameStart: 0,
          frameEnd: 1,
          timeStart: 0,
          timeEnd: 1
        }
      ];

      renderer.layout = 'VERTICAL';
      renderer.verticalRecropInfo = recropInfo;
      renderer.drawSource(video);
      expect(mockContext.drawImage).toHaveBeenCalledWith(video, 0, 0, 1080, 1920, 0, 0, 1920, 1080);
    });
  });
});
