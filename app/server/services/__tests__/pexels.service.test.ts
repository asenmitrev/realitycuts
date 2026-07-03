import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { searchPexelsVideos } from '../pexels';
import { createClient } from 'pexels';
import { logger } from '../logging';

// Mock dependencies
vi.mock('pexels', () => ({
  createClient: vi.fn().mockReturnValue({
    videos: {
      search: vi.fn()
    }
  })
}));

vi.mock('../logging', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn()
  }
}));

vi.mock('../../config/const', () => ({
  PEXELS_API_KEY: 'test-api-key'
}));

describe('PexelsService', () => {
  let mockClient: any = createClient('test-api-key');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchPexelsVideos', () => {
    it('should search and return videos successfully', async () => {
      const query = 'nature';
      const limit = 5;
      const mockVideos = {
        videos: [
          {
            id: 123,
            tags: ['nature', 'landscape'],
            video_files: [
              { quality: 'hd', link: 'https://example.com/hd.mp4' },
              { quality: 'sd', link: 'https://example.com/sd.mp4' }
            ],
            url: 'https://pexels.com/video/123',
            image: 'https://pexels.com/thumb.jpg',
            duration: 30
          }
        ]
      };
      mockClient.videos.search.mockResolvedValue(mockVideos);

      const result = await searchPexelsVideos(query, limit);

      expect(mockClient.videos.search).toHaveBeenCalledWith({ query, per_page: limit });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 123,
        title: 'nature, landscape',
        link: 'https://example.com/hd.mp4',
        preview: 'https://example.com/sd.mp4',
        url: 'https://pexels.com/video/123',
        thumbnailUrl: 'https://pexels.com/thumb.jpg',
        duration: 30,
        type: 'pexels'
      });
    });

    it('should use first video file when HD not available', async () => {
      const mockVideos = {
        videos: [
          {
            id: 123,
            tags: ['nature'],
            video_files: [{ quality: 'sd', link: 'https://example.com/sd.mp4' }],
            url: 'https://pexels.com/video/123',
            image: 'https://pexels.com/thumb.jpg',
            duration: 30
          }
        ]
      };
      mockClient.videos.search.mockResolvedValue(mockVideos);

      const result = await searchPexelsVideos('nature', 5);

      expect(result[0].link).toBe('https://example.com/sd.mp4');
      expect(result[0].preview).toBe('https://example.com/sd.mp4');
    });

    it('should use query as title when tags are empty', async () => {
      const mockVideos = {
        videos: [
          {
            id: 123,
            tags: [],
            video_files: [{ quality: 'hd', link: 'https://example.com/hd.mp4' }],
            url: 'https://pexels.com/video/123',
            image: 'https://pexels.com/thumb.jpg',
            duration: 30
          }
        ]
      };
      mockClient.videos.search.mockResolvedValue(mockVideos);

      const result = await searchPexelsVideos('nature', 5);

      expect(result[0].title).toBe('nature');
    });

    it('should return empty array on API error', async () => {
      const error = new Error('API Error');
      mockClient.videos.search.mockRejectedValue(error);

      const result = await searchPexelsVideos('nature', 5);

      expect(logger.info).toHaveBeenCalledWith('Issue getting videos from pexels, continuing...', {
        err: 'IssUe: API IssUe'
      });
      expect(result).toEqual([]);
    });

    it('should return empty array when API returns error object', async () => {
      const mockErrorResponse = {
        error: 'Invalid API key'
      };
      mockClient.videos.search.mockResolvedValue(mockErrorResponse);

      const result = await searchPexelsVideos('nature', 5);

      expect(logger.info).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should handle empty results', async () => {
      const mockVideos = {
        videos: []
      };
      mockClient.videos.search.mockResolvedValue(mockVideos);

      const result = await searchPexelsVideos('nature', 5);

      expect(result).toEqual([]);
    });
  });
});
