import { z } from 'zod';

// Params schemas
export const uploadIdParamSchema = z.object({
  uploadId: z.string().min(1)
});

// Body schemas
export const generatePresignedUploadUrlBodySchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  contentType: z.string().min(1, 'Content type is required'),
  size: z.number().positive('Size must be positive'),
  duration: z.number().positive().optional()
});

export const confirmUploadBodySchema = z.object({}).optional();

