import { Response, Request } from 'express';
import { AuthenticatedRequest } from '../types';
import youtubeUploadService from '../services/youtube-upload.service';

export default {
  auth: (req: Request, res: Response) => {
    const returnPath = (req.query.return_path as string) || '/';
    const userId = req.query.user_id as string;

    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    res.redirect(youtubeUploadService.generateAuthUrl(userId, returnPath));
  },

  callback: async (req: Request, res: Response) => {
    const { code, state } = req.query;

    if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const redirectUrl = await youtubeUploadService.handleCallback(code, state);
    res.redirect(redirectUrl);
  },

  getChannels: async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    const result = await youtubeUploadService.getChannels(userId);
    res.status(200).json(result);
  },

  removeChannel: async (req: AuthenticatedRequest, res: Response) => {
    const { channelId } = req.params;
    const userId = req.user!.user_id;

    await youtubeUploadService.removeChannel(userId, channelId);
    res.status(200).json({ success: true });
  },

  upload: async (req: AuthenticatedRequest, res: Response) => {
    const { videoUrl, videoTitle, description, channelId } = req.body;
    const userId = req.user!.user_id;

    const result = await youtubeUploadService.uploadVideo(userId, { videoUrl, videoTitle, description, channelId });

    if (!result.success) {
      return res.status(401).json({ error: result.error, needsAuth: result.needsAuth });
    }

    res.status(200).json({ success: true, videoId: result.videoId, youtubeUrl: result.youtubeUrl });
  }
};
