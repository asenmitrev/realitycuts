import express from 'express';
import { authenticateJWT } from '../middleware/auth-middleware';
import { asyncHandler } from '../utils/async-handler';
import { validateRequest } from '../middleware/validate-request';
import youtubeUploadController from '../controllers/youtube-upload.controller';
import { channelIdParamSchema, uploadToYoutubeBodySchema } from '../validations/youtube-upload.validations';
import { connectMongo } from '../models/connect';

const router = express.Router();

router.use(
  asyncHandler(async (req, res, next) => {
    await connectMongo(true);
    next();
  })
);

// Google redirects the browser here directly, so these two routes can't require a bearer token.
router.get('/auth', youtubeUploadController.auth);
router.get('/callback', asyncHandler(youtubeUploadController.callback));

router.get('/channels', authenticateJWT, asyncHandler(youtubeUploadController.getChannels));

router.delete(
  '/channels/:channelId',
  authenticateJWT,
  validateRequest({ params: channelIdParamSchema }),
  asyncHandler(youtubeUploadController.removeChannel)
);

router.post(
  '/upload',
  authenticateJWT,
  validateRequest({ body: uploadToYoutubeBodySchema }),
  asyncHandler(youtubeUploadController.upload)
);

export default router;
