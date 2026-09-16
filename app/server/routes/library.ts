import express from 'express';
import { authenticateJWT } from '../middleware/auth-middleware';
import { restrictRoleAccess } from '../middleware/role-access-middleware';
import { upload, libraryImportUpload } from '../middleware/multer';
import { configureDotenv } from '../config/dotenv';
import { asyncHandler } from '../utils/async-handler';
import { validateRequest } from '../middleware/validate-request';
import libraryController from '../controllers/library.controller';
import libraryTransferController from '../controllers/library-transfer.controller';
import {
  getTagsQuerySchema,
  getBrollQuerySchema,
  getBrollByHeuristicQuerySchema,
  libraryIdParamSchema,
  libraryIdAndUploadIdParamSchema,
  libraryIdAndBrollIdParamSchema,
  jobIdParamSchema,
  createLibraryBodySchema,
  processLibraryBodySchema,
  reprocessLibraryBodySchema,
  generateUploadUrlBodySchema,
  updateLibraryBodySchema,
  deleteBrollBulkBodySchema,
  getLibrariesByIdsBodySchema
} from '../validations/library.validations';
import { connectMongo } from '../models/connect';

configureDotenv();

const router = express.Router();

router.use(
  asyncHandler(async (req, res, next) => {
    await connectMongo(true);
    next();
  })
);

router.get('/stats/by-user', asyncHandler(libraryController.getLibraryStatsByUser));
router.get('/admin/all', authenticateJWT, asyncHandler(libraryController.getAllLibrariesForAdmin));

router.get('/generate-hashes-for-all', asyncHandler(libraryController.generateHashesForAll));

router.get(
  '/tags',
  authenticateJWT,
  validateRequest({ query: getTagsQuerySchema }),
  asyncHandler(libraryController.getTags)
);

// Restore a library from a backup (manifest.json + one or more part ZIPs uploaded
// together — see shared/types/library-export.ts for the format)
router.post(
  '/import',
  libraryImportUpload.array('files'),
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  asyncHandler(libraryTransferController.startImport)
);

router.get(
  '/transfer-jobs/:jobId',
  authenticateJWT,
  validateRequest({ params: jobIdParamSchema }),
  asyncHandler(libraryTransferController.getJobStatus)
);

// Create a new library item
router.post(
  '/',
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  validateRequest({ body: createLibraryBodySchema }),
  asyncHandler(libraryController.create)
);

router.post(
  '/:id/process',
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  validateRequest({ params: libraryIdParamSchema, body: processLibraryBodySchema }),
  asyncHandler(libraryController.process)
);

router.post(
  '/:id/reprocess',
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  validateRequest({ params: libraryIdParamSchema, body: reprocessLibraryBodySchema }),
  asyncHandler(libraryController.reprocess)
);
router.delete(
  '/:id',
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  validateRequest({ params: libraryIdParamSchema }),
  asyncHandler(libraryController.deleteById)
);

router.delete(
  '/:id/upload/:uploadId',
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  validateRequest({ params: libraryIdAndUploadIdParamSchema }),
  asyncHandler(libraryController.deleteUpload)
);

// Generate presigned URL for direct S3 upload
router.post(
  '/:id/upload/presigned',
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  validateRequest({ params: libraryIdParamSchema, body: generateUploadUrlBodySchema }),
  asyncHandler(libraryController.generateUploadUrl)
);

// Confirm successful upload
router.post(
  '/:id/upload/:uploadId/confirm',
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  validateRequest({ params: libraryIdAndUploadIdParamSchema }),
  asyncHandler(libraryController.confirmUpload)
);

router.post(
  '/:id/upload',
  upload.single('file'),
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  validateRequest({ params: libraryIdParamSchema }),
  asyncHandler(libraryController.createUpload)
);
// Update a library item
router.put(
  '/:id',
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  validateRequest({ params: libraryIdParamSchema, body: updateLibraryBodySchema }),
  asyncHandler(libraryController.update)
);

router.get(
  '/new',
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  asyncHandler(libraryController.getNew)
);
// Get library items
router.get(
  '/',
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  asyncHandler(libraryController.getAll)
);

router.get(
  '/:id',
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  validateRequest({ params: libraryIdParamSchema }),
  asyncHandler(libraryController.getById)
);

router.get(
  '/:id/reset-video-embeddings',
  validateRequest({ params: libraryIdParamSchema }),
  asyncHandler(libraryController.resetAndReprocessVideoEmbeddings)
);

router.get(
  '/:id/broll',
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  validateRequest({ params: libraryIdParamSchema, query: getBrollQuerySchema }),
  asyncHandler(libraryController.getBroll)
);

router.get(
  '/:id/broll/heuristic',
  authenticateJWT,
  validateRequest({ params: libraryIdParamSchema, query: getBrollByHeuristicQuerySchema }),
  asyncHandler(libraryController.getBrollByHeuristic)
);

router.get(
  '/:id/broll/aroll-combined',
  authenticateJWT,
  validateRequest({ params: libraryIdParamSchema, query: getBrollQuerySchema }),
  asyncHandler(libraryController.getBrollByArollCombined)
);

router.get(
  '/:id/broll/broll-combined',
  authenticateJWT,
  validateRequest({ params: libraryIdParamSchema, query: getBrollQuerySchema }),
  asyncHandler(libraryController.getBrollByBrollCombined)
);

router.get(
  '/:id/broll/unknown',
  authenticateJWT,
  validateRequest({ params: libraryIdParamSchema, query: getBrollQuerySchema }),
  asyncHandler(libraryController.getBrollByUnknown)
);

router.get(
  '/:id/broll/:brollId/metadata',
  authenticateJWT,
  validateRequest({ params: libraryIdAndBrollIdParamSchema }),
  asyncHandler(libraryController.getBrollMetadata)
);

router.post(
  '/:id/broll/:brollId/embeddings',
  authenticateJWT,
  validateRequest({ params: libraryIdAndBrollIdParamSchema }),
  asyncHandler(libraryController.createBrollVideoEmbeddings)
);

router.delete(
  '/:id/broll/:uploadId',
  authenticateJWT,
  validateRequest({ params: libraryIdAndUploadIdParamSchema }),
  asyncHandler(libraryController.deleteBroll)
);

router.post(
  '/:id/broll/bulk-delete',
  authenticateJWT,
  validateRequest({ params: libraryIdParamSchema, body: deleteBrollBulkBodySchema }),
  asyncHandler(libraryController.deleteBrollBulk)
);

router.post(
  '/libraries-by-ids',
  authenticateJWT,
  validateRequest({ body: getLibrariesByIdsBodySchema }),
  asyncHandler(libraryController.getLibrariesByIds)
);

router.get(
  '/:id/duplicates',
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  validateRequest({ params: libraryIdParamSchema }),
  asyncHandler(libraryController.getDuplicatesByHash)
);

router.get(
  '/:id/broll/:brollId/similar',
  authenticateJWT,
  restrictRoleAccess(['admin', 'editor', 'user']),
  validateRequest({ params: libraryIdAndBrollIdParamSchema }),
  asyncHandler(libraryController.findSimilarVideosByBrollId)
);

export default router;
