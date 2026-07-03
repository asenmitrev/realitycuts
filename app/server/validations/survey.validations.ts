import { z } from 'zod';

// Body schemas
export const createSurveyBodySchema = z.object({
  userType: z.string().optional(),
  userTypeOther: z.string().optional(),
  usageTypes: z.array(z.string()).optional(),
  usageTypesOther: z.string().optional()
});

export const updateSurveyBodySchema = createSurveyBodySchema;

