import { z } from 'zod';
import { mongoIdParamSchema } from '../middleware/validate-request';

// Params schemas
export const transcriptionJobIdParamSchema = mongoIdParamSchema;

// Body schemas - using passthrough for flexible update data
export const updateTranscriptionJobBodySchema = z.object({}).passthrough();

