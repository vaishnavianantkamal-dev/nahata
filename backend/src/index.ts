import './config/env'; // must load first
import express from 'express';
import * as http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { connectDB, query, queryOne, queryMany } from './lib/db';
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
    const existing   = await queryOne('SELECT * FROM "User" WHERE email = $1', [ownerEmail]);
    if (!existing) {
      const hash = await bcrypt.hash(ownerPass, 12);
      const now = new Date();
      await query(
        'INSERT INTO "User" (id, name, email, phone, "passwordHash", role, "isActive", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [uuidv4(), 'Nahata Lawns Owner', ownerEmail, '+919876543210', hash, 'OWNER', true, now, now]
      );
      logger.info(`✅ Owner user created: ${ownerEmail}`);
    }

    // 2. Seed default stages if none exist
    const stageCount = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM "Stage"'
    );
    if ((stageCount?.count || 0) === 0) {
      const stages = [
        { name: 'New Lead',              key: 'new',         order: 1, color: '#64748b', isDefault: true },
        { name: 'Contacted',             key: 'contacted',   order: 2, color: '#0ea5e9' },
        { name: 'Site Visit',            key: 'site_visit',  order: 3, color: '#8b5cf6' },
        { name: 'Quotation',             key: 'quotation',   order: 4, color: '#f59e0b' },
        { name: 'Negotiation',           key: 'negotiation', order: 5, color: '#ec4899' },
        { name: 'Confirmed',             key: 'confirmed',   order: 6, color: '#16a34a', isWon: true },
        { name: 'Lost / Not Interested', key: 'lost',        order: 7, color: '#94a3b8', isLost: true },
      ];
      const now = new Date();
      for (const s of stages) {
        await query(
          'INSERT INTO "Stage" (id, name, key, "order", color, "isWon", "isLost", "isDefault", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          [uuidv4(), s.name, s.key, s.order, s.color, (s as any).isWon || false, (s as any).isLost || false, (s as any).isDefault || false, now, now]
        );
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
    const now = new Date();
    for (const s of settingsData) {
      await query(
        'INSERT INTO "Setting" (id, key, value, "updatedAt") VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO NOTHING',
        [uuidv4(), s.key, JSON.stringify(s.value), now]
      );
    }

    // 4. Seed template groups if none exist
    const tgCount = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM "TemplateGroup"'
    );
    if ((tgCount?.count || 0) === 0) {
      const tgId = uuidv4();
      const tplId = uuidv4();
      await query(
        'INSERT INTO "TemplateGroup" (id, name, icon, color, "order", "isSystem", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [tgId, 'Welcome & Enquiry', '👋', '#0ea5e9', 1, true, now, now]
      );
      await query(
        'INSERT INTO "Template" (id, "groupId", name, body, language, "order", "isActive", channel, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [tplId, tgId, 'Instant Welcome', 'Namaste {Name} 🙏 Thank you for your interest in Nahata Lawns! We\'d love to host your special day. May we know your event date & guest count?', 'en', 1, true, 'WHATSAPP', now, now]
      );
      const newStage = await queryOne<{ id: string }>(
        'SELECT id FROM "Stage" WHERE key = $1',
        ['new']
      );
      if (newStage) {
        await query(
          'INSERT INTO "StageMessageBinding" (id, "stageId", "templateId", channel, enabled, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [uuidv4(), newStage.id, tplId, 'WHATSAPP', true, now, now]
        );
      }
      logger.info('✅ Default templates created');
    }

    // 5. Ensure Bookings table exists (calendar / availability module)
    await query(`
      CREATE TABLE IF NOT EXISTS "Booking" (
        id TEXT PRIMARY KEY,
        "leadId" TEXT,
        title TEXT NOT NULL,
        "clientName" TEXT NOT NULL,
        "clientPhone" TEXT,
        "eventType" "EventType" NOT NULL DEFAULT 'WEDDING',
        venue TEXT NOT NULL DEFAULT 'Main Lawn',
        "eventDate" DATE NOT NULL,
        "startTime" TEXT,
        "endTime" TEXT,
        "guestCount" INT,
        status TEXT NOT NULL DEFAULT 'CONFIRMED',
        amount FLOAT,
        "advanceReceived" FLOAT NOT NULL DEFAULT 0,
        notes TEXT,
        color TEXT,
        "createdById" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deletedAt" TIMESTAMP,
        FOREIGN KEY ("leadId") REFERENCES "Lead"(id),
        FOREIGN KEY ("createdById") REFERENCES "User"(id)
      )
    `);
    await query('CREATE INDEX IF NOT EXISTS idx_booking_eventDate ON "Booking"("eventDate")');
    await query('CREATE INDEX IF NOT EXISTS idx_booking_status ON "Booking"(status)');
    await query('CREATE INDEX IF NOT EXISTS idx_booking_leadId ON "Booking"("leadId")');
    await query('CREATE INDEX IF NOT EXISTS idx_booking_venue ON "Booking"(venue)');

    // 6. Ensure Payments table exists (invoice / balance tracking module)
    await query(`
      CREATE TABLE IF NOT EXISTS "Payment" (
        id TEXT PRIMARY KEY,
        "quotationId" TEXT NOT NULL,
        "leadId" TEXT,
        amount FLOAT NOT NULL,
        method TEXT NOT NULL DEFAULT 'CASH',
        reference TEXT,
        "paidOn" DATE NOT NULL DEFAULT CURRENT_DATE,
        notes TEXT,
        "createdById" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deletedAt" TIMESTAMP,
        FOREIGN KEY ("quotationId") REFERENCES "Quotation"(id) ON DELETE CASCADE,
        FOREIGN KEY ("leadId") REFERENCES "Lead"(id),
        FOREIGN KEY ("createdById") REFERENCES "User"(id)
      )
    `);
    await query('CREATE INDEX IF NOT EXISTS idx_payment_quotationId ON "Payment"("quotationId")');
    await query('CREATE INDEX IF NOT EXISTS idx_payment_leadId ON "Payment"("leadId")');
    await query('CREATE INDEX IF NOT EXISTS idx_payment_paidOn ON "Payment"("paidOn")');

    // 7. Ensure Invoice tables exist + link payments to invoices (invoicing module)
    await query(`
      CREATE TABLE IF NOT EXISTS "Invoice" (
        id TEXT PRIMARY KEY,
        "invoiceNumber" TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL DEFAULT 'TAX_INVOICE',
        "quotationId" TEXT,
        "bookingId" TEXT,
        "leadId" TEXT,
        "clientName" TEXT NOT NULL,
        "clientPhone" TEXT,
        "clientGstin" TEXT,
        "clientAddress" TEXT,
        "projectDetails" TEXT,
        "issueDate" DATE NOT NULL DEFAULT CURRENT_DATE,
        "dueDate" DATE,
        "placeOfSupply" TEXT,
        "interState" BOOLEAN NOT NULL DEFAULT false,
        subtotal FLOAT NOT NULL DEFAULT 0,
        "discountAmt" FLOAT NOT NULL DEFAULT 0,
        "taxableValue" FLOAT NOT NULL DEFAULT 0,
        "gstPct" FLOAT NOT NULL DEFAULT 0,
        "cgstAmt" FLOAT NOT NULL DEFAULT 0,
        "sgstAmt" FLOAT NOT NULL DEFAULT 0,
        "igstAmt" FLOAT NOT NULL DEFAULT 0,
        "grandTotal" FLOAT NOT NULL DEFAULT 0,
        "advancePct" INT NOT NULL DEFAULT 0,
        "amountInWords" TEXT,
        notes TEXT,
        "termsText" TEXT,
        status TEXT NOT NULL DEFAULT 'UNPAID',
        "createdById" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deletedAt" TIMESTAMP,
        FOREIGN KEY ("quotationId") REFERENCES "Quotation"(id),
        FOREIGN KEY ("leadId") REFERENCES "Lead"(id),
        FOREIGN KEY ("createdById") REFERENCES "User"(id)
      )
    `);
    await query('CREATE INDEX IF NOT EXISTS idx_invoice_quotationId ON "Invoice"("quotationId")');
    await query('CREATE INDEX IF NOT EXISTS idx_invoice_type ON "Invoice"(type)');
    await query('CREATE INDEX IF NOT EXISTS idx_invoice_status ON "Invoice"(status)');
    await query('CREATE INDEX IF NOT EXISTS idx_invoice_issueDate ON "Invoice"("issueDate")');
    await query(`
      CREATE TABLE IF NOT EXISTS "InvoiceItem" (
        id TEXT PRIMARY KEY,
        "invoiceId" TEXT NOT NULL,
        "order" INT NOT NULL,
        description TEXT NOT NULL,
        notes TEXT,
        hsn TEXT,
        "areaQty" FLOAT NOT NULL DEFAULT 1,
        unit TEXT NOT NULL DEFAULT 'Nos',
        rate FLOAT NOT NULL DEFAULT 0,
        amount FLOAT NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("invoiceId") REFERENCES "Invoice"(id) ON DELETE CASCADE
      )
    `);
    await query('CREATE INDEX IF NOT EXISTS idx_invoiceitem_invoiceId ON "InvoiceItem"("invoiceId")');
    await query('ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT');
    await query('ALTER TABLE "Payment" ALTER COLUMN "quotationId" DROP NOT NULL');
    await query('CREATE INDEX IF NOT EXISTS idx_payment_invoiceId ON "Payment"("invoiceId")');

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
import bookingsRouter   from './modules/bookings/bookings.router';
import paymentsRouter   from './modules/payments/payments.router';
import invoicesRouter   from './modules/invoices/invoices.router';

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
        'http://localhost:5174',
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
      const { query: dbQuery } = await import('./lib/db');
      await dbQuery('SELECT 1');
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
  app.use(`${api}`,                    bookingsRouter);
  app.use(`${api}`,                    paymentsRouter);
  app.use(`${api}`,                    invoicesRouter);

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
