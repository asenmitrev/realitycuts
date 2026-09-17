import { z } from 'zod';

export const channelIdParamSchema = z.object({
  channelId: z.string().min(1)
});

export const uploadToYoutubeBodySchema = z.object({
  videoUrl: z.string().url(),
  videoTitle: z.string().min(1),
  description: z.string().optional(),
  channelId: z.string().min(1)
});
