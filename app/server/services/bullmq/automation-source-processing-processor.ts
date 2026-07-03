/**
 * Automation source processing processor — BullMQ handler for per-page
 * PDF automation source processing.
 *
 * Used by:
 * - BullMQ workers on EC2 (via app/server/services/bullmq/workers.ts)
 *
 * Mirrors the processing logic from:
 * - functions/source-processor/src/index.ts  (Lambda, now deprecated)
 * - app/server/services/automation-source-page.processor.ts  (core logic)
 */

import type { AutomationSourcePageProcessingEventData } from 'shared/types/event-contracts';
import { logger } from '../logging';

/**
 * Process a single automation source page job.
 *
 * Delegates to the core processAutomationSourcePageMessage which handles:
 *  1. Dedup check (skip if page already processed)
 *  2. LLM topic extraction from page text (via Grok)
 *  3. Script generation per topic
 *  4. Persist scripts and mark page as processed
 *  5. Update automation config progress counters
 *
 * @param data — job payload from the 'automation-source-processing' queue
 */
export async function processAutomationSourcePageTask(
  data: AutomationSourcePageProcessingEventData
): Promise<void> {
  const { automationConfigId, sourceUploadId, pageNumber, userId } = data;

  logger.info(`BullMQ automation source page processor starting`, {
    automationConfigId,
    sourceUploadId,
    pageNumber,
    userId,
  });

  // Lazy-import the heavy processor (pulls in langchain, Mongoose, etc.)
  const { processAutomationSourcePageMessage } = await import(
    '../automation-source-page.processor.js'
  );
  await processAutomationSourcePageMessage(data);

  logger.info(`BullMQ automation source page processor completed`, {
    automationConfigId,
    sourceUploadId,
    pageNumber,
  });
}
