import './config/env'; // must load first
import express from 'express';
import * as http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import * as bcrypt from 'bcryptjs';
import { connectDB, db } from './lib/db';
import { getRedis } from './lib/redis';
import { initSocket } from './lib/socket';
import { logger } from './lib/logger';
import { errorHandler } from './middleware/error';
import { env } from './config/env';

// ── Auto-seed: runs on every startup, safe to run multiple times ─────────────
async function autoSeed() {
  try {
    // 1. Create owner user if not exists
    const ownerEmail = process.env.SEED_OWNER_EMAIL || 'owner@nahatalawns.com';
    const ownerPass  = (process.env.SEED_OWNER_PASSWORD) || 'NahataOwner2024!';
    const existing   = await db.user.findUnique({ where: { email: ownerEmail } });
    if (!existing) {
      const hash = await bcrypt.hash(ownerPass, 12);
      await db.user.create({
        data: { name: 'Nahata Lawns Owner', email: ownerEmail, phone: '+919876543210', passwordHash: hash, role: 'OWNER', isActive: true },
      });
      logger.info(`✅ Owner user created: ${ownerEmail}`);
    }

    // 2. Seed default stages if none exist
    const stageCount = await db.stage.count();
    if (stageCount === 0) {
      const stages = [
        { name: 'New Lead',              key: 'new',         order: 1, color: '#64748b', isDefault: true },
        { name: 'Contacted',             key: 'contacted',   order: 2, color: '#0ea5e9' },
        { name: 'Site Visit',            key: 'site_visit',  order: 3, color: '#8b5cf6' },
        { name: 'Quotation',             key: 'quotation',   order: 4, color: '#f59e0b' },
        { name: 'Negotiation',           key: 'negotiation', order: 5, color: '#ec4899' },
        { name: 'Confirmed',             key: 'confirmed',   order: 6, color: '#16a34a', isWon: true },
        { name: 'Lost / Not Interested', key: 'lost',        order: 7, color: '#94a3b8', isLost: true },
      ];
      for (const s of stages) {
        await db.stage.upsert({ where: { key: s.key }, update: {}, create: { ...s, isWon: (s as any).isWon || false, isLost: (s as any).isLost || false, isDefault: (s as any).isDefault || false } });
      }
      logger.info('✅ Default stages created');
    }

    // 3. Seed default settings if not present
    const settingsData = [
      { key: 'venueName',       value: 'Nahata Lawns' },
      { key: 'timezone',        value: 'Asia/Kolkata' },
      { key: 'currency',        value: 'INR' },
      { key: 'defaultCountryCode', value: '+91' },
      { key: 'scoreThresholds', value: { hot: 80, warm: 50 } },
      { key: 'customEventTypes', value: [] },
      { key: 'customSources',    value: [] },
    ];
    for (const s of settingsData) {
      await db.setting.upsert({ where: { key: s.key }, update: {}, create: s });
    }

    // 4. Seed template groups if none exist
    const tgCount = await db.templateGroup.count();
    if (tgCount === 0) {
      const tg = await db.templateGroup.create({ data: { name: 'Welcome & Enquiry', icon: '👋', color: '#0ea5e9', order: 1, isSystem: true } });
      const template = await db.template.create({
        data: { groupId: tg.id, name: 'Instant Welcome', body: 'Namaste {Name} 🙏 Thank you for your interest in Nahata Lawns! We\'d love to host your special day. May we know your event date & guest count?', order: 1 },
      });
      // Bind welcome template to New Lead stage
      const newStage = await db.stage.findFirst({ where: { key: 'new' } });
      if (newStage) {
        await db.stageMessageBinding.upsert({ where: { stageId: newStage.id }, update: {}, create: { stageId: newStage.id, templateId: template.id, enabled: true } });
      }
      logger.info('✅ Default templates created');
    }

    logger.info('🌿 Auto-seed complete');
  } catch (err) {
    logger.error({ err }, 'Auto-seed failed (non-fatal)');
  }
}

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

  // Auto-seed on first run (production: no shell access on free tier)
  await autoSeed();

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
