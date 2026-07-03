import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { logger } from '../services/logging';
import { UploadType } from 'shared/types';
import { safelyDelete } from '../services/fs';
import { BadRequestError } from '../errors';
import videoService from '../services/video.service';

export default {
  getVideos: async (req: AuthenticatedRequest, res: Response) => {
    // Query params are already validated and transformed to numbers by the validation middleware
    const skip =
      typeof req.query.skip === 'number'
        ? req.query.skip
        : typeof req.query.skip === 'string'
        ? parseInt(req.query.skip)
        : 0;
    const limit =
      typeof req.query.limit === 'number'
        ? req.query.limit
        : typeof req.query.limit === 'string'
        ? parseInt(req.query.limit)
        : 1000;

    const result = await videoService.getVideos(req.user!.user_id, skip, limit);

    res.json({
      videos: result.videos,
      total: result.total
    });
  },
  getAllVideosForAdmin: async (req: AuthenticatedRequest, res: Response) => {
    // Query params are already validated and transformed to numbers by the validation middleware
    const skip = typeof req.query.skip === 'number' ? req.query.skip : 0;
    const limit = typeof req.query.limit === 'number' ? req.query.limit : 50;

    const result = await videoService.getAllVideosForAdmin(skip, limit);

    res.json({
      videos: result.videos,
      total: result.total
    });
  },

  getVideoStatsByUser: async (req: AuthenticatedRequest, res: Response) => {
    // Query params are already validated and transformed to numbers by the validation middleware
    const days = typeof req.query.days === 'number' ? req.query.days : 25;

    const stats = await videoService.getVideoStatsByUser(days);
    res.json(stats);
  },
  saveVideo: async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id;

    if (!id) {
      throw new BadRequestError('Video id is mandatory.');
    }

    const updatedVideo = await videoService.updateVideo(id, req.user!.user_id, req.body);
    return res.json(updatedVideo);
  },
  createVideo: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!.user_id;
    const systemPrompt = req.body.systemPrompt;
    const guidance = req.body.guidance;
    const title = req.body.title;
    const brollDuration = req.body.brollDuration;
    const voiceType = req.body.voiceType;

    const uploadType = req.body.uploadType as UploadType;
    const script = req.body.script;
    const size = req.body.size as '1080p' | '1080x1920';
    const pexels = req.body.pexels === 'true';
    const isVoicePremium = req.body.voicePremium === 'true';
    const includeMusic = req.body.includeMusic === 'true';
    const file = req.file;
    const fileUrl = req.body.fileUrl;
    const uploadId = req.body.uploadId;
    const privateLibraryIds = req.body.privateLibraryIds?.length > 0 ? req.body.privateLibraryIds.split(',') : null;
    const publicLibraryIds = req.body.publicLibraryIds?.length > 0 ? req.body.publicLibraryIds.split(',') : null;
    const selectedTags = req.body.selectedTags?.length > 0 ? req.body.selectedTags.split(',') : null;
    const isAllPublicLibrariesSelected = req.body.isAllPublicLibrariesSelected === 'true';
    const orientation = req.body.orientation as 'horizontal' | 'vertical' | undefined;
    try {
      const tjId = await videoService.createVideo({
        userId,
        uploadType,
        script,
        size,
        pexels,
        isVoicePremium,
        file,
        fileUrl,
        uploadId,
        privateLibraryIds,
        publicLibraryIds,
        selectedTags,
        guidance,
        includeMusic,
        systemPrompt,
        title,
        brollDuration,
        voiceType,
        isAllPublicLibrariesSelected,
        orientation
      });
      return res.json({ eventId: tjId });
    } catch (e) {
      file?.path && safelyDelete(file.path);
      // Pass error to Express error handler instead of re-throwing
      return next(e);
    }
  },
  getVideo: async (req: AuthenticatedRequest, res: Response) => {
    const result = await videoService.getVideo(req.params.id, req.user!.user_id);
    return res.json(result);
  },
  regenerateBroll: async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id;
    const startTime = req.body.startTime;
    const endTime = req.body.endTime;
    const pexels = req.body.pexels;
    const eventId = req.body.eventId;

    const privateLibraryIds = req.body.privateLibraryIds;

    const focusedSegments = await videoService.regenerateBroll(
      id,
      req.user!.user_id,
      startTime,
      endTime,
      privateLibraryIds,
      pexels,
      eventId
    );
    res.json(focusedSegments);
  },
  deleteVideo: async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id;
    const userId = req.user!.user_id;
    await videoService.deleteVideo(id, userId);
    return res.json({ success: true });
  },
  exportVideo: async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id;
    const userId = req.user!.user_id;
    const exportType: 'VIDEO' | 'VIDEO_CAPTIONS' | 'CAPTIONS' = req.body.exportType;
    const orientationType: 'BOTH' | 'HORIZONTAL' | 'VERTICAL' = req.body.orientationType;
    const brandWatermarkUploadId = req.body.brandWatermarkUploadId as string | undefined;
    const brandWatermarkPosition = req.body.brandWatermarkPosition as
      | 'top-left'
      | 'top-right'
      | 'bottom-left'
      | 'bottom-right'
      | 'center'
      | undefined;
    const generateThumbnail = req.body.generateThumbnail as boolean | undefined;

    const result = await videoService.exportVideo(
      id,
      userId,
      exportType,
      orientationType,
      brandWatermarkUploadId,
      brandWatermarkPosition,
      generateThumbnail
    );

    res.send(result);
  },
  exportVideoFCPXML: async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id;
    const userId = req.user!.user_id;
    const eventId = await videoService.generateFCPXML(id, userId);
    res.json({ eventId });
  },
  generateDescription: async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id;
    const description = await videoService.generateDescription(id);
    res.json({ description });
  },
  generateTitle: async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id;
    const title = await videoService.generateTitle(id);
    res.json({ title });
  },
  cloneSampleVideo: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.user_id;
      const sampleVideoId = req.params.id;
      const newVideo = await videoService.cloneSampleVideoForUser(sampleVideoId, userId);
      res.json(newVideo);
    } catch (e) {
      logger.error('Error cloning sample video', { Error: e });
      res.status(500).json({ error: 'Failed to clone sample video' });
    }
  },
  createOneShotVideo: async (req: AuthenticatedRequest, res: Response) => {
    const { prompt } = req.body as { prompt: string };
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
      res.status(400).json({ error: 'prompt must be at least 5 characters.' });
      return;
    }
    const result = await videoService.createOneShotVideo({
      prompt: prompt.trim(),
      userId: req.user!.user_id
    });
    res.json(result);
  }
};
