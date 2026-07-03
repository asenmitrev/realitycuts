import { Response } from 'express';
import surveyService from '../services/survey.service';
import { AuthenticatedRequest } from '../types';
import { logger } from '../services/logging';

export default {
  createSurvey: async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    const { userType, userTypeOther, usageTypes, usageTypesOther } = req.body;

    logger.info('Creating survey response', {
      'User ID': userId,
      userType,
      usageTypesCount: usageTypes?.length
    });

    try {
      const survey = await surveyService.createSurvey({
        userId,
        userType,
        userTypeOther,
        usageTypes,
        usageTypesOther
      });

      res.status(201).json(survey);
    } catch (error) {
      logger.error('Error creating survey', { error, userId });
      throw error;
    }
  },

  getSurvey: async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;

    const survey = await surveyService.getSurveyByUserId(userId);
    res.json(survey);
  },

  updateSurvey: async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    const { userType, userTypeOther, usageTypes, usageTypesOther } = req.body;

    logger.info('Updating survey response', {
      'User ID': userId
    });

    try {
      const survey = await surveyService.updateSurvey(userId, {
        userType,
        userTypeOther,
        usageTypes,
        usageTypesOther
      });

      res.json(survey);
    } catch (error) {
      logger.error('Error updating survey', { error, userId });
      throw error;
    }
  },

  checkSurveyStatus: async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;

    const hasCompleted = await surveyService.hasUserCompletedSurvey(userId);
    res.json({ hasCompleted });
  },

  getAllSurveysForAdmin: async (req: AuthenticatedRequest, res: Response) => {
    const skip = typeof req.query.skip === 'string' ? parseInt(req.query.skip) : 0;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 50;

    const result = await surveyService.getAllSurveysForAdmin(skip, limit);

    res.json({
      surveys: result.surveys,
      total: result.total
    });
  }
};
