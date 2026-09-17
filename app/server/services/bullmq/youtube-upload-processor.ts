/**
 * YouTube upload processor — BullMQ handler for uploading a completed
 * export to YouTube on behalf of an automation.
 *
 * Enqueued from export-processor.ts once an export finishes, when the job
 * was tagged with `youtubeUpload.channelId` (set by automation-checker.service.ts).
 */

import type { YouTubeUploadEventData } from 'shared/types/event-contracts';
import { logger } from '../logging';

export async function processYouTubeUploadTask(data: YouTubeUploadEventData): Promise<void> {
  const { exportJobId } = data;

  logger.info(`BullMQ YouTube upload processor starting for export ${exportJobId}`);

  const { uploadCompletedExport } = await import('../youtube-upload.service.js');
  await uploadCompletedExport(exportJobId);

  logger.info(`BullMQ YouTube upload processor completed for export ${exportJobId}`);
}
