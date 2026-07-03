import express from 'express';
import { authenticateJWT } from '../middleware/auth-middleware';
import { asyncHandler } from '../utils/async-handler';
import { validateRequest } from '../middleware/validate-request';
import eventsController from '../controllers/events.controller';
import { eventIdParamSchema } from '../validations/events.validations';

import { connectMongo } from '../models/connect';

const router = express.Router();

router.use(
  asyncHandler(async (req, res, next) => {
    await connectMongo(true);
    next();
  })
);

router.get(
  '/:eventId',
  authenticateJWT,
  validateRequest({ params: eventIdParamSchema }),
  asyncHandler(eventsController.getMessages)
);

export default router;
