import { z } from 'zod';
import { mongoIdParamSchema } from '../middleware/validate-request';

// Params schemas
export const brandAssetIdParamSchema = mongoIdParamSchema;

// Body schemas - using passthrough for flexible asset data
export const createBrandAssetBodySchema = z.object({}).passthrough();

