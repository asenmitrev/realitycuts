import { logger } from '../logging';
import { processLibraryClustering } from '../clustering.service';
import type { JobPayloadMap } from './types';

export async function processLibraryClusteringTask(
  data: JobPayloadMap['library-clustering']
): Promise<void> {
  const { libraryId } = data;
  try {
    const result = await processLibraryClustering(libraryId);
    logger.info('Library clustering job finished', result);
  } catch (error) {
    logger.error('Library clustering job failed', {
      libraryId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
