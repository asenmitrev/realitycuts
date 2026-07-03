import { describe, it, expect, beforeEach } from 'vitest';
import { VideoElementCacheItem } from '../VideoElementCacheItem';

describe('VideoElementCacheItem', () => {
  let cacheItem: VideoElementCacheItem;
  const testUrl = 'https://example.com/video.mp4';
  const testId = 'test-video-1';

  beforeEach(() => {
    cacheItem = new VideoElementCacheItem(testUrl, testId);
  });

  it('should create a VideoElementCacheItem with correct properties', () => {
    expect(cacheItem._id).toBe(testId);
    expect(cacheItem._url).toBe(testUrl);
    expect(cacheItem._element).toBeInstanceOf(HTMLVideoElement);
  });

  it('should create a video element with correct attributes', () => {
    const element = cacheItem.element;
    expect(element.getAttribute('crossorigin')).toBe('anonymous');
    expect(element.getAttribute('webkit-playsinline')).toBe('');
    expect(element.getAttribute('playsinline')).toBe('');
    expect(element.preload).toBe('auto');
  });

  it('should allow getting and setting the video element', () => {
    const newElement = document.createElement('video');
    cacheItem.element = newElement;
    expect(cacheItem.element).toBe(newElement);
  });
});
