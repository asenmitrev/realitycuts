import { configureDotenv } from './config/dotenv';

// Load environment variables FIRST (before any other imports that might use them)
configureDotenv();

import mongoose from 'mongoose';
import { connectMongo } from './models/connect';
import { ensureBrollVectorSearchIndex } from './models/broll-video-metadata';
import { logger } from './services/logging';
import { createHttpTerminator } from 'http-terminator';
import { createApp } from './app';

const port = process.env.PORT ?? 3010;

main().catch(err => logger.error(err));

async function main() {
  await connectMongo(true);
  await ensureBrollVectorSearchIndex();

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
