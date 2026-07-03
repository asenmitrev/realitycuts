import express from 'express';
import { authenticateJWT } from '../middleware/auth-middleware';
import { asyncHandler } from '../utils/async-handler';
import { validateRequest } from '../middleware/validate-request';
import exportsController from '../controllers/exports.controller';
import { exportIdParamSchema } from '../validations/exports.validations';

import { connectMongo } from '../models/connect';

const router = express.Router();

router.use(
  asyncHandler(async (req, res, next) => {
    await connectMongo(true);
    next();
  })
);

router.get('/stats/by-user', asyncHandler(exportsController.getExportStatsByUser));

// UAT only - delete exports older than 30 days
router.delete('/cleanup/old', asyncHandler(exportsController.deleteOldExports));

router.get(
  '/:id',
  validateRequest({ params: exportIdParamSchema }),
  asyncHandler(exportsController.getById)
);

router.get('/', authenticateJWT, asyncHandler(exportsController.getAllForUser));

router.delete(
  '/:id',
  authenticateJWT,
  validateRequest({ params: exportIdParamSchema }),
  asyncHandler(exportsController.deleteById)
);

export default router;
