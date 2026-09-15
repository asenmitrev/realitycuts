import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { BadRequestError } from '../errors';
import libraryTransferService from '../services/library-transfer.service';

export default {
  startImport: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      throw new BadRequestError('No backup file provided');
    }
    const job = await libraryTransferService.startImport(req.file.path, req.file.originalname, req.user!.user_id);
    res.json(job);
  },

  getJobStatus: async (req: AuthenticatedRequest, res: Response) => {
    const job = await libraryTransferService.getJobStatus(req.params.jobId, req.user!.user_id);
    res.json(job);
  }
};
