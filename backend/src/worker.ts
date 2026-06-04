/**
 * BullMQ Worker — processes scheduled follow-up messages
 * Run separately: npx ts-node --transpile-only src/worker.ts
 * Falls back gracefully if Redis is unavailable.
 */
import './config/env';
import { Worker, Queue } from 'bullmq';
import { getRedis } from './lib/redis';
import { db } from './lib/db';
import { sendWhatsApp } from './modules/whatsapp/whatsapp.service';
import { logger } from './lib/logger';

const QUEUE_NAME = 'scheduled-messages';

async function processScheduledMessages() {
  logger.info('Processing due scheduled messages...');

  // Find all PENDING messages that are due
  const due = await db.scheduledMessage.findMany({
    where: {
      status: 'PENDING',
      scheduledFor: { lte: new Date() },
    },
    include: {
      lead: true,
      enrollment: true,
      template: true,
    },
    take: 50,
  });

  for (const msg of due) {
    try {
      // Check if enrollment is still active
      if (msg.enrollment && msg.enrollment.status !== 'active') {
        await db.scheduledMessage.update({ where: { id: msg.id }, data: { status: 'CANCELLED' } });
        continue;
      }

      // Check lead is still OPEN
      if (msg.lead.status !== 'OPEN') {
        await db.scheduledMessage.update({ where: { id: msg.id }, data: { status: 'SKIPPED' } });
        continue;
      }

      // Check "ifNoReply" condition
      if (msg.enrollment) {
        const step = await db.sequenceStep.findFirst({
          where: { sequenceId: msg.enrollment.sequenceId, order: msg.enrollment.currentStepOrder + 1 },
        });

        if (step?.condition && (step.condition as any).ifNoReply) {
          // Check if lead has replied since enrollment
          const replyCount = await db.message.count({
            where: {
              leadId: msg.leadId,
              direction: 'INBOUND',
              createdAt: { gte: msg.enrollment.enrolledAt },
            },
          });
          if (replyCount > 0) {
            await db.scheduledMessage.update({ where: { id: msg.id }, data: { status: 'SKIPPED' } });
            logger.info({ leadId: msg.leadId }, 'Sequence step skipped — lead replied');
            continue;
          }
        }
      }

      // Send the message
      await sendWhatsApp(msg.leadId, {
        templateId: msg.templateId || undefined,
        body: msg.renderedBody || undefined,
        trigger: 'NO_REPLY',
      });

      await db.scheduledMessage.update({ where: { id: msg.id }, data: { status: 'SENT' } });

      logger.info({ leadId: msg.leadId, scheduledMessageId: msg.id }, 'Scheduled message sent');
    } catch (err) {
      logger.error({ err, scheduledMessageId: msg.id }, 'Failed to send scheduled message');
    }
  }
}

async function startWorker() {
  logger.info('🔧 Starting Nahata CRM Background Worker...');

  // Process due messages every minute using node-cron
  const cron = await import('node-cron');
  cron.schedule('* * * * *', async () => {
    try { await processScheduledMessages(); }
    catch (err) { logger.error({ err }, 'Scheduled message processor error'); }
  });

  logger.info('⏰ Scheduled message worker running (every 1 minute)');

  // Also try BullMQ if Redis is available
  try {
    const redis = getRedis();
    await redis.ping();

    // Use URL string to avoid ioredis version mismatch between BullMQ and our redis lib
    const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
    const connection = {
      host: redisUrl.hostname,
      port: parseInt(redisUrl.port || '6379'),
    };

    const worker = new Worker(QUEUE_NAME, async (job) => {
      logger.info({ jobId: job.id, name: job.name }, 'Processing BullMQ job');
      if (job.name === 'send-scheduled-message') {
        await processScheduledMessages();
      }
    }, {
      connection,
      concurrency: 3,
    });

    worker.on('completed', (job) => logger.debug({ jobId: job.id }, 'Job completed'));
    worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Job failed'));

    logger.info('📦 BullMQ worker also active');
  } catch {
    logger.warn('Redis not available — using cron-only mode');
  }
}

startWorker().catch(err => {
  logger.error({ err }, 'Worker startup failed');
  process.exit(1);
});
