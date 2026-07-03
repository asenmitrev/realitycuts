/**
 * Library processing processor — runs library processing in-process.
 *
 * Previously dispatched to AWS ECS Fargate tasks. Now all processing
 * runs locally via BullMQ workers on the same host.
 */

import type { JobPayloadMap } from './types';
import { logger } from '../logging';

async function runLibraryProcessorInProcess(
  libraryId: string,
  settingsVersion: string,
  settingsId?: string,
  settings?: unknown
): Promise<void> {
  logger.info('Running library processor in-process', {
    libraryId,
    settingsVersion,
  });

  const prevLibraryId = process.env.LIBRARY_ID;
  const prevSettingsVersion = process.env.SETTINGS_VERSION;
  const prevSettingsId = process.env.SETTINGS_ID;
  const prevSettings = process.env.SETTINGS;

  process.env.LIBRARY_ID = libraryId;
  process.env.SETTINGS_VERSION = settingsVersion;
  if (settingsId) {
    process.env.SETTINGS_ID = settingsId;
  }
  if (settings) {
    process.env.SETTINGS = JSON.stringify(settings);
  }

  try {
    const { main } = await import('../library/runner.js');
    await main(libraryId, { shouldExit: false });
  } finally {
    process.env.LIBRARY_ID = prevLibraryId;
    process.env.SETTINGS_VERSION = prevSettingsVersion;
    process.env.SETTINGS_ID = prevSettingsId;
    process.env.SETTINGS = prevSettings;
  }
}

/**
 * Process a library processing job. Runs in-process.
 *
 * @param data — job payload from the 'library-processing' queue
 */
export async function processLibraryProcessingJob(
  data: JobPayloadMap['library-processing']
): Promise<void> {
  const { type, payload, dedupeId } = data;

  logger.info('Processing library processing job', {
    type,
    dedupeId,
  });

  if (type === 'LIBRARY_PROCESSOR') {
    const settingsVersion = payload.version ?? '1.0.0';
    await runLibraryProcessorInProcess(
      payload.libraryId as string,
      settingsVersion as string,
      payload.settingsId as string | undefined,
      payload.settings
    );
    return;
  }

  const err = new Error(`Unknown task type: ${type}`);
  logger.error(err.message, { dedupeId });
  throw err;
}
