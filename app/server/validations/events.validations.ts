import { z } from 'zod';

// Params schemas
export const eventIdParamSchema = z.object({
  eventId: z.string().min(1)
});

