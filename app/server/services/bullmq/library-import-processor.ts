/**
 * Library import processor — BullMQ handler for restoring a library backup
 * (manifest.json + one or more part ZIPs).
 *
 * The payload only carries the job id; everything else (the temp S3 prefix the backup
 * files were stashed under, the owning user, progress/status) lives on the
 * LibraryExportJob document, so the job survives being picked up by a different worker
 * process than the one that enqueued it.
 *
 * Used by:
 * - BullMQ workers (via app/server/services/bullmq/workers.ts)
 */

import type { LibraryImportEventData } from 'shared/types/event-contracts';
import { logger } from '../logging';

export async function processLibraryImportTask(data: LibraryImportEventData): Promise<void> {
  const { jobId } = data;

  logger.info(`BullMQ library import processor starting for job ${jobId}`);

  const { libraryTransferService } = await import('../library-transfer.service.js');
  await libraryTransferService.processImport(jobId);

  logger.info(`BullMQ library import processor completed for job ${jobId}`);
}
