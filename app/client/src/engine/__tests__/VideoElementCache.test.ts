import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VideoElementCache } from '../VideoElementCache';
import { VideoObject } from '../../types';

describe('VideoElementCache', () => {
  let cache: VideoElementCache;
  const mockUrl = 'http://localhost:3000/mock-video';
  const mockId = 1;

  beforeEach(() => {
    // Create a new cache instance before each test
    HTMLMediaElement.prototype.play = vi.fn();
    HTMLMediaElement.prototype.pause = vi.fn();
    HTMLMediaElement.prototype.load = vi.fn();
    // Mock src property
    Object.defineProperty(HTMLMediaElement.prototype, 'src', {
      get: function () {
        return this._src || '';
      },
      set: function (value) {
        this._src = value;
      }
    });
    cache = new VideoElementCache(3); // Small cache size for testing
  });

  afterEach(() => {
    // Clean up after each test
    cache.clear();
  });

  describe('initialization', () => {
    it('should create cache with specified size', () => {
      expect(cache.length).toBe(3);
    });

    it('should initialize cache items', () => {
      cache.init();
      // After initialization, all elements should be ready
      expect(cache.length).toBe(3);
    });
  });

  describe('getElementAndLinkToNode', () => {
    it('should return a video element and link it to the node', () => {
      const element = cache.getElementAndLinkToNode(mockUrl, mockId.toString());

      expect(element).toBeDefined();
      expect(element instanceof HTMLVideoElement).toBe(true);
    });

    it('should reuse existing element for same url and id', () => {
      const element1 = cache.getElementAndLinkToNode(mockUrl, mockId.toString());
      const element2 = cache.getElementAndLinkToNode(mockUrl, mockId.toString());
      expect(element1).toBe(element2);
    });

    it('should create new element when cache is full', () => {
      // Fill up the cache
      const element1 = cache.getElementAndLinkToNode('url1', '1');
      const element2 = cache.getElementAndLinkToNode('url2', '2');
      const element3 = cache.getElementAndLinkToNode('url3', '3');
      const element4 = cache.getElementAndLinkToNode('url4', '4');

      expect(cache.length).toBe(4); // Cache should grow
      expect(element4).toBeDefined();
      expect(element4).not.toBe(element1);
      expect(element4).not.toBe(element2);
      expect(element4).not.toBe(element3);
    });
  });

  describe('unlinkVideoObjectFromElement', () => {
    it('should unlink video object from element and clean up resources', async () => {
      const element = cache.getElementAndLinkToNode(mockUrl, mockId.toString());
      element.src = mockUrl;
      const videoObject: VideoObject = {
        element,
        id: mockId,
        url: mockUrl,
        timeStart: 0,
        timeEnd: 0,
        offsetStart: 0,
        duration: 0,
        isVisible: true,
        keywords: '',
        type: 'pinecone',
        score: 0,
        thumbnail: '',
        leftPosition: 0,
        topPosition: 0,
        isVertical: false,
        link: '',
        isFocused: false,
        title: ''
      };

      // Mock URL.revokeObjectURL
      const originalRevokeObjectURL = URL.revokeObjectURL;
      URL.revokeObjectURL = vi.fn();

      cache.unlinkVideoObjectFromElement(videoObject);

      // Wait for the next tick to allow src to be updated
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(videoObject.element).toBeUndefined();
      expect(URL.revokeObjectURL).toHaveBeenCalled();
      expect(element.pause).toHaveBeenCalled();
      expect(element.load).toHaveBeenCalled();
      expect(element.src).toBe('');

      // Restore original URL.revokeObjectURL
      URL.revokeObjectURL = originalRevokeObjectURL;
    });
  });

  describe('clear', () => {
    it('should clear all cache items and release resources', () => {
      // Add some elements to the cache
      const item1 = cache.getElementAndLinkToNode('url1', '1');
      const item2 = cache.getElementAndLinkToNode('url2', '2');
      item1.src = mockUrl;
      item2.src = mockUrl + '2';
      // Mock URL.revokeObjectURL
      const originalRevokeObjectURL = URL.revokeObjectURL;
      URL.revokeObjectURL = vi.fn();

      cache.clear();

      expect(cache.length).toBe(3); // Cache size should remain the same
      expect(URL.revokeObjectURL).toHaveBeenCalled();

      // Restore original URL.revokeObjectURL
      URL.revokeObjectURL = originalRevokeObjectURL;
    });
  });
});
