import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { getRedisConnection, getRedisPrefix } from './connection';
import {
  QUEUE_NAMES,
  type QueueName,
  type JobPayloadMap,
  DEFAULT_JOB_SETTINGS,
} from './types';
import { logger } from '../logging';

// ---------------------------------------------------------------------------
// Queue registry — one BullMQ Queue instance per queue name.
// Lazily initialized on first access so the Redis connection is ready.
// ---------------------------------------------------------------------------

const queueInstances = new Map<QueueName, Queue>();

/**
 * Get (or create) a BullMQ Queue for a given queue name.
 *
 * Type-safe: the return type matches the queue name's payload type from
 * JobPayloadMap.
 */
export async function getQueue<T extends QueueName>(
  queueName: T,
): Promise<Queue<JobPayloadMap[T]>> {
  let queue = queueInstances.get(queueName);
  if (!queue) {
    const connection = await getRedisConnection();
    queue = new Queue<JobPayloadMap[T]>(queueName, {
      connection,
      prefix: getRedisPrefix(),
      defaultJobOptions: DEFAULT_JOB_SETTINGS,
    });
    queueInstances.set(queueName, queue);
    logger.info(`BullMQ queue created: ${queueName}`);
  }
  return queue as Queue<JobPayloadMap[T]>;
}

/**
 * Get the specific video generation queue (most commonly used for testing).
 */
export async function getVideoGenerationQueue() {
  return getQueue(QUEUE_NAMES.VIDEO_GENERATION);
}

/**
 * Close all queue connections. Call during shutdown.
 */
export async function closeAllQueues(): Promise<void> {
  for (const [name, queue] of queueInstances) {
    try {
      await queue.close();
      logger.debug(`Queue closed: ${name}`);
    } catch (error) {
      logger.error(`Error closing queue ${name}`, { error });
    }
  }
  queueInstances.clear();
}
