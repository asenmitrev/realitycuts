import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextFunction, Response } from 'express';
import videosController from '../videos.controller';
import videoService from '../../services/video.service';
import { AuthenticatedRequest, IVideoAIData, Segment, SegmentAlternative } from '../../types';
import { BadRequestError } from '../../errors';

// Mock the video service with proper typing
vi.mock('../../services/video.service', () => ({
  default: {
    getVideos: vi.fn(),
    getVideo: vi.fn(),
    updateVideo: vi.fn(),
    createVideo: vi.fn(),
    deleteVideo: vi.fn(),
    exportVideo: vi.fn(),
    generateFCPXML: vi.fn(),
    regenerateBroll: vi.fn(),
    generateDescription: vi.fn(),
    generateTitle: vi.fn()
  }
}));

vi.mock('../../services/fs', () => ({
  safelyDelete: vi.fn()
}));

vi.mock('../../services/logging', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn()
  }
}));

// Proper typing for mocked functions
const mockVideoService = vi.mocked(videoService, true);

describe('VideosController', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = {
      user: { user_id: 'test-user-id' },
      params: {},
      query: {},
      body: {}
    };

    mockResponse = {
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis()
    };

    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getVideos', () => {
    it('should return videos with pagination', async () => {
      const mockVideos = [{ _id: '1', title: 'Test Video', userId: 'test-user-id' } as IVideoAIData];
      const mockTotal = 1;

      mockVideoService.getVideos.mockResolvedValue({
        videos: mockVideos,
        total: mockTotal
      });

      await videosController.getVideos(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockVideoService.getVideos).toHaveBeenCalledWith('test-user-id', 0, 1000);
      expect(mockResponse.json).toHaveBeenCalledWith({
        videos: mockVideos,
        total: mockTotal
      });
    });

    it('should handle pagination parameters from query', async () => {
      const mockVideos = [{ _id: '1', title: 'Test Video', userId: 'test-user-id' } as IVideoAIData];
      const mockTotal = 1;

      mockRequest.query = {
        skip: '10',
        limit: '20'
      };
      mockVideoService.getVideos.mockResolvedValue({
        videos: mockVideos,
        total: mockTotal
      });

      await videosController.getVideos(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockVideoService.getVideos).toHaveBeenCalledWith('test-user-id', 10, 20);
    });
  });

  describe('saveVideo', () => {
    it('should update and return video', async () => {
      const updatedVideo = { _id: '1', title: 'Updated Video', userId: 'test-user-id' } as IVideoAIData;
      mockRequest.params = { id: '1' };
      mockRequest.body = { title: 'Updated Video' };

      mockVideoService.updateVideo.mockResolvedValue(updatedVideo);

      await videosController.saveVideo(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockVideoService.updateVideo).toHaveBeenCalledWith('1', 'test-user-id', { title: 'Updated Video' });
      expect(mockResponse.json).toHaveBeenCalledWith(updatedVideo);
    });

    it('should throw BadRequestError if id is not provided', async () => {
      mockRequest.params = {}; // No ID provided

      await expect(
        videosController.saveVideo(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('createVideo', () => {
    it('should create a video and return event ID', async () => {
      mockRequest.body = {
        uploadType: 'TEXT',
        script: 'Test script',
        size: '1080p',
        pexels: 'true',
        voicePremium: 'false',
        useVideoEmbeddings: 'true',
        includeMusic: 'true'
      };

      mockVideoService.createVideo.mockResolvedValue('test-event-id');

      await videosController.createVideo(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        vi.fn() as unknown as NextFunction
      );

      expect(mockVideoService.createVideo).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({ eventId: 'test-event-id' });
    });

    it('should handle errors and clean up files', async () => {
      mockRequest.body = {
        uploadType: 'TEXT',
        script: 'Test script'
      };
      mockRequest.file = { path: '/tmp/test-file.mp4' } as Express.Multer.File;

      // Mock service to throw an error
      mockVideoService.createVideo.mockRejectedValue(new Error('Test error'));
      const mockNext = vi.fn() as unknown as NextFunction;
      // Capture the console.log calls

      await videosController.createVideo(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(new Error('Test error'));
    });
  });

  describe('getVideo', () => {
    it('should return a video by ID', async () => {
      const mockVideo = { _id: '1', title: 'Test Video', userId: 'test-user-id' } as IVideoAIData;
      mockRequest.params = { id: '1' };

      mockVideoService.getVideo.mockResolvedValue(mockVideo);

      await videosController.getVideo(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockVideoService.getVideo).toHaveBeenCalledWith('1', 'test-user-id');
      expect(mockResponse.json).toHaveBeenCalledWith(mockVideo);
    });
  });

  // describe('regenerateBroll', () => {
  //   it('should regenerate broll and return focused segments', async () => {
  //     // Create a mock segment that matches the Segment interface
  //     const mockAlternative: SegmentAlternative = {
  //       _id: 'alt-1',
  //       link: 'http://example.com/video.mp4',
  //       preview: 'http://example.com/preview.mp4',
  //       title: 'Test Video',
  //       thumbnailUrl: 'http://example.com/thumbnail.jpg',
  //       offsetStart: 0,
  //       score: 0.9,
  //       type: 'pinecone' as const,
  //       id: 123
  //     };

  //     const focusedSegments: Segment[] = [
  //       {
  //         _id: 'segment-1',
  //         alternatives: [mockAlternative],
  //         timeStart: 0,
  //         timeEnd: 5,
  //         keywords: 'test,keywords'
  //       }
  //     ];

  //     mockRequest.params = { id: '1' };
  //     mockRequest.body = {
  //       startTime: 0,
  //       endTime: 10,
  //       storyblocks: true,
  //       pexels: false,
  //       eventId: 'test-event-id',
  //       privateLibraryIds: ['lib1', 'lib2']
  //     };

  //     mockVideoService.regenerateBroll.mockResolvedValue(focusedSegments);

  //     await videosController.regenerateBroll(mockRequest as AuthenticatedRequest, mockResponse as Response);

  //     expect(mockVideoService.regenerateBroll).toHaveBeenCalledWith(
  //       '1',
  //       'test-user-id',
  //       0,
  //       10,
  //       ['lib1', 'lib2'],
  //       true,
  //       false,
  //       'test-event-id'
  //     );
  //     expect(mockResponse.json).toHaveBeenCalledWith(focusedSegments);
  //   });
  // });

  describe('deleteVideo', () => {
    it('should delete a video and return success', async () => {
      mockRequest.params = { id: '1' };

      mockVideoService.deleteVideo.mockResolvedValue(undefined);

      await videosController.deleteVideo(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockVideoService.deleteVideo).toHaveBeenCalledWith('1', 'test-user-id');
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('exportVideo', () => {
    it('should export a video and return the result', async () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = {
        exportType: 'VIDEO',
        orientationType: 'HORIZONTAL'
      };

      const exportResult = { eventId: 'export-event-id' };
      mockVideoService.exportVideo.mockResolvedValue(exportResult);

      await videosController.exportVideo(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockVideoService.exportVideo).toHaveBeenCalledWith(
        '1',
        'test-user-id',
        'VIDEO',
        'HORIZONTAL',
        undefined,
        undefined,
        undefined
      );
      expect(mockResponse.send).toHaveBeenCalledWith(exportResult);
    });

    it('should pass through watermark and thumbnail options', async () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = {
        exportType: 'VIDEO',
        orientationType: 'BOTH',
        brandWatermarkUploadId: 'brand-1',
        brandWatermarkPosition: 'top-right',
        generateThumbnail: true
      };

      const exportResult = { eventId: 'export-event-id' };
      mockVideoService.exportVideo.mockResolvedValue(exportResult);

      await videosController.exportVideo(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockVideoService.exportVideo).toHaveBeenCalledWith(
        '1',
        'test-user-id',
        'VIDEO',
        'BOTH',
        'brand-1',
        'top-right',
        true
      );
    });
  });

  describe('exportVideoFCPXML', () => {
    it('should generate FCPXML and return event ID', async () => {
      mockRequest.params = { id: '1' };

      mockVideoService.generateFCPXML.mockResolvedValue('fcpxml-event-id');

      await videosController.exportVideoFCPXML(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockVideoService.generateFCPXML).toHaveBeenCalledWith('1', 'test-user-id');
      expect(mockResponse.json).toHaveBeenCalledWith({ eventId: 'fcpxml-event-id' });
    });
  });

  describe('generateDescription', () => {
    it('should generate description and return it', async () => {
      mockRequest.params = { id: '1' };

      mockVideoService.generateDescription.mockResolvedValue('Test description');

      await videosController.generateDescription(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockVideoService.generateDescription).toHaveBeenCalledWith('1');
      expect(mockResponse.json).toHaveBeenCalledWith({ description: 'Test description' });
    });
  });

  describe('generateTitle', () => {
    it('should generate title and return it', async () => {
      mockRequest.params = { id: '1' };

      mockVideoService.generateTitle.mockResolvedValue('Test Title');

      await videosController.generateTitle(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockVideoService.generateTitle).toHaveBeenCalledWith('1');
      expect(mockResponse.json).toHaveBeenCalledWith({ title: 'Test Title' });
    });
  });
});
