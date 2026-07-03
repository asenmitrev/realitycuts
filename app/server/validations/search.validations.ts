import { z } from 'zod';

// Body schemas
export const searchFootageBodySchema = z.object({
  query: z.string(),
  source: z.enum(['libraries', 'pexels', 'public', 'personal']),
  tags: z.array(z.string()).optional(),
  privateLibraryIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId')).optional(),
  isAllPublicLibrariesSelected: z.boolean().optional(),
  metadataFilters: z.object({
    framing: z.string().optional(),
    cameraAngle: z.string().optional(),
    perspective: z.string().optional(),
    depthOfField: z.string().optional(),
    complexity: z.string().optional(),
    arollBroll: z.string().optional(),
    focusPosition: z.string().optional(),
    clusterId: z.string().optional()
  }).optional()
}).refine(
  (data) => {
    if (data.isAllPublicLibrariesSelected) {
      return true;
    }
    if (['libraries', 'public', 'personal'].includes(data.source)) {
      return (data.tags && data.tags.length > 0) || (data.privateLibraryIds && data.privateLibraryIds.length > 0);
    }
    return true;
  },
  {
    message: 'At least one tag or private library ID is required for libraries/public/personal sources',
    path: ['tags']
  }
);

export const autosuggestPublicLibrariesBodySchema = z.object({
  script: z.string().min(1, 'Script is required')
});

