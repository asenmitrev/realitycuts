/**
 * Export processor — single source of truth for FCPXML export logic.
 *
 * Used by BullMQ workers (via app/server/services/bullmq/workers.ts).
 *
 * Mirrors the processing logic from:
 * - functions/fcpxml-export-lambda/src/fcpxml-processor.ts
 */

import type { FCPXMLExportEventData } from 'shared/types/event-contracts';
import { ExportJob } from '../../models/export-job';
import videoAiDataRepository from '../../repositories/video-ai-data.repository';
import { generateFCPXML } from '../export/export-fcp';
import { logger } from '../logging';

// ---------------------------------------------------------------------------
// FCPXML Export
// ---------------------------------------------------------------------------

/**
 * Process a single FCPXML export task.
 *
 * Fetches the export job and VideoAIData, then generates the FCPXML package.
 *
 * @param eventData — job payload from the 'fcpxml-export' queue
 */
export async function processFCPXMLExportTask(
  eventData: FCPXMLExportEventData
): Promise<void> {
  const { exportJobId } = eventData;

  logger.info(`Starting FCPXML export for job ${exportJobId}`);

  const exportJob = await ExportJob.findById(exportJobId);
  if (!exportJob) {
    throw new Error(`Export job ${exportJobId} not found`);
  }

  const videoAiData = await videoAiDataRepository.findById(
    exportJob.videoDataId,
    false
  );
  if (!videoAiData) {
    throw new Error('VideoAIData model not found');
  }

  const userId = exportJob.userId;
  try {
    await generateFCPXML(videoAiData, exportJobId, userId);
  } catch (error) {
    logger.error(`Error processing FCPXML export for job ${exportJobId}:`, error);
    await ExportJob.updateOne(
      { _id: exportJobId },
      { $set: { status: 'FAILED' } }
    );
    throw error;
  }
}
