import { configureDotenv } from './config/dotenv';

// Load environment variables FIRST (before any other imports that might use them)
configureDotenv();

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { connectMongo } from './models/connect';
import { ensureBrollVectorSearchIndex } from './models/broll-video-metadata';
import { logger } from './services/logging';
import { createHttpTerminator } from 'http-terminator';
import { createApp } from './app';

const port = process.env.PORT ?? 3021;

main().catch(err => logger.error(err));

async function main() {
  // Scratch dirs are gitignored and don't exist on a fresh checkout or in a
  // fresh container: the export pipeline writes all intermediate FFmpeg files
  // to ./data (cwd-relative) and TTS writes to /tmp/data. Create them before
  // any worker can pick up a job, or the first file write fails with ENOENT.
  fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
  fs.mkdirSync('/tmp/data', { recursive: true });

  await connectMongo(true);
  await ensureBrollVectorSearchIndex();

  // Fail/clean up any library import job orphaned by a previous server restart
  // (fire-and-forget — shouldn't delay boot).
  void import('./services/library-transfer.service.js')
    .then(({ libraryTransferService }) => libraryTransferService.cleanupStaleImportJobs())
    .catch(err => logger.error('Failed to clean up stale library import jobs', { error: err?.toString() }));

  // Initialize BullMQ workers (EC2/PM2 mode only)
  const { startWorkers, shutdown, scheduleAutomationCheckerJob } = await import('./services/bullmq/workers.js');
  await startWorkers();
  await scheduleAutomationCheckerJob();

  const app = createApp();

  const server = app.listen(port, () => {
    logger.info(`RealityCuts App listening on port ${port} with ${process.env.ENVIRONMENT} db`);
  });

  const httpTerminator = createHttpTerminator({ server, gracefulTerminationTimeout: 170000 });
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  async function gracefulShutdown() {
    logger.info('Gracefully shutting down...');

    try {
      // Stop BullMQ workers first (drain in-progress jobs)
      await shutdown();

      // Disconnect the Mongoose connection
      await httpTerminator.terminate();
      logger.info('Express connection closed.');
      await mongoose.disconnect();
      logger.info('Mongoose connection closed.');
      logger.info('Exiting.');

      // Allow PM2 to terminate the process
      process.exit(0);
    } catch (err) {
      logger.error('Error during graceful shutdown:', { error: err?.toString() });
      process.exit(1);
    }
  }
}
