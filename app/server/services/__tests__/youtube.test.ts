import { describe, test, expect } from 'vitest';
import { extractVideoId } from '../youtube';

describe('YouTube Service', () => {
  describe('extractVideoId', () => {
    test('extracts ID from standard YouTube URL', () => {
      expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    test('extracts ID from YouTube URL without www', () => {
      expect(extractVideoId('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    test('extracts ID from YouTube URL without https', () => {
      expect(extractVideoId('youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    test('extracts ID from youtu.be short URL', () => {
      expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    test('extracts ID from YouTube shorts URL', () => {
      expect(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    test('extracts ID from YouTube embed URL', () => {
      expect(extractVideoId('https://youtu.be/AR21G9PNUH8?si=JQQ4Nv_RdQAYjcDu')).toBe('AR21G9PNUH8');
    });

    test('extracts ID from YouTube embed URL', () => {
      expect(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    test('returns null for invalid YouTube URL', () => {
      expect(extractVideoId('https://example.com/video')).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(extractVideoId('')).toBeNull();
    });

    test('handles URLs with additional query parameters', () => {
      expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s')).toBe('dQw4w9WgXcQ');
    });
  });
});
