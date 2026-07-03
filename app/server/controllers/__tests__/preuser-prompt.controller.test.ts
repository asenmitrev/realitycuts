import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { create, get, submitAndRedirect } from '../preuser-prompt.controller';
import * as preuserPromptService from '../../services/preuser-prompt.service';

// Mock dependencies
vi.mock('../../services/preuser-prompt.service', () => ({
  createPrompt: vi.fn(),
  getPrompt: vi.fn()
}));

vi.mock('../../config/const', () => ({
  CLIENT_URL: 'http://localhost:3000'
}));

describe('PreuserPromptController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = {
      body: {},
      params: {},
      query: {}
    };

    mockResponse = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      location: vi.fn().mockReturnThis()
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('create', () => {
    it('should return 400 if prompt is missing', async () => {
      mockRequest.body = {};

      await create(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Prompt is required' });
    });

    it('should create prompt and return token', async () => {
      mockRequest.body = { prompt: 'test prompt' };
      mockRequest.query = { libraryIds: 'lib-1,lib-2' };
      (preuserPromptService.createPrompt as any).mockResolvedValue({ token: 'test-token-123' });

      await create(mockRequest as Request, mockResponse as Response);

      expect(preuserPromptService.createPrompt).toHaveBeenCalledWith('test prompt', 'lib-1,lib-2');
      expect(mockResponse.json).toHaveBeenCalledWith({ token: 'test-token-123' });
    });

    it('should create prompt without libraryIds', async () => {
      mockRequest.body = { prompt: 'test prompt' };
      (preuserPromptService.createPrompt as any).mockResolvedValue({ token: 'test-token-123' });

      await create(mockRequest as Request, mockResponse as Response);

      expect(preuserPromptService.createPrompt).toHaveBeenCalledWith('test prompt', undefined);
      expect(mockResponse.json).toHaveBeenCalledWith({ token: 'test-token-123' });
    });
  });

  describe('get', () => {
    it('should return 404 if prompt not found', async () => {
      mockRequest.params = { token: 'invalid-token' };
      (preuserPromptService.getPrompt as any).mockResolvedValue(null);

      await get(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Not found' });
    });

    it('should return prompt and libraryIds', async () => {
      mockRequest.params = { token: 'test-token-123' };
      const mockRecord = {
        prompt: 'test prompt',
        libraryIds: ['lib-1', 'lib-2']
      };
      (preuserPromptService.getPrompt as any).mockResolvedValue(mockRecord);

      await get(mockRequest as Request, mockResponse as Response);

      expect(preuserPromptService.getPrompt).toHaveBeenCalledWith('test-token-123');
      expect(mockResponse.json).toHaveBeenCalledWith({
        prompt: 'test prompt',
        libraryIds: ['lib-1', 'lib-2']
      });
    });
  });

  describe('submitAndRedirect', () => {
    it('should return 400 if prompt is missing', async () => {
      mockRequest.body = {};

      await submitAndRedirect(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Prompt is required' });
    });

    it('should create prompt and redirect', async () => {
      mockRequest.body = { prompt: 'test prompt' };
      mockRequest.query = { libraryIds: 'lib-1,lib-2' };
      (preuserPromptService.createPrompt as any).mockResolvedValue({ token: 'test-token-123' });

      await submitAndRedirect(mockRequest as Request, mockResponse as Response);

      expect(preuserPromptService.createPrompt).toHaveBeenCalledWith('test prompt', 'lib-1,lib-2');
      expect(mockResponse.status).toHaveBeenCalledWith(303);
      expect(mockResponse.location).toHaveBeenCalledWith(
        'http://localhost:3000/preuser-prompt?prompt_token=test-token-123'
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        redirect: 'http://localhost:3000/preuser-prompt?prompt_token=test-token-123'
      });
    });
  });
});

