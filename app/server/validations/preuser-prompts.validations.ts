import { z } from 'zod';

// Params schemas
export const tokenParamSchema = z.object({
  token: z.string().min(1)
});

// Body schemas
export const createPreuserPromptBodySchema = z.object({}).passthrough();
export const submitPreuserPromptBodySchema = z.object({}).passthrough();

