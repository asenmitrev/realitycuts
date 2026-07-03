import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Response } from 'express';
import { AuthenticatedRequest } from '../../types';
import surveyController from '../survey.controller';
import surveyService from '../../services/survey.service';

// Mock dependencies
vi.mock('../../services/survey.service', () => ({
  default: {
    createSurvey: vi.fn(),
    getSurveyByUserId: vi.fn(),
    updateSurvey: vi.fn(),
    hasUserCompletedSurvey: vi.fn(),
    getAllSurveysForAdmin: vi.fn()
  }
}));

vi.mock('../../services/logging', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

describe('SurveyController', () => {
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
      status: vi.fn().mockReturnThis()
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createSurvey', () => {
    it('should create survey successfully', async () => {
      mockRequest.body = {
        userType: 'creator',
        userTypeOther: null,
        usageTypes: ['video-editing', 'social-media'],
        usageTypesOther: null
      };
      const mockSurvey = {
        _id: 'survey-1',
        userId: 'test-user-id',
        userType: 'creator',
        usageTypes: ['video-editing', 'social-media']
      };

      (surveyService.createSurvey as any).mockResolvedValue(mockSurvey);

      await surveyController.createSurvey(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(surveyService.createSurvey).toHaveBeenCalledWith({
        userId: 'test-user-id',
        userType: 'creator',
        userTypeOther: null,
        usageTypes: ['video-editing', 'social-media'],
        usageTypesOther: null
      });
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockSurvey);
    });
  });

  describe('getSurvey', () => {
    it('should return survey for user', async () => {
      const mockSurvey = {
        _id: 'survey-1',
        userId: 'test-user-id',
        userType: 'creator'
      };

      (surveyService.getSurveyByUserId as any).mockResolvedValue(mockSurvey);

      await surveyController.getSurvey(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(surveyService.getSurveyByUserId).toHaveBeenCalledWith('test-user-id');
      expect(mockResponse.json).toHaveBeenCalledWith(mockSurvey);
    });
  });

  describe('updateSurvey', () => {
    it('should update survey successfully', async () => {
      mockRequest.body = {
        userType: 'business',
        userTypeOther: null,
        usageTypes: ['marketing'],
        usageTypesOther: null
      };
      const mockSurvey = {
        _id: 'survey-1',
        userId: 'test-user-id',
        userType: 'business',
        usageTypes: ['marketing']
      };

      (surveyService.updateSurvey as any).mockResolvedValue(mockSurvey);

      await surveyController.updateSurvey(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(surveyService.updateSurvey).toHaveBeenCalledWith('test-user-id', {
        userType: 'business',
        userTypeOther: null,
        usageTypes: ['marketing'],
        usageTypesOther: null
      });
      expect(mockResponse.json).toHaveBeenCalledWith(mockSurvey);
    });
  });

  describe('checkSurveyStatus', () => {
    it('should return survey completion status', async () => {
      (surveyService.hasUserCompletedSurvey as any).mockResolvedValue(true);

      await surveyController.checkSurveyStatus(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(surveyService.hasUserCompletedSurvey).toHaveBeenCalledWith('test-user-id');
      expect(mockResponse.json).toHaveBeenCalledWith({ hasCompleted: true });
    });
  });

  describe('getAllSurveysForAdmin', () => {
    it('should return all surveys with pagination', async () => {
      mockRequest.query = { skip: '0', limit: '50' };
      const mockResult = {
        surveys: [
          { _id: 'survey-1', userId: 'user-1' },
          { _id: 'survey-2', userId: 'user-2' }
        ],
        total: 2
      };

      (surveyService.getAllSurveysForAdmin as any).mockResolvedValue(mockResult);

      await surveyController.getAllSurveysForAdmin(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(surveyService.getAllSurveysForAdmin).toHaveBeenCalledWith(0, 50);
      expect(mockResponse.json).toHaveBeenCalledWith({
        surveys: mockResult.surveys,
        total: mockResult.total
      });
    });

    it('should handle excludeUserIds parameter', async () => {
      mockRequest.query = { skip: '0', limit: '50', excludeUserIds: ['user-1', 'user-2'] };
      const mockResult = {
        surveys: [],
        total: 0
      };

      (surveyService.getAllSurveysForAdmin as any).mockResolvedValue(mockResult);

      await surveyController.getAllSurveysForAdmin(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(surveyService.getAllSurveysForAdmin).toHaveBeenCalledWith(0, 50);
    });
  });
});
