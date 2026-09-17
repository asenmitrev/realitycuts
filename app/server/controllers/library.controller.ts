import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { safelyDelete } from '../services/fs';
import { BadRequestError } from '../errors';
import { ENVIRONMENT } from '../config/const';
import libraryService from '../services/library.service';
import brollService from '../services/broll.service';

export default {
  getTags: async (req: AuthenticatedRequest, res: Response) => {
    const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const search = req.query.search as string;

    // Use the library service to get tags
    const result = await libraryService.getPublicLibraryTags(req.user!.user_id, skip, limit, search);

    res.json(result);
  },
  // Create a new library item
  create: async (req: AuthenticatedRequest, res: Response) => {
    // Delegate to library service for creating a new library
    const libraryItem = await libraryService.createLibrary(req.body, req.user!.user_id);

    res.json(libraryItem);
  },

  process: async (req: AuthenticatedRequest, res: Response) => {
    const libraryId = req.params.id;
    const isPublic = req.body.isPublic;
    const title = req.body.title;
    const uploadedFiles = req.body.uploadedFiles as {
      isNew: boolean;
      uploadId: string;
      description: string;
      link: string;
      prompt: string;
    }[];
    const library = await libraryService.processLibrary(
      libraryId,
      req.user!.user_id,
      uploadedFiles,
      isPublic,
      title
    );
    res.json(library);
  },
  reprocess: async (req: AuthenticatedRequest, res: Response) => {
    const libraryId = req.params.id;
    const prompt = req.body.prompt;
    await libraryService.reprocessLibrary(libraryId, prompt, req.user!.user_id);

    res.json({ message: 'Library reprocessing scheduled.' });
  },

  triggerClustering: async (req: AuthenticatedRequest, res: Response) => {
    const libraryId = req.params.id;
    const { alreadyRunning } = await libraryService.triggerClustering(libraryId, req.user!.user_id);

    res.json({
      message: alreadyRunning ? 'Clustering is already running for this library.' : 'Clustering job queued.',
      alreadyRunning
    });
  },
  deleteById: async (req: AuthenticatedRequest, res: Response) => {
    const libraryId = req.params.id;

    // Delegate to the library service for deleting the library
    await libraryService.deleteLibrary(libraryId, req.user!.user_id);

    return res.json({ message: 'Library deleted successfully' });
  },
  deleteUpload: async (req: AuthenticatedRequest, res: Response) => {
    const libraryId = req.params.id;
    const uploadId = req.params.uploadId;

    // Delegate to the library service for deleting the upload
    await libraryService.deleteUpload(libraryId, uploadId, req.user!.user_id);

    res.json({ message: 'Upload deleted successfully' });
  },
  createUpload: async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        throw new BadRequestError('File is required');
      }

      const libraryId = req.params.id;

      // Delegate to the library service for creating the upload
      const result = await libraryService.createUpload(libraryId, req.user!.user_id, {
        path: req.file.path,
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });

      res.json(result);
    } finally {
      req.file?.path && safelyDelete(req.file.path);
    }
  },

  // Generate presigned URL for direct S3 upload
  generateUploadUrl: async (req: AuthenticatedRequest, res: Response) => {
    const libraryId = req.params.id;
    const { filename, contentType, size, duration } = req.body;

    if (!filename || !contentType || !size) {
      throw new BadRequestError('filename, contentType, and size are required');
    }

    const result = await libraryService.generateUploadUrl(libraryId, req.user!.user_id, {
      filename,
      contentType,
      size,
      duration: duration ? parseFloat(duration) : undefined
    });

    res.json(result);
  },

  // Confirm successful upload
  confirmUpload: async (req: AuthenticatedRequest, res: Response) => {
    const libraryId = req.params.id;
    const uploadId = req.params.uploadId;

    const result = await libraryService.confirmUpload(libraryId, uploadId, req.user!.user_id);

    res.json(result);
  },
  update: async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id;
    if (!id) {
      throw new BadRequestError('Library item id is mandatory.');
    }
    const updatedLibrary = await libraryService.updateLibrary(
      id,
      {
        title: req.body.title,
        isPublic: req.body.isPublic
      },
      req.user!.user_id
    );

    return res.json(updatedLibrary);
  },
  getNew: async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    // Use the library service to get or create a new library
    const libraryItem = await libraryService.getOrCreateNewLibrary(userId);

    res.json({
      library: libraryItem,
      processedFiles: libraryItem.processedFiles.filter(file => file.link)
    });
  },
  getAll: async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;

    // Use the library service to get all libraries for the user with video counts
    const result = await libraryService.getAllUserLibraries(userId);

    res.json(result);
  },
  getById: async (req: AuthenticatedRequest, res: Response) => {
    const libraryId = req.params.id;
    const userId = req.user!.user_id;

    const library = await libraryService.getLibraryById(libraryId, userId, ENVIRONMENT === 'prod');

    const processedFiles = library.processedFiles.filter(file => file.link);

    res.json({
      library,
      processedFiles
    });
  },
  getBroll: async (req: AuthenticatedRequest, res: Response) => {
    const libraryId = req.params.id;
    const skip = parseInt(req.query.skip as string) || 0;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await brollService.getBroll(libraryId, skip, limit);

    res.json(result);
  },
  getBrollByHeuristic: async (req: AuthenticatedRequest, res: Response) => {
    const libraryId = req.params.id;
    const heuristic = req.query.heuristic as 'AROLL' | 'BROLL';
    const skip = parseInt(req.query.skip as string) || 0;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!heuristic || (heuristic !== 'AROLL' && heuristic !== 'BROLL')) {
      throw new BadRequestError('Invalid heuristic parameter. Must be AROLL or BROLL');
    }

    const result = await brollService.getBrollByHeuristic(libraryId, heuristic, skip, limit);

    res.json(result);
  },
  getBrollByArollCombined: async (req: AuthenticatedRequest, res: Response) => {
    const libraryId = req.params.id;
    const skip = parseInt(req.query.skip as string) || 0;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await brollService.getBrollByArollCombined(libraryId, skip, limit);

    res.json(result);
  },
  getBrollByBrollCombined: async (req: AuthenticatedRequest, res: Response) => {
    const libraryId = req.params.id;
    const skip = parseInt(req.query.skip as string) || 0;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await brollService.getBrollByBrollCombined(libraryId, skip, limit);

    res.json(result);
  },
  getBrollByUnknown: async (req: AuthenticatedRequest, res: Response) => {
    const libraryId = req.params.id;
    const skip = parseInt(req.query.skip as string) || 0;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await brollService.getBrollByUnknown(libraryId, skip, limit);

    res.json(result);
  },
  getBrollMetadata: async (req: AuthenticatedRequest, res: Response) => {
    const brollId = req.params.brollId;

    // Delegate to the library service for getting broll metadata
    const metadata = await libraryService.getBrollMetadata(brollId);

    res.json(metadata);
  },
  createBrollVideoEmbeddings: async (req: AuthenticatedRequest, res: Response) => {
    const brollId = req.params.brollId;

    // Delegate to the library service for creating video embeddings
    await libraryService.createBrollVideoEmbeddings(brollId, req.user!.user_id);

    res.json({ success: true });
  },
  deleteBroll: async (req: AuthenticatedRequest, res: Response) => {
    const uploadId = req.params.uploadId;
    const userId = req.user!.user_id;
    const libraryId = req.params.id;

    // Delegate to the library service for deleting the broll footage
    await libraryService.deleteBroll(libraryId, uploadId, userId);

    res.json({ message: 'Upload deleted successfully' });
  },
  deleteBrollBulk: async (req: AuthenticatedRequest, res: Response) => {
    const { brollIds } = req.body;
    const userId = req.user!.user_id;
    const libraryId = req.params.id;

    // Validate that brollIds is an array
    if (!Array.isArray(brollIds) || brollIds.length === 0) {
      throw new BadRequestError('brollIds must be a non-empty array');
    }

    // Delegate to the library service for deleting multiple broll footage items
    await libraryService.deleteBrollBulk(libraryId, brollIds, userId);

    res.json({ message: `${brollIds.length} uploads deleted successfully` });
  },
  getLibrariesByIds: async (req: AuthenticatedRequest, res: Response) => {
    const { libraryIds }: { libraryIds: string[] } = req.body;

    if (!libraryIds || !Array.isArray(libraryIds)) {
      throw new BadRequestError('Library IDs array is required');
    }

    // Delegate to the library service for getting libraries by IDs
    const libraries = await libraryService.getLibrariesByIds(libraryIds, req.user!.user_id);

    res.json(libraries);
  },

  getLibraryStatsByUser: async (req: AuthenticatedRequest, res: Response) => {
    const days = typeof req.query.days === 'string' ? parseInt(req.query.days) : 25;

    const stats = await libraryService.getLibraryStatsByUser(days);
    res.json(stats);
  },

  getAllLibrariesForAdmin: async (req: AuthenticatedRequest, res: Response) => {
    const skip = typeof req.query.skip === 'string' ? parseInt(req.query.skip) : 0;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 50;

    const result = await libraryService.getAllLibrariesForAdmin(skip, limit);

    res.json({
      libraries: result.libraries,
      total: result.total
    });
  },

  generateHashesForAll: async (req: AuthenticatedRequest, res: Response) => {
    await libraryService.generateHashesForAll();
    res.json({ message: 'Hashes generated for all libraries' });
  },

  resetAndReprocessVideoEmbeddings: async (req: AuthenticatedRequest, res: Response) => {
    const libraryId = req.params.id;

    // Delegate to the library service for resetting and reprocessing video embeddings
    const result = await libraryService.resetAndReprocessVideoEmbeddings(libraryId);

    res.json(result);
  },

  getDuplicatesByHash: async (req: AuthenticatedRequest, res: Response) => {
    const libraryId = req.params.id;
    const userId = req.user!.user_id;
    const skip = parseInt(req.query.skip as string) || 0;
    const limit = parseInt(req.query.limit as string) || 20;

    // Delegate to the library service for getting duplicates grouped by hash
    const result = await libraryService.getDuplicatesByHash(libraryId, userId, skip, limit);

    res.json(result);
  },

  findSimilarVideosByBrollId: async (req: AuthenticatedRequest, res: Response) => {
    const libraryId = req.params.id;
    const brollId = req.params.brollId;
    const userId = req.user!.user_id;
    const limit = parseInt(req.query.limit as string) || 20;
    const privateLibraryIds = req.query.privateLibraryIds
      ? (req.query.privateLibraryIds as string).split(',').filter(Boolean)
      : undefined;

    // Delegate to the library service for finding similar videos
    const result = await libraryService.findSimilarVideosByBrollId(
      brollId,
      libraryId,
      userId,
      limit,
      privateLibraryIds
    );

    res.json(result);
  }
};
