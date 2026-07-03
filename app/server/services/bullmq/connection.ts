import { Redis } from 'ioredis';
import { logger } from '../logging';

// Redis connection settings — defaults to localhost for self-hosted Phase 0.
// Override via environment variables:
//   REDIS_HOST     — host (default: localhost)
//   REDIS_PORT     — port (default: 6379)
//   REDIS_PASSWORD — password (default: none)
//   REDIS_DB       — database number (default: 0)
//   REDIS_PREFIX   — key prefix for BullMQ queues (default: 'videoai:')
const REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT ?? '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD ?? undefined;
const REDIS_DB = parseInt(process.env.REDIS_DB ?? '0', 10);
const REDIS_PREFIX = process.env.REDIS_PREFIX ?? 'videoai:';

let redisConnection: Redis | null = null;

/**
 * Returns a singleton Redis connection shared across all BullMQ queues and workers.
 * BullMQ requires the same IORedis instance for producers and consumers so that
 * they share connection pooling and avoid race conditions on job state.
 *
 * @returns A connected IORedis client.
 */
export async function getRedisConnection(): Promise<Redis> {
  if (redisConnection && redisConnection.status === 'ready') {
    return redisConnection;
  }

  // If a previous connection exists but is no longer ready, close it first.
  if (redisConnection) {
    try {
      await redisConnection.quit();
    } catch {
      // Connection may already be closed — ignore.
    }
    redisConnection = null;
  }

  redisConnection = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    db: REDIS_DB,
    maxRetriesPerRequest: null, // BullMQ recommendation: unbounded retries for queue operations
    retryStrategy: (attempt: number) => {
      const delay = Math.min(attempt * 100, 2000);
      logger.warn(`Redis reconnection attempt ${attempt} (delay ${delay}ms)`);
      return delay;
    },
    lazyConnect: true,
  });

  redisConnection.on('error', (error) => {
    logger.error('Redis connection error', { error: error.message });
  });

  redisConnection.on('connect', () => {
    logger.info('Redis connected', { host: REDIS_HOST, port: REDIS_PORT, db: REDIS_DB });
  });

  await redisConnection.connect();

  return redisConnection;
}

/**
 * Gracefully close the Redis connection. Call during shutdown.
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisConnection) {
    try {
      await redisConnection.quit();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis connection', { error });
    }
    redisConnection = null;
  }
}

/**
 * Returns the key prefix used by all BullMQ queues.
 */
export function getRedisPrefix(): string {
  return REDIS_PREFIX;
}
