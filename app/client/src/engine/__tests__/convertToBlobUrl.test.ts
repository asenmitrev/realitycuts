import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { convertToBlobUrl } from '../convertToBlobUrl';

describe('convertToBlobUrl', () => {
  const mockUrl = 'https://example.com/video.mp4';
  const mockBlob = new Blob(['test'], { type: 'video/mp4' });
  const mockBlobUrl = 'blob:http://localhost:1234/abc-123';

  beforeEach(() => {
    // Mock URL.createObjectURL
    URL.createObjectURL = vi.fn();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockBlobUrl);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should convert a URL to a blob URL with video/mp4 content type', async () => {
    // Mock fetch response
    const mockResponse = {
      ok: true,
      headers: new Headers({
        'content-type': 'application/octet-stream'
      }),
      blob: vi.fn().mockResolvedValue(mockBlob)
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await convertToBlobUrl(mockUrl);

    expect(fetch).toHaveBeenCalledWith(mockUrl);
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(result).toBe(mockBlobUrl);
  });

  it('should convert a URL to a blob URL with original content type', async () => {
    const originalContentType = 'video/webm';
    const mockResponse = {
      ok: true,
      headers: new Headers({
        'content-type': originalContentType
      }),
      blob: vi.fn().mockResolvedValue(mockBlob)
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await convertToBlobUrl(mockUrl);

    expect(fetch).toHaveBeenCalledWith(mockUrl);
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(result).toBe(mockBlobUrl);
  });

  it('should handle missing content type', async () => {
    const mockResponse = {
      ok: true,
      headers: new Headers({}),
      blob: vi.fn().mockResolvedValue(mockBlob)
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await convertToBlobUrl(mockUrl);

    expect(fetch).toHaveBeenCalledWith(mockUrl);
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(result).toBe(mockBlobUrl);
  });

  it('should throw an error when fetch fails', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      headers: new Headers({}),
      blob: vi.fn()
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    await expect(convertToBlobUrl(mockUrl)).rejects.toThrow('HTTP error! status: 404');
  });

  it('should throw an error when fetch request fails', async () => {
    const error = new Error('Network error');
    global.fetch = vi.fn().mockRejectedValue(error);

    await expect(convertToBlobUrl(mockUrl)).rejects.toThrow('Network error');
  });
});
