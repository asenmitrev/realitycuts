import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Response } from 'express';
import { AuthenticatedRequest } from '../../types';
import searchController from '../search.controller';
import libraryRepository from '../../repositories/library.repository';
import { contextAnalysisAgent } from '../../agents/context-analysis.agent';
import { searchPexelsVideos } from '../../services/pexels';
import { searchVideoEmbeddingsV2 } from '../../services/vector-search.service';
import { BadRequestError } from '../../errors';

// Mock dependencies
vi.mock('../../repositories/library.repository', () => ({
  default: {
    findBrollByMetadataFilters: vi.fn(),
    findPublicLibrariesByIds: vi.fn(),
    countBrollByLibraryId: vi.fn(),
    getBrollScreenshotsByLibraryId: vi.fn()
  }
}));

vi.mock('../../agents/context-analysis.agent', () => ({
  contextAnalysisAgent: {
    invoke: vi.fn()
  }
}));

vi.mock('../../services/pexels', () => ({
  searchPexelsVideos: vi.fn()
}));

vi.mock('../../services/vector-search.service', () => ({
  searchVideoEmbeddingsV2: vi.fn(),
  searchMongoVideoEmbeddingsByLibrary: vi.fn()
}));

vi.mock('../../services/logging', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

describe('SearchController', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = {
      user: { user_id: 'test-user-id' },
      body: {}
    };

    mockResponse = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis()
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('searchFootage', () => {
    it('should search pexels footage', async () => {
      mockRequest.body = {
        query: 'test query',
        source: 'pexels'
      };
      const mockResults = [{ id: '1', title: 'Test Video' }];
      (searchPexelsVideos as any).mockResolvedValue(mockResults);

      await searchController.searchFootage(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(searchPexelsVideos).toHaveBeenCalledWith('test query', 20);
      expect(mockResponse.json).toHaveBeenCalledWith(mockResults);
    });

    it('should allow libraries search even if tags/privateLibraryIds are missing', async () => {
      mockRequest.body = {
        query: 'test query',
        source: 'libraries'
      };

      const mockResults = [{ id: '1', title: 'Test Video' }];
      (searchVideoEmbeddingsV2 as any).mockResolvedValue(mockResults);

      await searchController.searchFootage(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(searchVideoEmbeddingsV2).toHaveBeenCalledWith('test query', 20, undefined, undefined, undefined);
      expect(mockResponse.json).toHaveBeenCalledWith(mockResults);
    });

    it('should search libraries with metadata filters when query is empty', async () => {
      mockRequest.body = {
        query: '',
        source: 'libraries',
        privateLibraryIds: ['lib-1'],
        metadataFilters: { framing: 'close-up' }
      };
      const mockResults = [{ id: '1', title: 'Test Video' }];
      (libraryRepository.findBrollByMetadataFilters as any).mockResolvedValue(mockResults);

      await searchController.searchFootage(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(libraryRepository.findBrollByMetadataFilters).toHaveBeenCalledWith(['lib-1'], {
        framing: 'close-up'
      });
      expect(mockResponse.json).toHaveBeenCalledWith(mockResults);
    });

    it('should search libraries with vector search when query is provided', async () => {
      mockRequest.body = {
        query: 'test query',
        source: 'libraries',
        privateLibraryIds: ['lib-1'],
        metadataFilters: { framing: 'close-up' }
      };
      const mockResults = [{ id: '1', title: 'Test Video' }];
      (searchVideoEmbeddingsV2 as any).mockResolvedValue(mockResults);

      await searchController.searchFootage(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(searchVideoEmbeddingsV2).toHaveBeenCalledWith('test query', 20, ['lib-1'], undefined, {
        framing: 'close-up'
      });
      expect(mockResponse.json).toHaveBeenCalledWith(mockResults);
    });

    it('should throw BadRequestError for invalid source', async () => {
      mockRequest.body = {
        query: 'test query',
        source: 'invalid-source'
      };

      await expect(
        searchController.searchFootage(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('autosuggestPublicLibraries', () => {
    it('should suggest public libraries based on script context', async () => {
      mockRequest.body = {
        script: 'test script content'
      };
      const mockContext = { keywords: ['test', 'keywords'] };
      const mockLibraryIds = ['lib-1', 'lib-2'];
      const mockLibraries = [
        { _id: 'lib-1', userId: 'other-user', title: 'Library 1' },
        { _id: 'lib-2', userId: 'test-user-id', title: 'Library 2' }
      ];

      (contextAnalysisAgent.invoke as any).mockResolvedValue(mockContext);
      const { searchMongoVideoEmbeddingsByLibrary } = await import('../../services/vector-search.service');
      (searchMongoVideoEmbeddingsByLibrary as any).mockResolvedValue(mockLibraryIds);
      (libraryRepository.findPublicLibrariesByIds as any).mockResolvedValue(mockLibraries);
      (libraryRepository.countBrollByLibraryId as any)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5);
      (libraryRepository.getBrollScreenshotsByLibraryId as any)
        .mockResolvedValueOnce(['screenshot1.jpg', 'screenshot2.jpg'])
        .mockResolvedValueOnce(['screenshot3.jpg']);

      await searchController.autosuggestPublicLibraries(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(contextAnalysisAgent.invoke).toHaveBeenCalledWith({ script: 'test script content' });
      expect(mockResponse.json).toHaveBeenCalledWith([
        {
          libraryId: 'lib-1',
          videoCount: 10,
          tag: 'Library 1',
          screenshots: ['screenshot1.jpg', 'screenshot2.jpg']
        }
      ]);
    });

    it('should filter out libraries owned by current user', async () => {
      mockRequest.body = {
        script: 'test script content'
      };
      const mockContext = { keywords: ['test'] };
      const mockLibraryIds = ['lib-1'];
      const mockLibraries = [{ _id: 'lib-1', userId: 'test-user-id', title: 'My Library' }];

      (contextAnalysisAgent.invoke as any).mockResolvedValue(mockContext);
      const { searchMongoVideoEmbeddingsByLibrary } = await import('../../services/vector-search.service');
      (searchMongoVideoEmbeddingsByLibrary as any).mockResolvedValue(mockLibraryIds);
      (libraryRepository.findPublicLibrariesByIds as any).mockResolvedValue(mockLibraries);

      await searchController.autosuggestPublicLibraries(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith([]);
    });
  });
});

