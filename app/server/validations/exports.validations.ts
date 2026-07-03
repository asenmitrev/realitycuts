import { z } from 'zod';
import { mongoIdParamSchema } from '../middleware/validate-request';

// Params schemas
export const exportIdParamSchema = mongoIdParamSchema;

