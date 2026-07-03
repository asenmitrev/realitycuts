import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { BadRequestError } from '../errors';
import transcriptionJobService from '../services/transcription-job.service';

export default {
  get: async (req: AuthenticatedRequest, res: Response) => {
    // Delegate to service to get jobs
    const jobs = await transcriptionJobService.getJobs(req.user!.user_id);
    res.json(jobs);
  },

  update: async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id;
    if (!id) {
      throw new BadRequestError('Transcription job id is mandatory.');
    }

    // Delegate to service to update the job
    const result = await transcriptionJobService.updateJob(id, req.user!.user_id, req.body);
    return res.json(result);
  },

  delete: async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id;

    // Delegate to service to delete the job
    await transcriptionJobService.deleteJob(id, req.user!.user_id);
    return res.json({ success: true });
  }
};
