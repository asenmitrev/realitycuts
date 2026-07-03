import express from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validateRequest } from '../middleware/validate-request';
import automationConfigController from '../controllers/automation-config.controller';
import { authenticateJWT } from '../middleware/auth-middleware';
import {
  automationConfigIdParamSchema,
  automationScriptParamsSchema,
  automationSourceReprocessParamsSchema,
  channelIdParamSchema,
  createAutomationConfigBodySchema,
  updateAutomationConfigBodySchema,
  toggleAutomationConfigBodySchema,
  testGenerationBodySchema,
  updateAutomationScriptBodySchema
} from '../validations/automation-config.validations';
import automationScriptController from '../controllers/automation-script.controller';
import { connectMongo } from '../models/connect';

const router = express.Router();

router.use(
  asyncHandler(async (req, res, next) => {
    await connectMongo(true);
    next();
  })
);
// Admin routes
router.get('/admin/all', authenticateJWT, asyncHandler(automationConfigController.getAllAutomationsForAdmin));

// User routes (require authentication)
router.get('/user', authenticateJWT, asyncHandler(automationConfigController.getUserConfigs));
router.get('/user/limits', authenticateJWT, asyncHandler(automationConfigController.getUserLimits));
router.post(
  '/',
  authenticateJWT,
  validateRequest({ body: createAutomationConfigBodySchema }),
  asyncHandler(automationConfigController.createConfig)
);

// New routes using ID (recommended for new implementations)
router.get(
  '/id/:id',
  authenticateJWT,
  validateRequest({ params: automationConfigIdParamSchema }),
  asyncHandler(automationConfigController.getConfigById)
);
router.put(
  '/id/:id',
  authenticateJWT,
  validateRequest({ params: automationConfigIdParamSchema, body: updateAutomationConfigBodySchema }),
  asyncHandler(automationConfigController.updateConfigById)
);
router.delete(
  '/id/:id',
  authenticateJWT,
  validateRequest({ params: automationConfigIdParamSchema }),
  asyncHandler(automationConfigController.deleteConfigById)
);
router.post(
  '/id/:id/toggle',
  authenticateJWT,
  validateRequest({ params: automationConfigIdParamSchema, body: toggleAutomationConfigBodySchema }),
  asyncHandler(automationConfigController.toggleConfigById)
);

router.get(
  '/id/:id/scripts',
  authenticateJWT,
  validateRequest({ params: automationConfigIdParamSchema }),
  asyncHandler(automationScriptController.listScripts)
);
router.get(
  '/id/:id/scripts/:scriptId',
  authenticateJWT,
  validateRequest({ params: automationScriptParamsSchema }),
  asyncHandler(automationScriptController.getScript)
);
router.put(
  '/id/:id/scripts/:scriptId',
  authenticateJWT,
  validateRequest({ params: automationScriptParamsSchema, body: updateAutomationScriptBodySchema }),
  asyncHandler(automationScriptController.updateScript)
);
router.delete(
  '/id/:id/scripts/:scriptId',
  authenticateJWT,
  validateRequest({ params: automationScriptParamsSchema }),
  asyncHandler(automationScriptController.softDeleteScript)
);
router.post(
  '/id/:id/sources/:uploadId/reprocess',
  authenticateJWT,
  validateRequest({ params: automationSourceReprocessParamsSchema }),
  asyncHandler(automationScriptController.reprocessSource)
);
router.delete(
  '/id/:id/sources/:uploadId/scripts',
  authenticateJWT,
  validateRequest({ params: automationSourceReprocessParamsSchema }),
  asyncHandler(automationScriptController.deleteScriptsBySource)
);

// Legacy routes using channelId (kept for backward compatibility)
router.get(
  '/:channelId',
  authenticateJWT,
  validateRequest({ params: channelIdParamSchema }),
  asyncHandler(automationConfigController.getConfigByChannelId)
);
router.get(
  '/channel/:channelId/all',
  authenticateJWT,
  validateRequest({ params: channelIdParamSchema }),
  asyncHandler(automationConfigController.getAllConfigsByChannelId)
);
router.put(
  '/:channelId',
  authenticateJWT,
  validateRequest({ params: channelIdParamSchema, body: updateAutomationConfigBodySchema }),
  asyncHandler(automationConfigController.updateConfig)
);
router.delete(
  '/:channelId',
  authenticateJWT,
  validateRequest({ params: channelIdParamSchema }),
  asyncHandler(automationConfigController.deleteConfig)
);
router.post(
  '/:channelId/toggle',
  authenticateJWT,
  validateRequest({ params: channelIdParamSchema, body: toggleAutomationConfigBodySchema }),
  asyncHandler(automationConfigController.toggleConfig)
);

// Test generation route
router.post(
  '/test/generation',
  authenticateJWT,
  validateRequest({ body: testGenerationBodySchema }),
  asyncHandler(automationConfigController.testGeneration)
);

export default router;
