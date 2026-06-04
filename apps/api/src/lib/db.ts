import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

export async function connectDB() {
  await db.$connect();
  logger.info('Database connected');
}

export async function disconnectDB() {
  await db.$disconnect();
  logger.info('Database disconnected');
}
