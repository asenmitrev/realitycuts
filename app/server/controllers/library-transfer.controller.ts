import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { BadRequestError } from '../errors';
import libraryTransferService from '../services/library-transfer.service';

export default {
  startImport: async (req: AuthenticatedRequest, res: Response) => {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      throw new BadRequestError('No backup files provided');
    }
    const job = await libraryTransferService.startImport(
      files.map(file => ({ path: file.path, originalName: file.originalname })),
      req.user!.user_id
    );
    res.json(job);
  },

  getJobStatus: async (req: AuthenticatedRequest, res: Response) => {
    const job = await libraryTransferService.getJobStatus(req.params.jobId, req.user!.user_id);
    res.json(job);
  }
};
