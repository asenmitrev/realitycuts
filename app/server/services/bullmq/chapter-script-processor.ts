/**
 * Chapter script processor — BullMQ handler for per-chapter script
 * generation.
 *
 * Used by:
 * - BullMQ workers on EC2 (via app/server/services/bullmq/workers.ts)
 *
 * Mirrors the processing logic from:
 * - functions/chapter-script-processor/src/index.ts  (Lambda, now deprecated)
 * - app/server/services/automation-chapter-script.processor.ts  (core logic)
 */

import type { ChapterScriptEventData } from 'shared/types/event-contracts';
import { logger } from '../logging';

/**
 * Process a single chapter script job.
 *
 * Delegates to the core processChapterScriptMessage which handles:
 *  1. Dedup check (AutomationSourcePageProcessed)
 *  2. Resolve chapter text (inline or from S3)
 *  3. Summarize chapter via Grok LLM
 *  4. Write narration script via Grok LLM
 *  5. Persist script to AutomationScript
 *  6. Update progress counters on AutomationConfig
 *
 * @param data — job payload from the 'chapter-script' queue
 */
export async function processChapterScriptTask(
  data: ChapterScriptEventData
): Promise<void> {
  const { automationConfigId, sourceUploadId, chapterNumber } = data;

  logger.info(`BullMQ chapter script processor starting`, {
    automationConfigId,
    sourceUploadId,
    chapterNumber,
  });

  const { processChapterScriptMessage } = await import(
    '../automation-chapter-script.processor.js'
  );
  await processChapterScriptMessage(data);

  logger.info(`BullMQ chapter script processor completed`, {
    automationConfigId,
    sourceUploadId,
    chapterNumber,
  });
}
