import express from 'express';
import uploadController from '../controllers/upload.controller';
import { authenticateJWT } from '../middleware/auth-middleware';
import { restrictRoleAccess } from '../middleware/role-access-middleware';
import { asyncHandler } from '../utils/async-handler';
import { validateRequest } from '../middleware/validate-request';
import {
  uploadIdParamSchema,
  generatePresignedUploadUrlBodySchema,
  confirmUploadBodySchema
} from '../validations/upload.validations';

import { connectMongo } from '../models/connect';

const router = express.Router();

router.use(
  asyncHandler(async (req, res, next) => {
    await connectMongo(true);
    next();
  })
);

// Generate presigned URL for direct S3 upload
router.post(
  '/presigned',
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  validateRequest({ body: generatePresignedUploadUrlBodySchema }),
  asyncHandler(uploadController.generatePresignedUploadUrl)
);

// Confirm successful upload
router.post(
  '/:uploadId/confirm',
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  validateRequest({ params: uploadIdParamSchema, body: confirmUploadBodySchema }),
  asyncHandler(uploadController.confirmUpload)
);

// Get upload details
router.get(
  '/:uploadId',
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  validateRequest({ params: uploadIdParamSchema }),
  asyncHandler(uploadController.getUpload)
);

// Delete an upload
router.delete(
  '/:uploadId',
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  validateRequest({ params: uploadIdParamSchema }),
  asyncHandler(uploadController.deleteUpload)
);

// Admin endpoints
router.post(
  '/admin/cleanup-db',
  authenticateJWT,
  restrictRoleAccess(['admin']),
  asyncHandler(uploadController.cleanupExpiredDatabaseRecords)
);

router.get(
  '/admin/stats',
  authenticateJWT,
  restrictRoleAccess(['admin']),
  asyncHandler(uploadController.getUploadStats)
);

export default router;
