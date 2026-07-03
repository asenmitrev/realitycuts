import { z } from 'zod';
import { paginationQuerySchema, mongoIdParamSchema } from '../middleware/validate-request';

// Query schemas
export const getVideosQuerySchema = paginationQuerySchema;

export const getAllVideosForAdminQuerySchema = paginationQuerySchema;

export const getVideoStatsByUserQuerySchema = z.object({
  days: z.preprocess(
    (val) => (val === undefined ? '25' : String(val)),
    z.string().regex(/^\d+$/).transform(Number)
  )
});

// Params schemas
export const videoIdParamSchema = mongoIdParamSchema;

// Body schemas
export const createVideoBodySchema = z.object({
  uploadType: z.enum(['file', 'url', 'uploadId', 'script']),
  script: z.string().min(1, 'Script is required'),
  size: z.enum(['1080p', '1080x1920']).optional(),
  pexels: z
    .string()
    .transform(val => val === 'true')
    .optional(),
  voicePremium: z
    .string()
    .transform(val => val === 'true')
    .optional(),
  includeMusic: z
    .string()
    .transform(val => val === 'true')
    .optional(),
  fileUrl: z.string().optional(),
  uploadId: z.string().optional(),
  privateLibraryIds: z.string().optional(),
  publicLibraryIds: z.string().optional(),
  selectedTags: z
    .string()
    .optional()
    .transform(val => (val && val.length > 0 ? val.split(',') : null)),
  isAllPublicLibrariesSelected: z
    .string()
    .transform(val => val === 'true')
    .optional(),
  guidance: z.string().optional(),
  systemPrompt: z.string().optional(),
  title: z.string().optional(),
  voiceType: z.string().optional()
});

export const saveVideoBodySchema = z.object({}).passthrough(); // Allow any body for video updates

export const regenerateBrollBodySchema = z.object({}).optional();

export const exportVideoBodySchema = z
  .object({
    format: z.string().optional()
  })
  .passthrough();

export const generateDescriptionBodySchema = z.object({}).optional();
export const generateTitleBodySchema = z.object({}).optional();
export const cloneSampleVideoBodySchema = z.object({}).optional();
