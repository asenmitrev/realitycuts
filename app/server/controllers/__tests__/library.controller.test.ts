// Mock shared types module
vi.mock('shared/types', () => ({
  LibraryTaskSettings: class {},
  VideoCategorizationMetadata: class {}
}));

// Mock environment variables
process.env.PLUS_PLAN_ID = 'mock-plus-plan';
process.env.BASIC_PLAN_ID = 'mock-basic-plan';
process.env.FREE_PLAN_ID = 'mock-free-plan';
process.env.ENVIRONMENT = 'test';
process.env.LOGGLY_TOKEN = 'mock-loggly-token';
process.env.CLOUDWATCH_LOGS = 'false';
process.env.AWS_REGION = 'us-east-1';

// Mock const.ts to avoid requiring environment variables
vi.mock('../../config/const', () => ({
  IS_PROD: false,
  PLUS_PLAN_ID: 'mock-plus-plan',
  BASIC_PLAN_ID: 'mock-basic-plan',
  OPENAI_KEY: 'mock-openai-key',
  FREE_PLAN_ID: 'mock-free-plan',
  OPENAI_BASE_URL: 'mock-openai-base-url',
  ENVIRONMENT: 'test',
  LIBRARY_PROCESSING_CHUNK_SIZE: 300,
  FARGATE_QUEUE_URL: 'mock-fargate-queue-url',
  LIBRARY_VIDEO_CHUNK_THRESHOLD: 600,
  YOUTUBE_API_KEY: 'mock-youtube-api-key',
  LOGGLY_TOKEN: 'mock-loggly-token',
  CLOUDWATCH_LOGS: false
}));

// Mock config/aws.ts
vi.mock('../../config/aws', () => ({
  getS3FileUrl: vi.fn().mockImplementation(key => `https://s3.test.com/${key}`),
  S3_BUCKET: 'test-bucket',
  REGION: 'us-east-1'
}));

vi.mock('../../services/youtube', () => ({
  extractVideoId: vi.fn(),
  fetchYTVideoDetails: vi.fn()
}));

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send() {
      return Promise.resolve({});
    }
  },
  PutObjectCommand: class {},
  DeleteObjectCommand: class {},
  GetObjectCommand: class {}
}));

// Now import the rest of the dependencies
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Response } from 'express';
import { AuthenticatedRequest } from '../../types';
import libraryController from '../library.controller';
import { Library } from '../../models/library';
import { BrollFootageMetadata } from '../../models/broll-video-metadata';
import { UserProfile } from '../../models/user-profile';
import { LibraryUpload } from '../../models/library-upload';
import { deleteFromS3, deleteFromS3Promise, uploadToS3 } from '../../services/storage/s3';
import { getMetadata } from '../../services/video-manipulation/ffmpeg';
import { logger } from '../../services/logging';
import { enqueueLibraryItemDeletionTask } from '../../services/task-queue';
import { extractVideoId, fetchYTVideoDetails } from '../../services/youtube';
import { LibraryTaskSettingsModel } from '../../models/library-task-settings';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../errors';
import { sendMessage } from '../../services/sockets';
import { generateMetadataForVideo } from '../../agents/metadata-generation.qwen.agent';
import libraryService from '../../services/library.service';
import brollService from '../../services/broll.service';

// Mock the service layer dependencies directly
vi.mock('../../services/library.service', () => ({
  default: {
    getPublicLibraryTags: vi.fn(),
    createLibrary: vi.fn(),
    deleteLibrary: vi.fn(),
    getOrCreateNewLibrary: vi.fn(),
    updateLibrary: vi.fn(),
    getAllUserLibraries: vi.fn(),
    getLibraryById: vi.fn(),
    getBrollMetadata: vi.fn(),
    createBrollVideoEmbeddings: vi.fn(),
    deleteBroll: vi.fn(),
    searchFootage: vi.fn(),
    autosuggestPublicLibraries: vi.fn(),
    processLibrary: vi.fn(),
    reprocessLibrary: vi.fn(),
    deleteUpload: vi.fn(),
    createUpload: vi.fn()
  }
}));

vi.mock('../../services/broll.service', () => ({
  default: {
    getBroll: vi.fn(),
    updateBrollIsPublic: vi.fn()
  }
}));

// Mock error classes
vi.mock('../../errors', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(message) {
      super(message);
      this.name = 'NotFoundError';
    }
  },
  BadRequestError: class BadRequestError extends Error {
    constructor(message) {
      super(message);
      this.name = 'BadRequestError';
    }
  },
  ForbiddenError: class ForbiddenError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ForbiddenError';
    }
  }
}));

// Mock all dependencies
vi.mock('../../models/library');
vi.mock('../../models/broll-video-metadata');
vi.mock('../../models/user-profile');
vi.mock('../../models/library-upload');
vi.mock('../../models/library-task-settings');
vi.mock('../../services/storage/s3', () => ({
  deleteFromS3: vi.fn(),
  deleteFromS3Promise: vi.fn().mockResolvedValue({}),
  uploadToS3: vi.fn().mockResolvedValue({})
}));
vi.mock('../../services/video-manipulation/ffmpeg');
vi.mock('../../services/logging', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}));
vi.mock('../../services/task-queue');
vi.mock('../../services/youtube');
vi.mock('../../services/sockets');
vi.mock('../../agents/metadata-generation.qwen.agent');

describe('Library Controller', () => {
  let mockRequest: Partial<Omit<AuthenticatedRequest, 'user'>> & { user: Partial<AuthenticatedRequest['user']> };
  let mockResponse: Partial<Response>;
  const userId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      user: { user_id: userId },
      params: {},
      query: {},
      body: {}
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
  });

  describe('getTags', () => {
    it('should return tags and total count from public libraries', async () => {
      const mockTags = {
        tags: [
          { libraryId: 'lib1', tag: 'Travel', videoCount: 5, screenshots: ['url1', 'url2'] },
          { libraryId: 'lib2', tag: 'Sports', videoCount: 10, screenshots: ['url3', 'url4'] }
        ],
        total: 2
      };

      (libraryService.getPublicLibraryTags as Mock).mockResolvedValue(mockTags);

      await libraryController.getTags(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(libraryService.getPublicLibraryTags).toHaveBeenCalledWith(userId, 0, 100, undefined);
      expect(mockResponse.json).toHaveBeenCalledWith(mockTags);
    });
  });

  describe('create', () => {
    it('should create a new library item', async () => {
      const libraryData = {
        title: 'Test Library',
        isPublic: false
      };
      mockRequest.body = libraryData;

      const mockSavedLibrary = {
        ...libraryData,
        _id: 'lib123',
        userId
      };

      (libraryService.createLibrary as Mock).mockResolvedValue(mockSavedLibrary);

      await libraryController.create(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(libraryService.createLibrary).toHaveBeenCalledWith(libraryData, userId);
      expect(mockResponse.json).toHaveBeenCalledWith(mockSavedLibrary);
    });
  });

  describe('getAll', () => {
    it('should return all library items for user with video counts', async () => {
      const mockLibraries = [
        { _id: 'lib1', title: 'Library 1', videoCount: 5 },
        { _id: 'lib2', title: 'Library 2', videoCount: 10 }
      ];

      (libraryService.getAllUserLibraries as Mock).mockResolvedValue(mockLibraries);

      await libraryController.getAll(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(libraryService.getAllUserLibraries).toHaveBeenCalledWith(userId);
      expect(mockResponse.json).toHaveBeenCalledWith(mockLibraries);
    });

    it('should handle errors appropriately', async () => {
      const error = new Error('Database error');
      (libraryService.getAllUserLibraries as Mock).mockRejectedValue(error);

      await expect(
        libraryController.getAll(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow(error);
    });
  });

  describe('deleteById', () => {
    const libraryId = '67af29362cc75e3b7aea263a';

    beforeEach(() => {
      mockRequest.params = { id: libraryId };
    });

    it('should successfully delete a library and its associated resources', async () => {
      (libraryService.deleteLibrary as Mock).mockResolvedValue(undefined);

      await libraryController.deleteById(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(libraryService.deleteLibrary).toHaveBeenCalledWith(libraryId, userId);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Library deleted successfully' });
    });

    it('should handle errors during deletion', async () => {
      (libraryService.deleteLibrary as Mock).mockRejectedValue('Deletion error');

      await expect(
        libraryController.deleteById(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow('Deletion error');
    });
  });

  describe('getById', () => {
    const libraryId = '67af29362cc75e3b7aea263a';

    beforeEach(() => {
      mockRequest.params = { id: libraryId };
    });

    it('should get a library by ID', async () => {
      const mockLibrary = {
        _id: libraryId,
        userId,
        title: 'Test Library',
        processedFiles: [{ link: { url: 'test.mp4' } }]
      };

      (libraryService.getLibraryById as Mock).mockResolvedValue(mockLibrary);

      await libraryController.getById(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(libraryService.getLibraryById).toHaveBeenCalledWith(libraryId, userId, expect.any(Boolean));
      expect(mockResponse.json).toHaveBeenCalledWith({
        library: mockLibrary,
        processedFiles: expect.any(Array)
      });
    });
  });

  describe('getBroll', () => {
    const libraryId = '67af29362cc75e3b7aea263a';

    beforeEach(() => {
      mockRequest.params = { id: libraryId };
      mockRequest.query = { skip: '0', limit: '10' };
    });

    it('should get broll footage for a library', async () => {
      const mockResult = {
        broll: [
          { _id: 'broll1', thumbnailUrl: 'thumb1.jpg' },
          { _id: 'broll2', thumbnailUrl: 'thumb2.jpg' }
        ],
        total: 2
      };

      (brollService.getBroll as Mock).mockResolvedValue(mockResult);

      await libraryController.getBroll(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(brollService.getBroll).toHaveBeenCalledWith(libraryId, 0, 10);
      expect(mockResponse.json).toHaveBeenCalledWith(mockResult);
    });

    it('should handle pagination parameters', async () => {
      mockRequest.query = { skip: '20', limit: '5' };

      (brollService.getBroll as Mock).mockResolvedValue({ broll: [], total: 0 });

      await libraryController.getBroll(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(brollService.getBroll).toHaveBeenCalledWith(libraryId, 20, 5);
    });
  });

  describe('update', () => {
    const libraryId = '67af29362cc75e3b7aea263a';

    beforeEach(() => {
      mockRequest.params = { id: libraryId };
      mockRequest.body = { title: 'Updated Title', isPublic: true };
    });

    it('should update a library item', async () => {
      const mockUpdatedLibrary = {
        _id: libraryId,
        userId,
        title: 'Updated Title',
        isPublic: true
      };

      (libraryService.updateLibrary as Mock).mockResolvedValue(mockUpdatedLibrary);

      await libraryController.update(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(libraryService.updateLibrary).toHaveBeenCalledWith(
        libraryId,
        { title: 'Updated Title', isPublic: true },
        userId
      );
      expect(mockResponse.json).toHaveBeenCalledWith(mockUpdatedLibrary);
    });
  });

  describe('getNew', () => {
    it('should return existing NEW library if found', async () => {
      const mockLibrary = {
        _id: 'lib123',
        userId,
        title: '',
        status: 'NEW',
        processedFiles: []
      };

      (libraryService.getOrCreateNewLibrary as Mock).mockResolvedValue(mockLibrary);

      await libraryController.getNew(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(libraryService.getOrCreateNewLibrary).toHaveBeenCalledWith(userId);
      expect(mockResponse.json).toHaveBeenCalledWith({
        library: mockLibrary,
        processedFiles: []
      });
    });
  });

  describe('deleteBroll', () => {
    const libraryId = '67af29362cc75e3b7aea263a';
    const uploadId = 'broll123';

    beforeEach(() => {
      mockRequest.params = { id: libraryId, uploadId };
    });

    it('should delete broll footage', async () => {
      (libraryService.deleteBroll as Mock).mockResolvedValue(undefined);

      await libraryController.deleteBroll(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(libraryService.deleteBroll).toHaveBeenCalledWith(libraryId, uploadId, userId);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Upload deleted successfully' });
    });
  });

  describe('getBrollMetadata', () => {
    const brollId = 'broll123';

    beforeEach(() => {
      mockRequest.params = { brollId };
    });

    it('should generate metadata for a broll', async () => {
      const mockMetadata = {
        framing: 'Close-up',
        cameraAngle: 'Low angle',
        perspective: 'First person'
      };

      (libraryService.getBrollMetadata as Mock).mockResolvedValue(mockMetadata);

      await libraryController.getBrollMetadata(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(libraryService.getBrollMetadata).toHaveBeenCalledWith(brollId);
      expect(mockResponse.json).toHaveBeenCalledWith(mockMetadata);
    });
  });

  describe('process', () => {
    const libraryId = '67af29362cc75e3b7aea263a';

    beforeEach(() => {
      mockRequest.params = { id: libraryId };
      mockRequest.body = {
        youtubeLinks: [{ isNew: true, description: 'Test video', link: 'https://youtube.com/watch?v=123' }],
        uploadedFiles: [
          {
            isNew: true,
            uploadId: 'upload123',
            description: 'Test upload',
            link: 'https://example.com/video.mp4',
            prompt: 'Test prompt'
          }
        ],
        isPublic: true,
        title: 'Test Library'
      };
    });

    it('should process a library with uploaded files', async () => {
      const mockProcessedLibrary = {
        _id: libraryId,
        title: 'Test Library',
        isPublic: true
      };

      (libraryService.processLibrary as Mock).mockResolvedValue(mockProcessedLibrary);

      await libraryController.process(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(libraryService.processLibrary).toHaveBeenCalledWith(
        libraryId,
        userId,
        mockRequest.body.uploadedFiles,
        mockRequest.body.isPublic,
        mockRequest.body.title
      );
      expect(mockResponse.json).toHaveBeenCalledWith(mockProcessedLibrary);
    });
  });

  describe('reprocess', () => {
    const libraryId = '67af29362cc75e3b7aea263a';

    beforeEach(() => {
      mockRequest.params = { id: libraryId };
      mockRequest.body = { prompt: 'New test prompt' };
    });

    it('should reprocess a library with a new prompt', async () => {
      (libraryService.reprocessLibrary as Mock).mockResolvedValue(undefined);

      await libraryController.reprocess(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(libraryService.reprocessLibrary).toHaveBeenCalledWith(libraryId, mockRequest.body.prompt, userId);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Library reprocessing scheduled.' });
    });
  });

  describe('deleteUpload', () => {
    const libraryId = '67af29362cc75e3b7aea263a';
    const uploadId = 'upload123';

    beforeEach(() => {
      mockRequest.params = { id: libraryId, uploadId };
    });

    it('should delete an upload from a library', async () => {
      (libraryService.deleteUpload as Mock).mockResolvedValue(undefined);

      await libraryController.deleteUpload(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(libraryService.deleteUpload).toHaveBeenCalledWith(libraryId, uploadId, userId);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Upload deleted successfully' });
    });
  });

  describe('createUpload', () => {
    const libraryId = '67af29362cc75e3b7aea263a';

    beforeEach(() => {
      mockRequest.params = { id: libraryId };
      mockRequest.file = {
        path: '/tmp/upload123',
        filename: 'video123.mp4',
        originalname: 'original.mp4',
        size: 1024,
        mimetype: 'video/mp4'
      } as any;
    });

    it('should create a new upload in a library', async () => {
      const mockUploadResult = {
        uploadId: 'upload123',
        duration: 120,
        name: 'original.mp4',
        url: 'https://s3.test.com/users/test-user-id/library/67af29362cc75e3b7aea263a/raw/video123.mp4'
      };

      (libraryService.createUpload as Mock).mockResolvedValue(mockUploadResult);

      await libraryController.createUpload(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(libraryService.createUpload).toHaveBeenCalledWith(libraryId, userId, {
        path: mockRequest.file!.path,
        filename: mockRequest.file!.filename,
        originalname: mockRequest.file!.originalname,
        size: mockRequest.file!.size,
        mimetype: mockRequest.file!.mimetype
      });
      expect(mockResponse.json).toHaveBeenCalledWith(mockUploadResult);
    });

    it('should throw BadRequestError if file is not provided', async () => {
      mockRequest.file = undefined;

      await expect(
        libraryController.createUpload(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow(BadRequestError);
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });

  describe('createBrollVideoEmbeddings', () => {
    const brollId = 'broll123';

    beforeEach(() => {
      mockRequest.params = { brollId };
    });

    it('should create video embeddings for a broll', async () => {
      (libraryService.createBrollVideoEmbeddings as Mock).mockResolvedValue(undefined);

      await libraryController.createBrollVideoEmbeddings(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(libraryService.createBrollVideoEmbeddings).toHaveBeenCalledWith(brollId, userId);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
    });
  });

});
