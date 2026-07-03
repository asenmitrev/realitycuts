import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { VideoPlaylist } from '../VideoPlaylist';
import { VideoElementCache } from '../VideoElementCache';
import { VideoObject } from '../../types';

vi.mock('../convertToBlobUrl', () => ({
  convertToBlobUrl: vi.fn().mockImplementation(url => Promise.resolve(`blob: ${url}`))
}));

describe('VideoPlaylist', () => {
  let videoPlaylist: VideoPlaylist;
  let mockCache: VideoElementCache;
  let mockVideoMap: VideoObject[][];
  let mockAltMap: number[];

  const createMockVideoObject = (url: string, timeStart: number, timeEnd: number, altId: string): VideoObject => ({
    url,
    timeStart,
    timeEnd,
    altId,
    offsetStart: 0,
    duration: timeEnd - timeStart,
    isVisible: true,
    keywords: '',
    type: 'pinecone',
    score: 1,
    id: 1,
    thumbnail: '',
    leftPosition: 0,
    topPosition: 0,
    isVertical: false,
    link: '',
    isFocused: false,
    title: '',
    element: undefined
  });

  beforeEach(() => {
    // Mock video elements
    const mockVideoElement = {
      setAttribute: vi.fn(),
      pause: vi.fn(),
      src: '',
      currentTime: 0,
      volume: 0,
      loop: false,
      autoplay: false,
      muted: false,
      playbackRate: 1
    };

    // Mock cache
    mockCache = {
      getElementAndLinkToNode: vi.fn().mockReturnValue(mockVideoElement),
      unlinkVideoObjectFromElement: vi.fn(),
      clear: vi.fn()
    } as unknown as VideoElementCache;

    // Mock video objects
    mockVideoMap = [
      [createMockVideoObject('video1.mp4', 0, 10, 'alt1'), createMockVideoObject('video2.mp4', 0, 10, 'alt2')],
      [createMockVideoObject('video3.mp4', 10, 20, 'alt1'), createMockVideoObject('video4.mp4', 10, 20, 'alt2')],
      [createMockVideoObject('video5.mp4', 25, 30, 'alt1'), createMockVideoObject('video6.mp4', 25, 30, 'alt2')]
    ];

    mockAltMap = [0, 0, 1]; // Initially select first video in each playlist

    videoPlaylist = new VideoPlaylist(mockVideoMap, mockAltMap, mockCache);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided video map and alt map', () => {
      expect(videoPlaylist['_videoMap']).toEqual(mockVideoMap);
      expect(videoPlaylist['altMap']).toEqual(mockAltMap);
    });
  });

  describe('handlePlay', () => {
    it('should return current and next video for given time', () => {
      const [current, next] = videoPlaylist.handlePlay(5);
      expect(current).toEqual(mockVideoMap[0][0]);
      expect(next).toEqual(mockVideoMap[1][0]);
    });

    it('should return undefined for invalid time', () => {
      const [current, next] = videoPlaylist.handlePlay(100);
      expect(current).toBeUndefined();
      expect(next).toBeUndefined();
    });

    it('should return undefined for gap time', () => {
      const [current, next] = videoPlaylist.handlePlay(21);
      expect(current).toBeUndefined();
      expect(next).toEqual(mockVideoMap[2][1]);
    });

    it('should handle alt video selection correctly', () => {
      // Test with alt2 selected for first segment
      const altMapWithAlt2 = [1, 0, 1];
      videoPlaylist = new VideoPlaylist(mockVideoMap, altMapWithAlt2, mockCache);
      const [current, next] = videoPlaylist.handlePlay(5);
      expect(current).toEqual(mockVideoMap[0][1]); // Should be video2.mp4
      expect(next).toEqual(mockVideoMap[1][0]); // Should be video3.mp4
    });

    it('should handle mixed alt selections across segments', () => {
      const mixedAltMap = [0, 1, 0];
      videoPlaylist = new VideoPlaylist(mockVideoMap, mixedAltMap, mockCache);
      const [current, next] = videoPlaylist.handlePlay(15);
      expect(current).toEqual(mockVideoMap[1][1]); // Should be video4.mp4
      expect(next).toEqual(mockVideoMap[2][0]); // Should be video5.mp4
    });
  });

  describe('reloadCache', () => {
    it('should cache correct videos based on alt selection', async () => {
      const altMapWithAlt2 = [1, 1, 0];
      videoPlaylist = new VideoPlaylist(mockVideoMap, altMapWithAlt2, mockCache);

      // Trigger cache reload at time 5
      videoPlaylist.handlePlay(5);

      // Verify that the correct videos are cached
      expect(mockCache.getElementAndLinkToNode).toHaveBeenCalledWith('video2.mp4', 'alt2');
      expect(mockCache.getElementAndLinkToNode).toHaveBeenCalledWith('video4.mp4', 'alt2');
    });

    it('should uncache old videos when switching segments', async () => {
      // First play at segment 0
      videoPlaylist.handlePlay(5);

      // Then play at segment 1
      videoPlaylist.handlePlay(15);

      // Wait for the setTimeout to complete and verify uncache was called
      await vi.waitFor(() => {
        expect(mockCache.unlinkVideoObjectFromElement).toHaveBeenCalledWith(mockVideoMap[0][0]);
        expect(mockCache.unlinkVideoObjectFromElement).toHaveBeenCalledWith(mockVideoMap[0][1]);
      });
    });
  });

  describe('setPlaylist', () => {
    it('should update playlist and handle play', () => {
      const newVideoMap = [[createMockVideoObject('newVideo1.mp4', 0, 10, 'alt1')]];
      const newAltMap = [0];

      videoPlaylist.setPlaylist(newVideoMap, newAltMap, 5);
      expect(videoPlaylist['_videoMap']).toEqual(newVideoMap);
      expect(videoPlaylist['altMap']).toEqual(newAltMap);
    });

    it('should maintain correct alt selection after playlist update', () => {
      const newVideoMap = [
        [createMockVideoObject('newVideo1.mp4', 0, 10, 'alt1'), createMockVideoObject('newVideo2.mp4', 0, 10, 'alt2')]
      ];
      const newAltMap = [1]; // Select alt2

      videoPlaylist.setPlaylist(newVideoMap, newAltMap, 5);
      const [current] = videoPlaylist.handlePlay(5);
      expect(current).toEqual(newVideoMap[0][1]); // Should be newVideo2.mp4
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      URL.revokeObjectURL = vi.fn();
      videoPlaylist.destroy();
      expect(mockCache.unlinkVideoObjectFromElement).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalled();
      expect(mockCache.clear).toHaveBeenCalled();
    });
  });

  describe('updatePlaybackRate', () => {
    it('should update playback rate for all videos', () => {
      const newRate = 1.5;
      videoPlaylist.updatePlaybackRate(newRate);
      mockVideoMap.forEach(altMap => {
        altMap.forEach(videoObject => {
          if (videoObject.element) {
            expect(videoObject.element.playbackRate).toBe(newRate);
          }
        });
      });
    });
  });
});
