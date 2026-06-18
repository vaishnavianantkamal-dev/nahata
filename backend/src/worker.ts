/**
 * BullMQ Worker — processes scheduled follow-up messages
 * Run separately: npx ts-node --transpile-only src/worker.ts
 * Falls back gracefully if Redis is unavailable.
 */
import './config/env';
import { Worker } from 'bullmq';
import { logger } from './lib/logger';

const QUEUE_NAME = 'scheduled-messages';

async function startWorker() {
  try {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    };

    const worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        logger.info({ jobId: job.id }, 'Processing scheduled message job');
        // Placeholder - will implement with PostgreSQL
        return { processed: true };
      },
      { connection: redisConfig as any }
    );

    worker.on('completed', (job) => {
      logger.info({ jobId: job.id }, 'Scheduled message sent');
    });

    worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, error: err }, 'Scheduled message failed');
    });

    logger.info('BullMQ worker started');
  } catch (err) {
    logger.warn({ err }, 'Redis unavailable — scheduled messages disabled');
  }
}

startWorker().catch(err => {
  logger.error({ err }, 'Worker startup failed');
  process.exit(1);
});
