import mongoose from 'mongoose';
import { S3Upload } from '../models/s3-upload';
import { AutomationConfig } from '../models/automation-config';
import { BadRequestError, NotFoundError } from '../errors';
import {
  copyS3ObjectWithinBucket,
  deleteFromS3Promise,
  getKeyFromUrl,
  getS3ObjectBuffer,
  putS3ObjectString
} from './storage/s3';
import { getS3FileUrl } from '../config/storage';
import { enqueueAutomationSourcePageTask, enqueueChapterDetectionTask } from './task-queue';
import { logger } from './logging';
import { AutomationSourcePageProcessed } from '../models/automation-source-page-processed';
import automationScriptRepository from '../repositories/automation-script.repository';
import "pdf-parse/worker";
import { PDFParse } from 'pdf-parse';

export async function extractPdfPageTexts(buffer: Buffer): Promise<string[]> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const textResult = await parser.getText();
    const pages = textResult.pages.map(p => p.text || '').filter(Boolean);
    if (pages.length === 0 && textResult.text) {
      return [textResult.text];
    }
    return pages.length > 0 ? pages : [''];
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

/**
 * Copy PDF from temp-uploads to permanent key; update S3Upload (unset expires); patch automation source entry.
 */
export async function finalizeAutomationPdfUpload(
  userId: string,
  automationConfigId: string,
  uploadId: string
): Promise<{ fileUrl: string; fileName: string }> {
  const upload = await S3Upload.findById(uploadId);
  if (!upload) {
    throw new NotFoundError('Upload not found');
  }
  if (upload.userId !== userId) {
    throw new NotFoundError('Upload not found');
  }
  if (upload.uploadStatus !== 'COMPLETED') {
    throw new BadRequestError('Upload is not complete');
  }
  if (upload.mimeType !== 'application/pdf') {
    throw new BadRequestError('Only PDF files are supported for automation sources');
  }

  const safeName = (upload.originalName || 'source.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
  const destKey = `users/${userId}/automation-sources/${automationConfigId}/${Date.now()}-${safeName}`;

  await copyS3ObjectWithinBucket(upload.s3Key, destKey);

  if (upload.s3Key !== destKey) {
    await deleteFromS3Promise(upload.s3Key).catch(error => {
        logger.warn('Could not delete temp PDF after copy', { key: upload.s3Key, error: error });
      });
  }

  await S3Upload.findByIdAndUpdate(upload._id, {
    $set: {
      s3Key: destKey,
      url: getS3FileUrl(destKey)
    },
    $unset: { expires: 1 }
  });
  upload.s3Key = destKey;
  upload.url = getS3FileUrl(destKey);

  await AutomationConfig.updateOne(
    { _id: new mongoose.Types.ObjectId(automationConfigId) },
    {
      $set: {
        'contentSettings.sources.$[s].fileUrl': upload.url,
        'contentSettings.sources.$[s].fileName': upload.originalName,
        'contentSettings.sources.$[s].uploadId': uploadId
      }
    },
    { arrayFilters: [{ 's.uploadId': uploadId }] }
  );

  return { fileUrl: upload.url ?? getS3FileUrl(destKey), fileName: upload.originalName };
}

export async function enqueueSourceProcessingForUpload(
  automationConfigId: string,
  uploadId: string,
  userId: string,
  theme: string
): Promise<void> {
  const config = await AutomationConfig.findById(automationConfigId).lean();
  if (!config || config.userId !== userId) {
    throw new NotFoundError('Automation config not found');
  }
  const orientation = config.contentSettings?.orientation ?? 'vertical';

  const upload = await S3Upload.findById(uploadId);
  if (!upload?.url) {
    throw new NotFoundError('Upload not found');
  }

  const buffer = await getS3ObjectBuffer(upload.s3Key);
  const pages = await extractPdfPageTexts(buffer);

  await AutomationConfig.updateOne(
    { _id: new mongoose.Types.ObjectId(automationConfigId) },
    {
      $set: {
        'contentSettings.sources.$[s].totalPages': pages.length,
        'contentSettings.sources.$[s].processedPages': 0,
        'contentSettings.sources.$[s].totalChapters': 0,
        'contentSettings.sources.$[s].processedChapters': 0,
        'contentSettings.sources.$[s].scriptCount': 0,
        'contentSettings.sources.$[s].status': 'processing',
        'contentSettings.sources.$[s].error': ''
      }
    },
    { arrayFilters: [{ 's.uploadId': uploadId }] }
  );

  if (pages.length === 0) {
    await AutomationConfig.updateOne(
      { _id: new mongoose.Types.ObjectId(automationConfigId) },
      { $set: { 'contentSettings.sources.$[s].status': 'completed' } },
      { arrayFilters: [{ 's.uploadId': uploadId }] }
    );
    return;
  }

  if (orientation === 'horizontal') {
    const pageTextsS3Key = `users/${userId}/automation-sources/${automationConfigId}/page-texts-${uploadId}.json`;
    await putS3ObjectString(pageTextsS3Key, JSON.stringify(pages), 'application/json');
    await enqueueChapterDetectionTask({
      version: '1.0.0',
      automationConfigId,
      sourceUploadId: uploadId,
      pageTextsS3Key,
      theme: theme || '',
      userId,
      totalPages: pages.length
    });
    return;
  }

  for (let i = 0; i < pages.length; i++) {
    await enqueueAutomationSourcePageTask({
      version: '1.0.0',
      automationConfigId,
      sourceUploadId: uploadId,
      pageNumber: i + 1,
      pageText: pages[i] || '',
      theme: theme || '',
      userId,
      totalPages: pages.length
    });
  }
}

export async function finalizeAndEnqueueSource(
  userId: string,
  automationConfigId: string,
  uploadId: string,
  theme: string
): Promise<void> {
  await finalizeAutomationPdfUpload(userId, automationConfigId, uploadId);
  await enqueueSourceProcessingForUpload(automationConfigId, uploadId, userId, theme);
}

export async function removeAutomationSourceArtifacts(
  userId: string,
  automationConfigId: string,
  uploadId: string,
  fileUrl?: string
): Promise<void> {
  await AutomationSourcePageProcessed.deleteMany({ sourceUploadId: new mongoose.Types.ObjectId(uploadId) });
  await automationScriptRepository.softDeleteBySource(uploadId);

  const upload = await S3Upload.findById(uploadId);
  if (upload && upload.userId === userId) {
    if (upload.s3Key) {
      await deleteFromS3Promise(upload.s3Key).catch(error => {
        logger.warn('Failed to delete S3 object for source', { key: upload.s3Key, error: error });
      });
    }
    upload.uploadStatus = 'DELETED';
    await upload.save();
  } else if (fileUrl) {
    try {
      const key = getKeyFromUrl(fileUrl);
      await deleteFromS3Promise(key).catch(error => {
        logger.warn('Failed to delete S3 object for source', { key: fileUrl, error: error });
      });
    } catch (e) {
      logger.warn('Failed to delete S3 by fileUrl', { fileUrl, error: e });
    }
  }

  await AutomationConfig.updateOne(
    { _id: new mongoose.Types.ObjectId(automationConfigId) },
    {
      $set: {
        'contentSettings.sources.$[s].isDeleted': true,
        'contentSettings.sources.$[s].deletedAt': new Date()
      }
    },
    { arrayFilters: [{ 's.uploadId': uploadId }] }
  );
}

export async function reprocessAutomationSource(
  userId: string,
  automationConfigId: string,
  uploadId: string,
  theme: string
): Promise<void> {
  const config = await AutomationConfig.findById(automationConfigId);
  if (!config || config.userId !== userId) {
    throw new NotFoundError('Automation config not found');
  }
  const src = config.contentSettings?.sources?.find(s => s.uploadId === uploadId && !s.isDeleted);
  if (!src) {
    throw new NotFoundError('Source not found');
  }

  await AutomationSourcePageProcessed.deleteMany({ sourceUploadId: new mongoose.Types.ObjectId(uploadId) });
  await automationScriptRepository.softDeleteBySource(uploadId);

  await AutomationConfig.updateOne(
    { _id: new mongoose.Types.ObjectId(automationConfigId) },
    {
      $set: {
        'contentSettings.sources.$[s].processedPages': 0,
        'contentSettings.sources.$[s].processedChapters': 0,
        'contentSettings.sources.$[s].scriptCount': 0,
        'contentSettings.sources.$[s].totalPages': 0,
        'contentSettings.sources.$[s].totalChapters': 0,
        'contentSettings.sources.$[s].status': 'processing',
        'contentSettings.sources.$[s].error': ''
      }
    },
    { arrayFilters: [{ 's.uploadId': uploadId }] }
  );

  await enqueueSourceProcessingForUpload(automationConfigId, uploadId, userId, theme);
}
