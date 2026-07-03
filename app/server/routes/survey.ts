import express from 'express';
import { configureDotenv } from '../config/dotenv';
import { asyncHandler } from '../utils/async-handler';
import { validateRequest } from '../middleware/validate-request';
import surveyController from '../controllers/survey.controller';
import { authenticateJWT } from '../middleware/auth-middleware';
import {
  createSurveyBodySchema,
  updateSurveyBodySchema
} from '../validations/survey.validations';

import { connectMongo } from '../models/connect';
configureDotenv();

const router = express.Router();

router.use(
  asyncHandler(async (req, res, next) => {
    await connectMongo(true);
    next();
  })
);

router.post(
  '/',
  authenticateJWT,
  validateRequest({ body: createSurveyBodySchema }),
  asyncHandler(surveyController.createSurvey)
);

router.get('/', authenticateJWT, asyncHandler(surveyController.getSurvey));

router.put(
  '/',
  authenticateJWT,
  validateRequest({ body: updateSurveyBodySchema }),
  asyncHandler(surveyController.updateSurvey)
);

router.get('/status', authenticateJWT, asyncHandler(surveyController.checkSurveyStatus));

router.get('/admin/all', authenticateJWT, asyncHandler(surveyController.getAllSurveysForAdmin));

export default router;
