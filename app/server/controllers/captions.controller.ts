import { AuthenticatedRequest } from '../types';
import { Response } from 'express';
import captionService from '../services/caption.service';

export default {
  createCaption: async (req: AuthenticatedRequest, res: Response) => {
    req.body.userId = req.user!.user_id;
    const caption = await captionService.createCaption(req.body);
    res.json(caption);
  },

  getCaptionById: async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id;
    req.body.userId = req.user!.user_id;

    // For update operations
    const caption = await captionService.updateCaption(id, req.body);
    return res.json(caption);
  },

  getCaptions: async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    const captions = await captionService.getCaptionsForUser(userId);
    res.json(captions);
  },

  deleteCaptionById: async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id;
    const userId = req.user!.user_id;

    await captionService.deleteCaption(id, userId);
    return res.json({ message: 'Caption deleted successfully.' });
  }
};
