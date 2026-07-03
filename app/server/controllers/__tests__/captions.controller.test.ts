import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Response } from 'express';
import { AuthenticatedRequest } from '../../types';
import captionsController from '../captions.controller';
import captionService from '../../services/caption.service';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../../errors';

// Mock dependencies
vi.mock('../../services/caption.service');

describe('Captions Controller', () => {
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

  describe('createCaption', () => {
    it('should create a new caption successfully', async () => {
      const captionData = {
        type: 'WORD_HIGHLIGHT',
        fontFamily: 'Montserrat-Bold',
        isUppercase: true,
        primaryColor: '#ffffff',
        outlineColor: '#000000',
        highlightedWordColor: '#ff0000',
        marginV: 10,
        outlineWidth: 1
      };
      mockRequest.body = captionData;

      const mockSavedCaption = {
        ...captionData,
        userId,
        _id: 'new-caption-id'
      };

      (captionService.createCaption as Mock).mockResolvedValue(mockSavedCaption);

      await captionsController.createCaption(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(captionService.createCaption).toHaveBeenCalledWith({
        ...captionData,
        userId
      });
      expect(mockResponse.json).toHaveBeenCalledWith(mockSavedCaption);
    });

    it('should handle errors during caption creation', async () => {
      const error = new Error('Service error');
      (captionService.createCaption as Mock).mockRejectedValue(error);

      await expect(
        captionsController.createCaption(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow();
    });
  });

  describe('getCaptionById', () => {
    const captionId = 'caption-123';

    beforeEach(() => {
      mockRequest.params = { id: captionId };
    });

    it('should update and return caption if found', async () => {
      const updatedCaption = {
        _id: captionId,
        type: 'WORD_HIGHLIGHT',
        fontFamily: 'Montserrat-Bold',
        isUppercase: true,
        primaryColor: '#ffffff',
        outlineColor: '#000000',
        highlightedWordColor: '#ff0000',
        marginV: 10,
        outlineWidth: 1,
        userId
      };

      (captionService.updateCaption as Mock).mockResolvedValue(updatedCaption);

      await captionsController.getCaptionById(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(captionService.updateCaption).toHaveBeenCalledWith(captionId, { userId });
      expect(mockResponse.json).toHaveBeenCalledWith(updatedCaption);
    });

    it('should propagate service errors', async () => {
      const error = new NotFoundError('Caption not found.');
      (captionService.updateCaption as Mock).mockRejectedValue(error);

      await expect(
        captionsController.getCaptionById(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getCaptions', () => {
    it('should return captions for user', async () => {
      const mockCaptions = [
        { _id: '1', type: 'WORD_HIGHLIGHT', userId },
        { _id: '2', type: 'WORD_APPEAR', userId }
      ];

      (captionService.getCaptionsForUser as Mock).mockResolvedValue(mockCaptions);

      await captionsController.getCaptions(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(captionService.getCaptionsForUser).toHaveBeenCalledWith(userId);
      expect(mockResponse.json).toHaveBeenCalledWith(mockCaptions);
    });

    it('should handle errors during captions retrieval', async () => {
      const error = new Error('Service error');
      (captionService.getCaptionsForUser as Mock).mockRejectedValue(error);

      await expect(
        captionsController.getCaptions(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow();
    });
  });

  describe('deleteCaptionById', () => {
    const captionId = 'caption-123';

    beforeEach(() => {
      mockRequest.params = { id: captionId };
    });

    it('should delete caption if found and user owns it', async () => {
      (captionService.deleteCaption as Mock).mockResolvedValue(undefined);

      await captionsController.deleteCaptionById(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(captionService.deleteCaption).toHaveBeenCalledWith(captionId, userId);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Caption deleted successfully.'
      });
    });

    it('should propagate NotFoundError from service', async () => {
      const error = new NotFoundError('Caption not found.');
      (captionService.deleteCaption as Mock).mockRejectedValue(error);

      await expect(
        captionsController.deleteCaptionById(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow(NotFoundError);
    });

    it('should propagate UnauthorizedError from service', async () => {
      const error = new UnauthorizedError('Unauthorized to delete this caption.');
      (captionService.deleteCaption as Mock).mockRejectedValue(error);

      await expect(
        captionsController.deleteCaptionById(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow(UnauthorizedError);
    });
  });
});
