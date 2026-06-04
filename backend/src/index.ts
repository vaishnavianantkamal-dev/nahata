import './config/env'; // must load first
import express from 'express';
import * as http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { connectDB } from './lib/db';
import { getRedis } from './lib/redis';
import { initSocket } from './lib/socket';
import { logger } from './lib/logger';
import { errorHandler } from './middleware/error';
import { env } from './config/env';

// Routers
import authRouter       from './modules/auth/auth.router';
import usersRouter      from './modules/users/users.router';
import leadsRouter      from './modules/leads/leads.router';
import stagesRouter     from './modules/stages/stages.router';
import pipelineRouter   from './modules/pipeline/pipeline.router';
import whatsappRouter   from './modules/whatsapp/whatsapp.router';
import templatesRouter  from './modules/templates/templates.router';
import sequencesRouter  from './modules/sequences/sequences.router';
import callsRouter      from './modules/calls/calls.router';
import analyticsRouter  from './modules/analytics/analytics.router';
import reportsRouter    from './modules/reports/reports.router';
import webhooksRouter   from './modules/webhooks/webhooks.router';
import settingsRouter   from './modules/settings/settings.router';
import scoringRouter    from './modules/scoring/scoring.router';
import quotationsRouter from './modules/quotations/quotations.router';

async function bootstrap() {
  const app = express();
  const server = http.createServer(app);

  // Socket.IO
  initSocket(server);

  // Security middleware
  app.use(helmet({ crossOriginEmbedderPolicy: false }));
  app.use(cors({
    origin: (origin, callback) => {
      // Allow: local dev, the configured APP_BASE_URL, any Vercel preview/prod domain
      const allowed = [
        env.APP_BASE_URL,
        'http://localhost:5173',
        'http://localhost:3000',
      ];
      if (!origin || allowed.includes(origin) || /\.vercel\.app$/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Rate limiting
  app.use('/api/v1/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false }));
  app.use('/api/v1/webhooks', rateLimit({ windowMs: 60 * 1000, max: 100 }));

  // Health checks
  app.get('/healthz', (_req, res) => res.json({ status: 'ok', ts: new Date() }));
  app.get('/readyz', async (_req, res) => {
    try {
      const { db } = await import('./lib/db');
      await db.$queryRaw`SELECT 1`;
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'not ready' });
    }
  });

  // API routes (webhooks FIRST — they are public, no auth middleware)
  const api = '/api/v1';
  app.use(`${api}/webhooks`,           webhooksRouter);   // public, must be before auth routers
  app.use(`${api}/auth`,               authRouter);
  app.use(`${api}/users`,              usersRouter);
  app.use(`${api}/leads`,              leadsRouter);
  app.use(`${api}/stages`,             stagesRouter);
  app.use(`${api}/pipeline`,           pipelineRouter);
  app.use(`${api}`,                    whatsappRouter);
  app.use(`${api}`,                    templatesRouter);
  app.use(`${api}`,                    sequencesRouter);
  app.use(`${api}`,                    callsRouter);
  app.use(`${api}`,                    scoringRouter);
  app.use(`${api}/analytics`,          analyticsRouter);
  app.use(`${api}/reports`,            reportsRouter);
  app.use(`${api}`,                    settingsRouter);
  app.use(`${api}`,                    quotationsRouter);

  // Error handler (must be last)
  app.use(errorHandler);

  // Connect DB then start
  await connectDB();
  try { getRedis(); } catch { logger.warn('Redis unavailable — queued jobs will be skipped'); }

  server.listen(env.API_PORT, () => {
    logger.info(`🌿 Nahata CRM API running on http://localhost:${env.API_PORT}`);
    logger.info(`   WhatsApp provider: ${env.WHATSAPP_PROVIDER}`);
    logger.info(`   Telephony provider: ${env.TELEPHONY_PROVIDER}`);
    logger.info(`   LLM provider: ${env.LLM_PROVIDER}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    server.close(async () => {
      const { disconnectDB } = await import('./lib/db');
      const { disconnectRedis } = await import('./lib/redis');
      await disconnectDB();
      await disconnectRedis();
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch(err => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
