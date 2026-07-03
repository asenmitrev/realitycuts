import express from 'express';

import { authenticateJWT } from '../middleware/auth-middleware';
import { asyncHandler } from '../utils/async-handler';
import { validateRequest } from '../middleware/validate-request';
import captionsController from '../controllers/captions.controller';
import {
  captionIdParamSchema,
  createCaptionBodySchema,
  updateCaptionBodySchema
} from '../validations/captions.validations';

import { connectMongo } from '../models/connect';

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
  validateRequest({ body: createCaptionBodySchema }),
  asyncHandler(captionsController.createCaption)
);

router.put(
  '/:id',
  authenticateJWT,
  validateRequest({ params: captionIdParamSchema, body: updateCaptionBodySchema }),
  asyncHandler(captionsController.getCaptionById)
);

router.get('/', authenticateJWT, asyncHandler(captionsController.getCaptions));

router.delete(
  '/:id',
  authenticateJWT,
  validateRequest({ params: captionIdParamSchema }),
  asyncHandler(captionsController.deleteCaptionById)
);
export default router;
