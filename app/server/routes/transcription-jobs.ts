import express from 'express';
import { authenticateJWT } from '../middleware/auth-middleware';
import { asyncHandler } from '../utils/async-handler';
import { validateRequest } from '../middleware/validate-request';
import transcriptionJobsController from '../controllers/transcription-jobs.controller';
import {
  transcriptionJobIdParamSchema,
  updateTranscriptionJobBodySchema
} from '../validations/transcription-jobs.validations';

import { connectMongo } from '../models/connect';

const router = express.Router();

router.use(
  asyncHandler(async (req, res, next) => {
    await connectMongo(true);
    next();
  })
);

router.get('/', authenticateJWT, asyncHandler(transcriptionJobsController.get));

router.put(
  '/:id',
  authenticateJWT,
  validateRequest({ params: transcriptionJobIdParamSchema, body: updateTranscriptionJobBodySchema }),
  asyncHandler(transcriptionJobsController.update)
);

router.delete(
  '/:id',
  authenticateJWT,
  validateRequest({ params: transcriptionJobIdParamSchema }),
  asyncHandler(transcriptionJobsController.delete)
);

export default router;
