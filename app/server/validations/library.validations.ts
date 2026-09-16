import { z } from 'zod';
import { paginationQuerySchema, mongoIdParamSchema } from '../middleware/validate-request';

// Query schemas
export const getTagsQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional()
});

export const getBrollQuerySchema = paginationQuerySchema;

export const getBrollByHeuristicQuerySchema = paginationQuerySchema.extend({
  heuristic: z.enum(['AROLL', 'BROLL'])
});

// Params schemas
export const libraryIdParamSchema = mongoIdParamSchema;

export const libraryIdAndUploadIdParamSchema = mongoIdParamSchema.extend({
  uploadId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId')
});

export const libraryIdAndBrollIdParamSchema = mongoIdParamSchema.extend({
  brollId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId')
});

export const jobIdParamSchema = z.object({
  jobId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId')
});

// Body schemas
// Only the shape /import/init actually reads is checked — the manifest itself is a
// large, independently-versioned document (see shared/types/library-export.ts) and is
// validated more strictly by libraryTransferService.initImport.
export const importInitBodySchema = z.object({
  manifest: z
    .object({
      format: z.string(),
      stats: z.object({ totalParts: z.number().int().nonnegative() }).passthrough().optional()
    })
    .passthrough()
});

export const createLibraryBodySchema = z.object({}).passthrough(); // Allow any body for library creation

export const processLibraryBodySchema = z.object({
  isPublic: z.boolean().optional(),
  title: z.string().optional(),
  uploadedFiles: z
    .array(
      z.object({
        isNew: z.boolean(),
        uploadId: z.string(),
        name: z.string().optional(),
        url: z.string().url(),
        prompt: z.string().optional()
      })
    )
    .optional()
});

export const reprocessLibraryBodySchema = z.object({
  prompt: z.string().min(1, 'Prompt is required')
});

export const generateUploadUrlBodySchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  contentType: z.string().min(1, 'Content type is required'),
  size: z.number().positive('Size must be positive'),
  duration: z.number().positive().optional()
});

export const updateLibraryBodySchema = z.object({
  title: z.string().optional(),
  isPublic: z.boolean().optional()
});

export const deleteBrollBulkBodySchema = z.object({
  brollIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId')).min(1)
});

export const getLibrariesByIdsBodySchema = z.object({
  libraryIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId')).min(1)
});
