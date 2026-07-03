import { z } from 'zod';
import { mongoIdParamSchema } from '../middleware/validate-request';

// Params schemas
export const automationConfigIdParamSchema = mongoIdParamSchema;

export const channelIdParamSchema = z.object({
  channelId: z.string().min(1)
});

export const automationScriptParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId'),
  scriptId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId')
});

export const automationSourceReprocessParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId'),
  uploadId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId')
});

export const updateAutomationScriptBodySchema = z
  .object({
    topic: z.string().optional(),
    script: z.string().optional()
  })
  .refine(b => b.topic !== undefined || b.script !== undefined, {
    message: 'At least one of topic or script is required'
  });

// Body schemas - using passthrough for flexible config data
export const createAutomationConfigBodySchema = z.object({}).passthrough();
export const updateAutomationConfigBodySchema = z.object({}).passthrough();
export const toggleAutomationConfigBodySchema = z.object({ isEnabled: z.boolean() }).optional();

export const testGenerationBodySchema = z
  .object({
    configId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId')
      .optional(),
    channelId: z.string().optional()
  })
  .passthrough();
