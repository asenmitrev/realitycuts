import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { BadRequestError } from '../errors';
import libraryTransferService from '../services/library-transfer.service';
import { LibraryImportInitRequest } from 'shared/types/library-export';

export default {
  initImport: async (req: AuthenticatedRequest, res: Response) => {
    const { manifest } = req.body as LibraryImportInitRequest;
    if (!manifest) {
      throw new BadRequestError('manifest is required');
    }
    const result = await libraryTransferService.initImport(manifest, req.user!.user_id);
    res.json(result);
  },

  finalizeImport: async (req: AuthenticatedRequest, res: Response) => {
    const job = await libraryTransferService.finalizeImport(req.params.jobId, req.user!.user_id);
    res.json(job);
  },

  getJobStatus: async (req: AuthenticatedRequest, res: Response) => {
    const job = await libraryTransferService.getJobStatus(req.params.jobId, req.user!.user_id);
    res.json(job);
  }
};
