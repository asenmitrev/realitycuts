import express from 'express';
import { authenticateJWT } from '../middleware/auth-middleware';
import { restrictRoleAccess } from '../middleware/role-access-middleware';
import { asyncHandler } from '../utils/async-handler';
import { validateRequest } from '../middleware/validate-request';
import controller from '../controllers/brand-assets.controller';
import {
  brandAssetIdParamSchema,
  createBrandAssetBodySchema
} from '../validations/brand-assets.validations';
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
  restrictRoleAccess(['admin', 'editor', 'user']),
  validateRequest({ body: createBrandAssetBodySchema }),
  asyncHandler(controller.create)
);
router.get(
  '/',
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  asyncHandler(controller.list)
);
router.delete(
  '/:id',
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  validateRequest({ params: brandAssetIdParamSchema }),
  asyncHandler(controller.remove)
);

export default router;
