import express from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validateRequest } from '../middleware/validate-request';
import * as controller from '../controllers/preuser-prompt.controller';
import {
  tokenParamSchema,
  createPreuserPromptBodySchema,
  submitPreuserPromptBodySchema
} from '../validations/preuser-prompts.validations';
import { authenticateJWT } from '../middleware/auth-middleware';
import { restrictRoleAccess } from '../middleware/role-access-middleware';
import { connectMongo } from '../models/connect';

const router = express.Router();

router.use(
  asyncHandler(async (req, res, next) => {
    await connectMongo(true);
    next();
  })
);

// Admin routes
router.get('/admin/all', authenticateJWT, asyncHandler(controller.getAllForAdmin));
router.get('/admin/stats', authenticateJWT, asyncHandler(controller.getStats));

// Public routes
router.post('/', validateRequest({ body: createPreuserPromptBodySchema }), asyncHandler(controller.create));
router.get('/:token', validateRequest({ params: tokenParamSchema }), asyncHandler(controller.get));
router.post(
  '/submit',
  validateRequest({ body: submitPreuserPromptBodySchema }),
  asyncHandler(controller.submitAndRedirect)
);

export default router;
