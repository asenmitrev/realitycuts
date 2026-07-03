/**
 * Library item deletion processor — single source of truth for broll deletion logic.
 *
 * Used by:
 * - BullMQ workers on EC2 (via app/server/services/bullmq/workers.ts)
 * - Lambda function (via import from 'server/services/bullmq/library-item-deletion-processor')
 *
 * The Lambda's handler in functions/library-item-deletion/src/processor.ts
 * imports this during migration so both paths execute identical logic.
 */

import type { LibraryItemDeletionEventData } from 'shared/types/event-contracts';
import { BrollFootageMetadata } from 'server/models/broll-video-metadata';
import { softDeleteS3Uploads, getKeyFromUrl, deleteFromS3Promise } from 'server/services/storage/s3';
import { VideoAIData } from 'server/models/video-ai-data';
import { logger } from 'server/services/logging';

/**
 * Process a single library item deletion task.
 *
 * Deletes the broll footage from S3 (soft + hard delete), removes references
 * from VideoAIData segments, and marks the broll as deleted in MongoDB.
 *
 * @param eventData — job payload from the 'library-item-deletion' queue
 */
export async function processLibraryItemDeletionTask(
  eventData: LibraryItemDeletionEventData
): Promise<void> {
  const { brollId, userId } = eventData;

  logger.info('Starting library item deletion', {
    brollId,
    userId,
  });

  const broll = await BrollFootageMetadata.findById(brollId);
  if (!broll) {
    throw new Error('Broll not found');
  }
  if (!broll.libraryId) {
    throw new Error('Library ID not found');
  }

  const s3KeyUrl = getKeyFromUrl(broll.url);
  const s3KeyThumbnail = getKeyFromUrl(broll.thumbnailUrl);

  // Soft delete video from S3
  logger.info('Deleting broll from s3 with key: ', s3KeyUrl);
  await softDeleteS3Uploads(s3KeyUrl);

  // Soft delete thumbnail from S3
  logger.info('Deleting thumbnail from s3 with key: ', s3KeyThumbnail);
  await softDeleteS3Uploads(s3KeyThumbnail);

  // Hard delete video from S3
  logger.info('Deleting broll from s3 with key: ', s3KeyUrl);
  await deleteFromS3Promise(s3KeyUrl);

  // Hard delete thumbnail from S3
  logger.info('Deleting thumbnail from s3 with key: ', s3KeyThumbnail);
  await deleteFromS3Promise(s3KeyThumbnail);

  // Handle optional second thumbnail
  if (broll.thumbnailUrl2) {
    const s3KeyThumbnail2 = getKeyFromUrl(broll.thumbnailUrl2);
    logger.info('Soft deleting thumbnail from db with key: ', s3KeyThumbnail2);
    await softDeleteS3Uploads(s3KeyThumbnail2);
    logger.info('Deleting thumbnail from s3 with key: ', s3KeyThumbnail2);
    await deleteFromS3Promise(s3KeyThumbnail2);
  }

  // Remove broll URL references from VideoAIData segments
  await VideoAIData.updateMany(
    {
      'segments.alternatives.link': broll.url,
    },
    {
      $pull: {
        'segments.$[].alternatives': {
          link: broll.url,
        },
      },
    }
  );

  // Mark broll as deleted
  broll.isDeleted = true;
  await broll.save();

  logger.info('Library item deletion completed', {
    brollId,
    userId,
  });
}
