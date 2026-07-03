import { describe, it, expect, Mock, beforeEach, vi } from 'vitest';
import { CaptionService } from '../caption.service';
import captionRepository from '../../repositories/caption.repository';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../../errors';
import { CaptionSettings, CaptionType } from '../../types';

// Mock the repository
vi.mock('../../repositories/caption.repository');

describe('Caption Service', () => {
  let captionService: CaptionService;
  const userId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
    captionService = new CaptionService();
  });

  describe('createCaption', () => {
    it('should create a caption successfully', async () => {
      const captionData: CaptionSettings = {
        type: 'WORD_HIGHLIGHT' as CaptionType,
        fontFamily: 'Montserrat-Bold',
        isUppercase: true,
        primaryColor: '#ffffff',
        outlineColor: '#000000',
        highlightedWordColor: '#ff0000',
        marginV: 10,
        outlineWidth: 1,
        userId
      };

      const expectedCaption = {
        ...captionData,
        _id: 'new-caption-id'
      };

      (captionRepository.create as Mock).mockResolvedValue(expectedCaption);

      const result = await captionService.createCaption(captionData);

      expect(captionRepository.create).toHaveBeenCalledWith(captionData);
      expect(result).toEqual(expectedCaption);
    });
  });

  describe('getCaptionById', () => {
    it('should throw BadRequestError if id is not provided', async () => {
      await expect(captionService.getCaptionById('')).rejects.toThrow(BadRequestError);
      expect(captionRepository.findById).not.toHaveBeenCalled();
    });

    it('should return a caption if found', async () => {
      const captionId = 'caption-123';
      const expectedCaption: CaptionSettings = {
        _id: captionId,
        type: 'WORD_HIGHLIGHT' as CaptionType,
        fontFamily: 'Montserrat-Bold',
        isUppercase: true,
        primaryColor: '#ffffff',
        outlineColor: '#000000',
        highlightedWordColor: '#ff0000',
        marginV: 10,
        outlineWidth: 1,
        userId
      };

      (captionRepository.findById as Mock).mockResolvedValue(expectedCaption);

      const result = await captionService.getCaptionById(captionId);

      expect(captionRepository.findById).toHaveBeenCalledWith(captionId);
      expect(result).toEqual(expectedCaption);
    });

    it('should throw NotFoundError if caption is not found', async () => {
      const captionId = 'non-existent-id';

      (captionRepository.findById as Mock).mockResolvedValue(null);

      await expect(captionService.getCaptionById(captionId)).rejects.toThrow(NotFoundError);
      expect(captionRepository.findById).toHaveBeenCalledWith(captionId);
    });
  });

  describe('updateCaption', () => {
    it('should throw BadRequestError if id is not provided', async () => {
      const captionData: Partial<CaptionSettings> = {
        primaryColor: '#000000',
        userId,
        type: 'WORD_HIGHLIGHT' as CaptionType,
        fontFamily: 'Montserrat-Bold',
        isUppercase: true,
        outlineColor: '#ffffff',
        highlightedWordColor: '#ff0000',
        marginV: 10,
        outlineWidth: 1
      };

      await expect(captionService.updateCaption('', captionData as CaptionSettings)).rejects.toThrow(BadRequestError);
      expect(captionRepository.update).not.toHaveBeenCalled();
    });

    it('should update a caption if found', async () => {
      const captionId = 'caption-123';
      const captionData: CaptionSettings = {
        type: 'WORD_HIGHLIGHT' as CaptionType,
        fontFamily: 'Montserrat-Bold',
        isUppercase: true,
        primaryColor: '#000000', // Updated color
        outlineColor: '#ffffff',
        highlightedWordColor: '#ff0000',
        marginV: 10,
        outlineWidth: 1,
        userId
      };

      const updatedCaption = {
        ...captionData,
        _id: captionId
      };

      (captionRepository.update as Mock).mockResolvedValue(updatedCaption);

      const result = await captionService.updateCaption(captionId, captionData);

      expect(captionRepository.update).toHaveBeenCalledWith(captionId, captionData);
      expect(result).toEqual(updatedCaption);
    });

    it('should throw NotFoundError if caption is not found during update', async () => {
      const captionId = 'non-existent-id';
      const captionData: CaptionSettings = {
        type: 'WORD_HIGHLIGHT' as CaptionType,
        fontFamily: 'Montserrat-Bold',
        isUppercase: true,
        primaryColor: '#000000',
        outlineColor: '#ffffff',
        highlightedWordColor: '#ff0000',
        marginV: 10,
        outlineWidth: 1,
        userId
      };

      (captionRepository.update as Mock).mockResolvedValue(null);

      await expect(captionService.updateCaption(captionId, captionData)).rejects.toThrow(NotFoundError);
      expect(captionRepository.update).toHaveBeenCalledWith(captionId, captionData);
    });
  });

  describe('getCaptionsForUser', () => {
    it('should return captions for a user', async () => {
      const expectedCaptions: CaptionSettings[] = [
        {
          _id: 'caption-1',
          type: 'WORD_HIGHLIGHT' as CaptionType,
          fontFamily: 'Montserrat-Bold',
          isUppercase: true,
          primaryColor: '#ffffff',
          outlineColor: '#000000',
          highlightedWordColor: '#ff0000',
          marginV: 10,
          outlineWidth: 1,
          userId
        },
        {
          _id: 'caption-2',
          type: 'WORD_APPEAR' as CaptionType,
          fontFamily: 'Montserrat-Bold',
          isUppercase: true,
          primaryColor: '#ffffff',
          outlineColor: '#000000',
          highlightedWordColor: '#ff0000',
          marginV: 10,
          outlineWidth: 1,
          userId
        }
      ];

      (captionRepository.findByUserId as Mock).mockResolvedValue(expectedCaptions);

      const result = await captionService.getCaptionsForUser(userId);

      expect(captionRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedCaptions);
    });
  });

  describe('deleteCaption', () => {
    it('should throw BadRequestError if id is not provided', async () => {
      await expect(captionService.deleteCaption('', userId)).rejects.toThrow(BadRequestError);
      expect(captionRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError if caption is not found', async () => {
      const captionId = 'non-existent-id';

      (captionRepository.findById as Mock).mockResolvedValue(null);

      await expect(captionService.deleteCaption(captionId, userId)).rejects.toThrow(NotFoundError);
      expect(captionRepository.findById).toHaveBeenCalledWith(captionId);
      expect(captionRepository.deleteById).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedError if user does not own the caption', async () => {
      const captionId = 'caption-123';
      const caption: CaptionSettings = {
        _id: captionId,
        type: 'WORD_HIGHLIGHT' as CaptionType,
        fontFamily: 'Montserrat-Bold',
        isUppercase: true,
        primaryColor: '#ffffff',
        outlineColor: '#000000',
        highlightedWordColor: '#ff0000',
        marginV: 10,
        outlineWidth: 1,
        userId: 'different-user-id'
      };

      (captionRepository.findById as Mock).mockResolvedValue(caption);

      await expect(captionService.deleteCaption(captionId, userId)).rejects.toThrow(UnauthorizedError);
      expect(captionRepository.findById).toHaveBeenCalledWith(captionId);
      expect(captionRepository.deleteById).not.toHaveBeenCalled();
    });

    it('should delete caption if found and user owns it', async () => {
      const captionId = 'caption-123';
      const caption: CaptionSettings = {
        _id: captionId,
        type: 'WORD_HIGHLIGHT' as CaptionType,
        fontFamily: 'Montserrat-Bold',
        isUppercase: true,
        primaryColor: '#ffffff',
        outlineColor: '#000000',
        highlightedWordColor: '#ff0000',
        marginV: 10,
        outlineWidth: 1,
        userId
      };

      (captionRepository.findById as Mock).mockResolvedValue(caption);
      (captionRepository.deleteById as Mock).mockResolvedValue(true);

      await captionService.deleteCaption(captionId, userId);

      expect(captionRepository.findById).toHaveBeenCalledWith(captionId);
      expect(captionRepository.deleteById).toHaveBeenCalledWith(captionId);
    });

    it('should throw Error if deletion fails', async () => {
      const captionId = 'caption-123';
      const caption: CaptionSettings = {
        _id: captionId,
        type: 'WORD_HIGHLIGHT' as CaptionType,
        fontFamily: 'Montserrat-Bold',
        isUppercase: true,
        primaryColor: '#ffffff',
        outlineColor: '#000000',
        highlightedWordColor: '#ff0000',
        marginV: 10,
        outlineWidth: 1,
        userId
      };

      (captionRepository.findById as Mock).mockResolvedValue(caption);
      (captionRepository.deleteById as Mock).mockResolvedValue(false);

      await expect(captionService.deleteCaption(captionId, userId)).rejects.toThrow('Failed to delete caption.');
      expect(captionRepository.findById).toHaveBeenCalledWith(captionId);
      expect(captionRepository.deleteById).toHaveBeenCalledWith(captionId);
    });
  });
});
