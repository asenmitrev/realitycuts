import { z } from 'zod';
import { mongoIdParamSchema } from '../middleware/validate-request';

// Params schemas
export const captionIdParamSchema = mongoIdParamSchema;

// Body schemas - using passthrough to allow flexible caption data
export const createCaptionBodySchema = z.object({}).passthrough();
export const updateCaptionBodySchema = z.object({}).passthrough();

