import IORedis from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

let redisInstance: IORedis | null = null;

export function getRedis(): IORedis {
  if (!redisInstance) {
    redisInstance = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });

    redisInstance.on('connect', () => logger.info('Redis connected'));
    redisInstance.on('error', (err) => logger.warn({ err }, 'Redis error (non-fatal in dev)'));
  }
  return redisInstance;
}

// Gracefully disconnect
export async function disconnectRedis() {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
  }
}
