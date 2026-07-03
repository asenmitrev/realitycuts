import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { SurveyService } from '../survey.service';
import surveyRepository from '../../repositories/survey.repository';
import { BadRequestError, UnauthorizedError } from '../../errors';
import { ISurvey } from '../../types';
import { ENVIRONMENT } from '../../config/const';

// Mock dependencies
vi.mock('../../repositories/survey.repository', () => ({
  default: {
    findByUserId: vi.fn(),
    create: vi.fn(),
    updateByUserId: vi.fn(),
    existsByUserId: vi.fn(),
    getAllSurveysWithPagination: vi.fn()
  }
}));

vi.mock('../../config/const', () => ({
  ENVIRONMENT: 'test'
}));

describe('SurveyService', () => {
  let service: SurveyService;
  const mockUserId = 'user-123';
  const mockSurvey: ISurvey = {
    _id: 'survey-123',
    userId: mockUserId,
    userType: 'solo_creator',
    usageTypes: ['tiktok_instagram'],
    createdAt: new Date(),
    updatedAt: new Date()
  } as ISurvey;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SurveyService();
  });

  describe('createSurvey', () => {
    const validSurveyData: Omit<ISurvey, 'createdAt' | 'updatedAt'> = {
      userId: mockUserId,
      userType: 'solo_creator',
      usageTypes: ['tiktok_instagram']
    };

    it('should create survey successfully', async () => {
      (surveyRepository.findByUserId as Mock).mockResolvedValue(null);
      (surveyRepository.create as Mock).mockResolvedValue(mockSurvey);

      const result = await service.createSurvey(validSurveyData);

      expect(surveyRepository.findByUserId).toHaveBeenCalledWith(mockUserId);
      expect(surveyRepository.create).toHaveBeenCalledWith(validSurveyData);
      expect(result).toEqual(mockSurvey);
    });

    it('should throw BadRequestError when survey already exists', async () => {
      (surveyRepository.findByUserId as Mock).mockResolvedValue(mockSurvey);

      await expect(service.createSurvey(validSurveyData)).rejects.toThrow(BadRequestError);
      expect(surveyRepository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestError when userType is missing', async () => {
      const invalidData = {
        ...validSurveyData,
        userType: undefined as any
      };

      await expect(service.createSurvey(invalidData)).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError when usageTypes is empty', async () => {
      const invalidData = {
        ...validSurveyData,
        usageTypes: []
      };

      await expect(service.createSurvey(invalidData)).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError when userType is other but userTypeOther is missing', async () => {
      const invalidData = {
        ...validSurveyData,
        userType: 'other' as any,
        userTypeOther: undefined
      };

      await expect(service.createSurvey(invalidData)).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError when userType is other but userTypeOther is empty', async () => {
      const invalidData = {
        ...validSurveyData,
        userType: 'other' as any,
        userTypeOther: '   '
      };

      await expect(service.createSurvey(invalidData)).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError when usageTypes includes other but usageTypesOther is missing', async () => {
      const invalidData: Omit<ISurvey, 'createdAt' | 'updatedAt'> = {
        ...validSurveyData,
        usageTypes: ['other'],
        usageTypesOther: undefined
      };

      await expect(service.createSurvey(invalidData)).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError when usageTypes includes other but usageTypesOther is empty', async () => {
      const invalidData: Omit<ISurvey, 'createdAt' | 'updatedAt'> = {
        ...validSurveyData,
        usageTypes: ['other'],
        usageTypesOther: '   '
      };

      await expect(service.createSurvey(invalidData)).rejects.toThrow(BadRequestError);
    });

    it('should create survey with other userType when userTypeOther is provided', async () => {
      const dataWithOther = {
        ...validSurveyData,
        userType: 'other' as any,
        userTypeOther: 'Custom Type'
      };
      (surveyRepository.findByUserId as Mock).mockResolvedValue(null);
      (surveyRepository.create as Mock).mockResolvedValue(mockSurvey);

      await service.createSurvey(dataWithOther);

      expect(surveyRepository.create).toHaveBeenCalledWith(dataWithOther);
    });
  });

  describe('getSurveyByUserId', () => {
    it('should return survey for user', async () => {
      (surveyRepository.findByUserId as Mock).mockResolvedValue(mockSurvey);

      const result = await service.getSurveyByUserId(mockUserId);

      expect(surveyRepository.findByUserId).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockSurvey);
    });

    it('should return null when survey not found', async () => {
      (surveyRepository.findByUserId as Mock).mockResolvedValue(null);

      const result = await service.getSurveyByUserId(mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('updateSurvey', () => {
    it('should update survey successfully', async () => {
      const updateData: Partial<ISurvey> = { usageTypes: ['tiktok_instagram', 'youtube_videos'] };
      const updatedSurvey = { ...mockSurvey, ...updateData };
      (surveyRepository.findByUserId as Mock).mockResolvedValue(mockSurvey);
      (surveyRepository.updateByUserId as Mock).mockResolvedValue(updatedSurvey);

      const result = await service.updateSurvey(mockUserId, updateData);

      expect(surveyRepository.findByUserId).toHaveBeenCalledWith(mockUserId);
      expect(surveyRepository.updateByUserId).toHaveBeenCalledWith(mockUserId, updateData);
      expect(result).toEqual(updatedSurvey);
    });

    it('should throw BadRequestError when survey not found', async () => {
      const updateData: Partial<ISurvey> = { usageTypes: ['tiktok_instagram'] };
      (surveyRepository.findByUserId as Mock).mockResolvedValue(null);

      await expect(service.updateSurvey(mockUserId, updateData)).rejects.toThrow(BadRequestError);
      expect(surveyRepository.updateByUserId).not.toHaveBeenCalled();
    });
  });

  describe('hasUserCompletedSurvey', () => {
    it('should return true when survey exists', async () => {
      (surveyRepository.existsByUserId as Mock).mockResolvedValue(true);

      const result = await service.hasUserCompletedSurvey(mockUserId);

      expect(surveyRepository.existsByUserId).toHaveBeenCalledWith(mockUserId);
      expect(result).toBe(true);
    });

    it('should return false when survey does not exist', async () => {
      (surveyRepository.existsByUserId as Mock).mockResolvedValue(false);

      const result = await service.hasUserCompletedSurvey(mockUserId);

      expect(result).toBe(false);
    });
  });
});
