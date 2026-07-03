/**
 * Video generation processor — single source of truth for video generation logic.
 *
 * Used by:
 * - BullMQ workers on EC2 (via app/server/services/bullmq/workers.ts)
 * - Lambda function (via import from 'server/services/video-generation-processor')
 *
 * The Lambda's handler in functions/video-generation-lambda/src/index.ts
 * imports this during migration so both paths execute identical logic.
 */

import type { VideoGenerationEventData } from 'shared/types/event-contracts';
import type { IVideoAIData } from 'shared/types';
import type { IExportJob } from '../types';
import { generationProcessor, generationProcessorV2 } from './generation-processor';
import { generationProcessorV5 } from './generation-processor-v5';
import exportRepository from '../repositories/export.repository';
import { enqueueExporterTaskBullMQ } from './task-queue';
import { logger } from './logging';
import { sendError } from './sockets';


/**
 * Process a single video generation task.
 *
 * Dispatches to the appropriate generation processor based on the event
 * data version field. Mirrors the logic from
 * functions/video-generation-lambda/src/index.ts so that Lambda and
 * BullMQ worker paths remain identical during migration.
 */
export async function processVideoGenerationTask(eventData: VideoGenerationEventData): Promise<void> {
  const { tjId, userId } = eventData;

  try {
    logger.info(`Starting video generation for job ${tjId}`, {
      tjId,
      userId,
    });

    const generateExport = async (videoAiData: IVideoAIData, exportConfigData: Partial<IExportJob>) => {
      if (videoAiData && exportConfigData) {
        const exportConfig: Partial<IExportJob> = { ...exportConfigData, videoDataId: videoAiData._id };
        const exportJob = await exportRepository.create(exportConfig);
        await enqueueExporterTaskBullMQ(exportJob._id.toString());
      }
    };

    // Dispatch based on version — mirrors functions/video-generation-lambda/src/index.ts
    if (eventData.version === '1.0.0') {
      await generationProcessor(eventData);
    } else if (eventData.version === '2.0.0') {
      throw new Error('Invalid video generation event data version');
    } else if (eventData.version === '3.0.0') {
      let videoAiData: IVideoAIData | undefined = undefined;
      videoAiData = await generationProcessorV2(eventData, '/tmp');
      if (!videoAiData) {
        throw new Error('Video AI data not found');
      }
      if (eventData.exportConfig) {
        await generateExport(videoAiData, eventData.exportConfig);
      }

    } else if (eventData.version === '4.0.0') {
      let videoAiData: IVideoAIData | undefined = undefined;
      videoAiData = await generationProcessorV5(eventData, '/tmp');
      if (!videoAiData) {
        throw new Error('Video AI data not found');
      }
      if (eventData.exportConfig) {
        await generateExport(videoAiData, eventData.exportConfig);
      }
    } else {
      throw new Error('Invalid video generation event data version');
    }

    logger.info(`Completed video generation for job ${tjId}`, { tjId, userId });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Error processing video generation', {
      tjId,
      userId,
      error: err.message,
      errorStack: err.stack,
    });

    // Send error to user via WebSocket
    sendError(userId, tjId, 'Error processing video generation', 100);
    throw error;
  }
}
