import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { trimAndRemoveWords } from '../video-manipulation/trimming';
import ffmpeg from 'fluent-ffmpeg';
import { HighlightSegment } from '../../types';

// Mock fluent-ffmpeg
vi.mock('fluent-ffmpeg', () => {
  const mockOn = vi.fn().mockReturnThis();
  const mockRun = vi.fn();
  const mockComplexFilter = vi.fn().mockReturnThis();
  const mockOutputOptions = vi.fn().mockReturnThis();
  const mockOutput = vi.fn().mockReturnThis();

  return {
    default: vi.fn(() => ({
      complexFilter: mockComplexFilter,
      outputOptions: mockOutputOptions,
      output: mockOutput,
      on: mockOn,
      run: mockRun
    }))
  };
});

describe('trimAndRemoveWords', () => {
  const mockSegments: HighlightSegment[] = [
    { start: 0, end: 5 },
    { start: 10, end: 15 }
  ];
  const mockInputPath = 'input.mp4';
  let mockFFmpeg: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFFmpeg = ffmpeg as unknown as Mock;
  });

  it('should process video segments successfully', async () => {
    // Setup success callback
    const ffmpegInstance = mockFFmpeg(mockInputPath);
    ffmpegInstance.on.mockImplementation((event, callback) => {
      if (event === 'end') {
        callback();
      }
      return ffmpegInstance;
    });

    const result = await trimAndRemoveWords(mockSegments, mockInputPath);

    // Verify the result is an array with filename and path
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatch(/^\d+\.mp4$/);
    // expect(result[1]).toMatch(/^\.\/data\/\d+\.mp4$/);

    // Verify ffmpeg was called with correct filters
    expect(mockFFmpeg).toHaveBeenCalledWith(mockInputPath);
    expect(ffmpegInstance.complexFilter).toHaveBeenCalled();
    expect(ffmpegInstance.run).toHaveBeenCalled();
  });

  it('should handle progress updates', async () => {
    const mockProgress = vi.fn();
    const ffmpegInstance = mockFFmpeg(mockInputPath);

    ffmpegInstance.on.mockImplementation((event, callback) => {
      if (event === 'progress') {
        callback({ percent: 50 });
      } else if (event === 'end') {
        callback();
      }
      return ffmpegInstance;
    });

    await trimAndRemoveWords(mockSegments, mockInputPath, mockProgress);

    expect(mockProgress).toHaveBeenCalledWith(50);
  });

  it('should handle ffmpeg errors', async () => {
    const ffmpegInstance = mockFFmpeg(mockInputPath);
    const errorMessage = 'FFmpeg processing error';

    ffmpegInstance.on.mockImplementation((event, callback) => {
      if (event === 'error') {
        callback({ message: errorMessage });
      }
      return ffmpegInstance;
    });

    await expect(trimAndRemoveWords(mockSegments, mockInputPath)).rejects.toBe('An error occurred: ' + errorMessage);
  });

  it('should handle empty segments array', async () => {
    const ffmpegInstance = mockFFmpeg(mockInputPath);
    ffmpegInstance.on.mockImplementation((event, callback) => {
      if (event === 'end') {
        callback();
      }
      return ffmpegInstance;
    });

    const result = await trimAndRemoveWords([], mockInputPath);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);

    // Verify that complexFilter was called with an appropriate filter array
    const complexFilterCall = ffmpegInstance.complexFilter.mock.calls[0][0];
    expect(complexFilterCall).toEqual([
      {
        filter: 'concat',
        options: { v: 1, a: 1, n: 0 },
        inputs: [],
        outputs: ['outv', 'outa']
      }
    ]);
  });

  it('should create correct complex filter chain for multiple segments', async () => {
    const ffmpegInstance = mockFFmpeg(mockInputPath);
    ffmpegInstance.on.mockImplementation((event, callback) => {
      if (event === 'end') {
        callback();
      }
      return ffmpegInstance;
    });

    await trimAndRemoveWords(mockSegments, mockInputPath);

    const complexFilterCall = ffmpegInstance.complexFilter.mock.calls[0][0];

    // Expected filter chain for two segments
    const expectedFilters = [
      // First segment filters
      {
        filter: 'trim',
        options: { start: 0, end: 5 },
        inputs: '0:v',
        outputs: '[v0-trim]'
      },
      {
        filter: 'setpts',
        options: 'PTS-STARTPTS',
        inputs: '[v0-trim]',
        outputs: '[v0]'
      },
      {
        filter: 'atrim',
        options: { start: 0, end: 5 },
        inputs: '0:a',
        outputs: '[a0-trim]'
      },
      {
        filter: 'afade',
        options: {
          type: 'in',
          start_time: 0,
          duration: 0.05
        },
        inputs: '[a0-trim]',
        outputs: '[a0-fade-in]'
      },
      {
        filter: 'afade',
        options: {
          type: 'out',
          start_time: 4.95,
          duration: 0.05
        },
        inputs: '[a0-fade-in]',
        outputs: '[a0-fade]'
      },
      {
        filter: 'asetpts',
        options: 'PTS-STARTPTS',
        inputs: '[a0-fade]',
        outputs: '[a0]'
      },
      // Second segment filters
      {
        filter: 'trim',
        options: { start: 10, end: 15 },
        inputs: '0:v',
        outputs: '[v1-trim]'
      },
      {
        filter: 'setpts',
        options: 'PTS-STARTPTS',
        inputs: '[v1-trim]',
        outputs: '[v1]'
      },
      {
        filter: 'atrim',
        options: { start: 10, end: 15 },
        inputs: '0:a',
        outputs: '[a1-trim]'
      },
      {
        filter: 'afade',
        options: {
          type: 'in',
          start_time: 10,
          duration: 0.05
        },
        inputs: '[a1-trim]',
        outputs: '[a1-fade-in]'
      },
      {
        filter: 'afade',
        options: {
          type: 'out',
          start_time: 14.95,
          duration: 0.05
        },
        inputs: '[a1-fade-in]',
        outputs: '[a1-fade]'
      },
      {
        filter: 'asetpts',
        options: 'PTS-STARTPTS',
        inputs: '[a1-fade]',
        outputs: '[a1]'
      },
      // Concat filter
      {
        filter: 'concat',
        options: {
          v: 1,
          a: 1,
          n: 2
        },
        inputs: ['[v0][a0]', '[v1][a1]'],
        outputs: ['outv', 'outa']
      }
    ];

    expect(complexFilterCall).toEqual(expectedFilters);
  });
});
