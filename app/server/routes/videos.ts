import express from 'express';
import { authenticateJWT } from '../middleware/auth-middleware';
import { restrictRoleAccess } from '../middleware/role-access-middleware';
import { upload } from '../middleware/multer';
import { asyncHandler } from '../utils/async-handler';
import { validateRequest } from '../middleware/validate-request';
import videosController from '../controllers/videos.controller';
import {
  getVideosQuerySchema,
  getAllVideosForAdminQuerySchema,
  getVideoStatsByUserQuerySchema,
  videoIdParamSchema,
  saveVideoBodySchema,
  regenerateBrollBodySchema,
  exportVideoBodySchema,
  generateDescriptionBodySchema,
  generateTitleBodySchema,
  cloneSampleVideoBodySchema
} from '../validations/videos.validations';

import { connectMongo } from '../models/connect';

const router = express.Router();

router.use(
  asyncHandler(async (req, res, next) => {
    await connectMongo(true);
    next();
  })
);

router.get(
  '/',
  authenticateJWT,
  validateRequest({ query: getVideosQuerySchema }),
  asyncHandler(videosController.getVideos)
);
router.get(
  '/admin/all',
  authenticateJWT,
  validateRequest({ query: getAllVideosForAdminQuerySchema }),
  asyncHandler(videosController.getAllVideosForAdmin)
);
router.get(
  '/stats/by-user',
  validateRequest({ query: getVideoStatsByUserQuerySchema }),
  asyncHandler(videosController.getVideoStatsByUser)
);

router.post(
  '/one-shot',
  authenticateJWT,
  restrictRoleAccess(['editor', 'admin', 'user']),
  asyncHandler(videosController.createOneShotVideo)
);

router.post(
  '/',
  authenticateJWT,
  restrictRoleAccess(['editor', 'admin', 'user']),
  upload.single('video'),
  // validateRequest({ body: createVideoBodySchema }), // TODO FIx the schema
  asyncHandler(videosController.createVideo)
);

router.get(
  '/:id',
  authenticateJWT,
  validateRequest({ params: videoIdParamSchema }),
  asyncHandler(videosController.getVideo)
);
router.put(
  '/:id',
  authenticateJWT,
  validateRequest({ params: videoIdParamSchema, body: saveVideoBodySchema }),
  asyncHandler(videosController.saveVideo)
);

router.post(
  '/:id/regenerate-broll',
  authenticateJWT,
  validateRequest({ params: videoIdParamSchema, body: regenerateBrollBodySchema }),
  asyncHandler(videosController.regenerateBroll)
);

router.delete(
  '/:id',
  authenticateJWT,
  validateRequest({ params: videoIdParamSchema }),
  asyncHandler(videosController.deleteVideo)
);

router.post(
  '/:id/export',
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  validateRequest({ params: videoIdParamSchema, body: exportVideoBodySchema }),
  asyncHandler(videosController.exportVideo)
);

router.post(
  '/:id/export/fcpxml',
  authenticateJWT,
  validateRequest({ params: videoIdParamSchema }),
  asyncHandler(videosController.exportVideoFCPXML)
);

router.post(
  '/:id/generate-description',
  authenticateJWT,
  validateRequest({ params: videoIdParamSchema, body: generateDescriptionBodySchema }),
  asyncHandler(videosController.generateDescription)
);

router.post(
  '/:id/generate-title',
  authenticateJWT,
  validateRequest({ params: videoIdParamSchema, body: generateTitleBodySchema }),
  asyncHandler(videosController.generateTitle)
);

router.post(
  '/:id/clone-sample',
  authenticateJWT,
  validateRequest({ params: videoIdParamSchema, body: cloneSampleVideoBodySchema }),
  asyncHandler(videosController.cloneSampleVideo)
);

export default router;
