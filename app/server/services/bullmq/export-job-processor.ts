/**
 * Export job processor — BullMQ handler for the main FFmpeg export pipeline.
 *
 * Migrated from Fargate (tasks/exporter/) to run in-process on the EC2 worker.
 * The Fargate exporter container launched a separate ECS task that called into
 * `services/export/export-processor.ts`.  This BullMQ handler does the same
 * thing directly, avoiding the ECS launch overhead and simplifying the deploy.
 *
 * Used by:
 * - BullMQ workers on EC2 (via app/server/services/bullmq/workers.ts)
 *
 * Mirrors the processing logic from:
 * - tasks/exporter/src/index.ts  (Fargate entrypoint, now deprecated)
 * - app/server/services/export/export-processor.ts  (core exportJobProcessor)
 */

import type { ExportJobEventData } from 'shared/types/event-contracts';
import { logger } from '../logging';

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Process a single export job.
 *
 * Delegates to the core exportJobProcessor which handles the full FFmpeg
 * pipeline: source preparation, video composition, captions, watermark,
 * endscreen, S3 upload, and downstream social-media queue enqueuing.
 *
 * @param data — job payload from the 'exporter' queue
 */
export async function processExportJobTask(
  data: ExportJobEventData
): Promise<void> {
  const { exportJobId } = data;

  logger.info(`BullMQ export job processor starting for job ${exportJobId}`);

  // Lazy-import the heavy export processor (pulls in ffmpeg, S3, etc.)
  const { exportJobProcessor } = await import('../export/export-processor.js');
  await exportJobProcessor(exportJobId);

  logger.info(`BullMQ export job processor completed for job ${exportJobId}`);
}
