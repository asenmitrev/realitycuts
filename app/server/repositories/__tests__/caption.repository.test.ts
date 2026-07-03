import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { CaptionRepository } from '../caption.repository';
import { Caption } from '../../models/caption';
import { CaptionSettings, CaptionType } from '../../types';

// Mock the model
vi.mock('../../models/caption');

describe('Caption Repository', () => {
  let captionRepository: CaptionRepository;
  const userId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
    captionRepository = new CaptionRepository();
  });

  describe('create', () => {
    it('should create a new caption', async () => {
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

      const saveSpy = vi.fn().mockResolvedValue({
        ...captionData,
        _id: 'new-caption-id'
      });

      (Caption as unknown as Mock).mockImplementation(() => ({
        ...captionData,
        save: saveSpy
      }));

      const result = await captionRepository.create(captionData);

      expect(Caption).toHaveBeenCalledWith(captionData);
      expect(saveSpy).toHaveBeenCalled();
      expect(result).toEqual({
        ...captionData,
        _id: 'new-caption-id'
      });
    });
  });

  describe('findById', () => {
    it('should find a caption by ID', async () => {
      const captionId = 'caption-123';
      const mockCaption = {
        _id: captionId,
        type: 'WORD_HIGHLIGHT',
        userId
      };

      (Caption.findById as Mock).mockResolvedValue(mockCaption);

      const result = await captionRepository.findById(captionId);

      expect(Caption.findById).toHaveBeenCalledWith(captionId);
      expect(result).toEqual(mockCaption);
    });

    it('should return null if caption not found', async () => {
      const captionId = 'non-existent-id';

      (Caption.findById as Mock).mockResolvedValue(null);

      const result = await captionRepository.findById(captionId);

      expect(Caption.findById).toHaveBeenCalledWith(captionId);
      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find captions by user ID', async () => {
      const mockCaptions = [
        { _id: 'caption-1', type: 'WORD_HIGHLIGHT', userId },
        { _id: 'caption-2', type: 'WORD_APPEAR', userId }
      ];

      (Caption.find as Mock).mockResolvedValue(mockCaptions);

      const result = await captionRepository.findByUserId(userId);

      expect(Caption.find).toHaveBeenCalledWith({ userId });
      expect(result).toEqual(mockCaptions);
    });
  });

  describe('update', () => {
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

      const overwriteSpy = vi.fn();
      const saveSpy = vi.fn().mockResolvedValue({
        ...captionData,
        _id: captionId
      });

      const mockCaption = {
        _id: captionId,
        overwrite: overwriteSpy,
        save: saveSpy
      };

      (Caption.findById as Mock).mockResolvedValue(mockCaption);

      const result = await captionRepository.update(captionId, captionData);

      expect(Caption.findById).toHaveBeenCalledWith(captionId);
      expect(overwriteSpy).toHaveBeenCalledWith(captionData);
      expect(saveSpy).toHaveBeenCalled();
      expect(result).toEqual({
        ...captionData,
        _id: captionId
      });
    });

    it('should return null if caption not found', async () => {
      const captionId = 'non-existent-id';
      const captionData = {} as CaptionSettings;

      (Caption.findById as Mock).mockResolvedValue(null);

      const result = await captionRepository.update(captionId, captionData);

      expect(Caption.findById).toHaveBeenCalledWith(captionId);
      expect(result).toBeNull();
    });
  });

  describe('deleteById', () => {
    it('should delete a caption by ID and return true if successful', async () => {
      const captionId = 'caption-123';

      (Caption.findByIdAndDelete as Mock).mockResolvedValue({ _id: captionId });

      const result = await captionRepository.deleteById(captionId);

      expect(Caption.findByIdAndDelete).toHaveBeenCalledWith(captionId);
      expect(result).toBe(true);
    });

    it('should return false if caption not found', async () => {
      const captionId = 'non-existent-id';

      (Caption.findByIdAndDelete as Mock).mockResolvedValue(null);

      const result = await captionRepository.deleteById(captionId);

      expect(Caption.findByIdAndDelete).toHaveBeenCalledWith(captionId);
      expect(result).toBe(false);
    });
  });
});
