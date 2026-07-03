/**
 * Chapter detection processor — BullMQ handler for the chapter detection
 * pipeline.
 *
 * Used by:
 * - BullMQ workers on EC2 (via app/server/services/bullmq/workers.ts)
 *
 * Mirrors the processing logic from:
 * - functions/chapter-detector/src/index.ts  (Lambda, now deprecated)
 * - app/server/services/automation-chapter-detector.processor.ts  (core logic)
 */

import type { ChapterDetectionEventData } from 'shared/types/event-contracts';
import { logger } from '../logging';

/**
 * Process a single chapter detection job.
 *
 * Delegates to the core processChapterDetectionMessage which handles:
 *  1. Fetch page texts from S3
 *  2. Structural chapter detection (regex) or LLM-based detection (Grok)
 *  3. Normalize ranges, split chapter text
 *  4. Enqueue per-chapter script tasks
 *
 * @param data — job payload from the 'chapter-detection' queue
 */
export async function processChapterDetectionTask(
  data: ChapterDetectionEventData
): Promise<void> {
  const { automationConfigId, sourceUploadId, userId } = data;

  logger.info(`BullMQ chapter detection processor starting`, {
    automationConfigId,
    sourceUploadId,
    userId,
  });

  // Lazy-import the heavy processor (pulls in langchain, S3, Mongoose, etc.)
  const { processChapterDetectionMessage } = await import(
    '../automation-chapter-detector.processor.js'
  );
  await processChapterDetectionMessage(data);

  logger.info(`BullMQ chapter detection processor completed`, {
    automationConfigId,
    sourceUploadId,
  });
}
