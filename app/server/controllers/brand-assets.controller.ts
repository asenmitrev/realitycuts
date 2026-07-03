import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { BadRequestError, NotFoundError } from '../errors';
import { BrandAsset } from '../models/brand-asset';
import { S3Upload } from '../models/s3-upload';
import uploadService from '../services/upload.service';

export default {
  create: async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    const { uploadId, name } = req.body as { uploadId: string; name?: string };
    if (!uploadId) throw new BadRequestError('uploadId is required');
    const upload = await S3Upload.findById(uploadId);
    if (!upload || upload.userId !== userId) throw new NotFoundError('Upload not found');
    const asset = await BrandAsset.create({
      userId,
      s3UploadId: uploadId,
      name: name ?? upload.originalName,
      assetType: upload.mimeType.startsWith('image/')
        ? 'image'
        : upload.mimeType.startsWith('video/')
        ? 'video'
        : 'audio'
    });
    return res.json(asset);
  },
  list: async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    const assets = await BrandAsset.find({ userId }).sort({ createdAt: -1 }).populate('s3UploadId');
    return res.json({ assets });
  },
  remove: async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.user_id;
    const { id } = req.params;
    const asset = await BrandAsset.findById(id);
    if (!asset || asset.userId !== userId) throw new NotFoundError('Asset not found');

    // Best-effort delete of underlying upload + S3 object
    try {
      await uploadService.deleteUpload(asset.s3UploadId as unknown as string, userId);
    } catch (_) {
      // ignore
    }

    await asset.deleteOne();
    return res.json({ success: true });
  }
};
