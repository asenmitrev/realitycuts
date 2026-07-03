import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Survey } from '../../models/survey';
import { SurveyRepository } from '../survey.repository';
import { ISurvey } from '../../types';

vi.mock('../../models/survey');

describe('SurveyRepository', () => {
  let repository: SurveyRepository;
  const mockUserId = 'user-123';

  const mockSurvey: Partial<ISurvey> = {
    _id: 'survey-123',
    userId: mockUserId,
    question1: 'Answer 1',
    question2: 'Answer 2',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new SurveyRepository();
  });

  describe('findByUserId', () => {
    it('should find survey by user ID', async () => {
      const mockSurveyDoc = {
        ...mockSurvey,
        toJSON: vi.fn().mockReturnValue(mockSurvey)
      };
      (Survey.findOne as Mock).mockResolvedValue(mockSurveyDoc);

      const result = await repository.findByUserId(mockUserId);

      expect(Survey.findOne).toHaveBeenCalledWith({ userId: mockUserId });
      expect(result).toEqual(mockSurvey);
    });

    it('should return null when survey not found', async () => {
      (Survey.findOne as Mock).mockResolvedValue(null);

      const result = await repository.findByUserId('non-existent-user');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new survey', async () => {
      const mockSave = vi.fn().mockResolvedValue({
        ...mockSurvey,
        toJSON: vi.fn().mockReturnValue(mockSurvey)
      });
      const mockConstructor = vi.fn().mockImplementation(() => ({
        save: mockSave
      }));
      (Survey as any).mockImplementation(mockConstructor);

      const surveyData = {
        userId: mockUserId,
        question1: 'Answer 1',
        question2: 'Answer 2'
      };

      const result = await repository.create(surveyData);

      expect(mockConstructor).toHaveBeenCalledWith(surveyData);
      expect(mockSave).toHaveBeenCalled();
      expect(result).toEqual(mockSurvey);
    });
  });

  describe('updateByUserId', () => {
    it('should update survey by user ID', async () => {
      const updateData = { question1: 'Updated Answer' };
      const updatedSurvey = { ...mockSurvey, ...updateData };
      const mockUpdatedSurveyDoc = {
        ...updatedSurvey,
        toJSON: vi.fn().mockReturnValue(updatedSurvey)
      };
      (Survey.findOneAndUpdate as Mock).mockResolvedValue(mockUpdatedSurveyDoc);

      const result = await repository.updateByUserId(mockUserId, updateData);

      expect(Survey.findOneAndUpdate).toHaveBeenCalledWith({ userId: mockUserId }, { $set: updateData }, { new: true });
      expect(result).toEqual(updatedSurvey);
    });

    it('should return null when survey not found', async () => {
      (Survey.findOneAndUpdate as Mock).mockResolvedValue(null);

      const result = await repository.updateByUserId('non-existent-user', { question1: 'Answer' });

      expect(result).toBeNull();
    });
  });

  describe('existsByUserId', () => {
    it('should return true when survey exists', async () => {
      (Survey.countDocuments as Mock).mockResolvedValue(1);

      const result = await repository.existsByUserId(mockUserId);

      expect(Survey.countDocuments).toHaveBeenCalledWith({ userId: mockUserId });
      expect(result).toBe(true);
    });

    it('should return false when survey does not exist', async () => {
      (Survey.countDocuments as Mock).mockResolvedValue(0);

      const result = await repository.existsByUserId('non-existent-user');

      expect(result).toBe(false);
    });
  });

  describe('getAllSurveysWithPagination', () => {
    it('should get all surveys with pagination', async () => {
      const mockSurveys = [mockSurvey];
      const mockLimit = vi.fn().mockResolvedValue(mockSurveys);
      const mockSkip = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = vi.fn().mockReturnValue({ skip: mockSkip });
      (Survey.find as Mock).mockReturnValue({
        sort: mockSort,
        skip: mockSkip,
        limit: mockLimit
      });
      (Survey.countDocuments as Mock).mockResolvedValue(100);

      const result = await repository.getAllSurveysWithPagination(0, 50, []);

      expect(Survey.find).toHaveBeenCalledWith({});
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockSkip).toHaveBeenCalledWith(0);
      expect(mockLimit).toHaveBeenCalledWith(50);
      expect(result).toEqual({
        surveys: mockSurveys.map(s => ({ ...s, toJSON: undefined })),
        total: 100
      });
    });

    it('should exclude user IDs when provided', async () => {
      const mockSurveys = [mockSurvey];
      const mockLimit = vi.fn().mockResolvedValue(mockSurveys);
      const mockSkip = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = vi.fn().mockReturnValue({ skip: mockSkip });
      (Survey.find as Mock).mockReturnValue({
        sort: mockSort,
        skip: mockSkip,
        limit: mockLimit
      });
      (Survey.countDocuments as Mock).mockResolvedValue(50);

      const result = await repository.getAllSurveysWithPagination(0, 50, ['excluded-user-1']);

      expect(Survey.find).toHaveBeenCalledWith({});
      expect(Survey.countDocuments).toHaveBeenCalledWith({});
      expect(result.total).toBe(50);
    });
  });
});
