import surveyRepository from '../repositories/survey.repository';
import { ISurvey } from '../types';
import { BadRequestError } from '../errors';
import { UnauthorizedError } from '../errors';
import { ENVIRONMENT } from '../config/const';

export class SurveyService {
  async createSurvey(surveyData: Omit<ISurvey, 'createdAt' | 'updatedAt'>): Promise<ISurvey> {
    // Check if survey already exists for this user
    const existingSurvey = await surveyRepository.findByUserId(surveyData.userId);
    if (existingSurvey) {
      throw new BadRequestError('Survey already completed for this user');
    }

    // Validate required fields
    if (!surveyData.userType) {
      throw new BadRequestError('User type is required');
    }

    if (!surveyData.usageTypes || surveyData.usageTypes.length === 0) {
      throw new BadRequestError('At least one usage type must be selected');
    }

    // Validate 'other' fields
    if (surveyData.userType === 'other' && !surveyData.userTypeOther?.trim()) {
      throw new BadRequestError('Please specify your user type when selecting "Other"');
    }

    if (surveyData.usageTypes.includes('other') && !surveyData.usageTypesOther?.trim()) {
      throw new BadRequestError('Please specify your usage type when selecting "Other"');
    }

    return await surveyRepository.create(surveyData);
  }

  async getSurveyByUserId(userId: string): Promise<ISurvey | null> {
    return await surveyRepository.findByUserId(userId);
  }

  async updateSurvey(userId: string, updateData: Partial<ISurvey>): Promise<ISurvey | null> {
    const existingSurvey = await surveyRepository.findByUserId(userId);
    if (!existingSurvey) {
      throw new BadRequestError('Survey not found for this user');
    }

    return await surveyRepository.updateByUserId(userId, updateData);
  }

  async hasUserCompletedSurvey(userId: string): Promise<boolean> {
    return await surveyRepository.existsByUserId(userId);
  }

  /**
   * Get all surveys with pagination (for secret admin page)
   * ONLY ACCESSIBLE IN UAT ENVIRONMENT
   */
  async getAllSurveysForAdmin(
    skip: number = 0,
    limit: number = 50
  ): Promise<{ surveys: ISurvey[]; total: number }> {
    if (ENVIRONMENT !== 'uat') {
      throw new UnauthorizedError('404 not found');
    }
    return await surveyRepository.getAllSurveysWithPagination(skip, limit);
  }
}

export default new SurveyService();
