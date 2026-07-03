import express from 'express';
import { connectMongo } from '../models/connect';
import { configureDotenv } from '../config/dotenv';
import { asyncHandler } from '../utils/async-handler';
import { validateRequest } from '../middleware/validate-request';
import profileController from '../controllers/profile.controller';
import { authenticateJWT } from '../middleware/auth-middleware';
import {
  afterLoginBodySchema,
  afterRegBodySchema,
  waitlistBodySchema,
  firebaseIdParamSchema,
  userIdParamSchema
} from '../validations/profile.validations';
configureDotenv();

const router = express.Router();

router.use(
  asyncHandler(async (req, res, next) => {
    await connectMongo(true);
    next();
  })
);

router.post(
  '/afterlogin',
  validateRequest({ body: afterLoginBodySchema }),
  asyncHandler(profileController.afterLogin)
);

router.post(
  '/afterreg',
  validateRequest({ body: afterRegBodySchema }),
  asyncHandler(profileController.afterReg)
);

router.get('/cr', asyncHandler(profileController.cr));

router.post(
  '/anonymous-setup',
  authenticateJWT,
  asyncHandler(profileController.anonymousSetup)
);

router.post(
  '/waitlist',
  validateRequest({ body: waitlistBodySchema }),
  asyncHandler(profileController.waitlist)
);

router.get(
  '/profile/:firebaseId',
  authenticateJWT,
  validateRequest({ params: firebaseIdParamSchema }),
  asyncHandler(profileController.profile)
);

router.get('/user-stats', authenticateJWT, asyncHandler(profileController.userStats));

router.post('/unsubscribe', asyncHandler(profileController.unsubscribe));

router.get('/premium/voices', asyncHandler(profileController.premiumVoices));

router.get(
  '/user/:userId/email',
  validateRequest({ params: userIdParamSchema }),
  asyncHandler(profileController.getUserEmail)
);

export default router;
