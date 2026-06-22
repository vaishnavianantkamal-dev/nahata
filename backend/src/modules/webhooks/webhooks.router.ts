import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../../lib/logger';
import { env } from '../../config/env';
import * as whatsappService from '../whatsapp/whatsapp.service';

const router = express.Router();

// ── Middleware: capture raw body for signature verification ─────────────────
// Must parse raw body BEFORE json() to compute HMAC signature
router.use((req: Request, res: Response, next: NextFunction) => {
  // Only capture raw body for POST requests (webhooks)
  if (req.method !== 'POST') {
    return express.json()(req, res, next);
  }

  let rawData = '';
  req.setEncoding('utf8');

  req.on('data', (chunk: string) => {
    rawData += chunk;
  });

  req.on('end', () => {
    (req as any).rawBody = rawData;
    try {
      const parsed = JSON.parse(rawData);
      req.body = parsed;
    } catch {
      req.body = {};
    }
    next();
  });
});

// ── GET: Webhook verification (Meta sends this on initial setup) ────────────
router.get('/', (req: Request, res: Response) => {
  const hubMode = req.query['hub.mode'] as string;
  const hubChallenge = req.query['hub.challenge'] as string;
  const hubVerifyToken = req.query['hub.verify_token'] as string;

  if (!hubMode || !hubChallenge) {
    return res.status(400).json({ error: 'Missing hub parameters' });
  }

  if (hubMode !== 'subscribe') {
    return res.status(403).json({ error: 'Invalid mode' });
  }

  if (hubVerifyToken !== env.META_WEBHOOK_VERIFY_TOKEN) {
    logger.warn({ hubVerifyToken, expected: env.META_WEBHOOK_VERIFY_TOKEN }, 'Webhook verification failed');
    return res.status(403).json({ error: 'Invalid verify token' });
  }

  logger.info('✅ WhatsApp webhook verified');
  res.status(200).type('text/plain').send(hubChallenge);
});

// ── POST: Incoming messages & status updates ─────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    // Respond 200 immediately (async processing)
    res.status(200).json({ received: true });

    // Verify HMAC signature (skip in mock mode for testing)
    const isMockMode = env.WHATSAPP_PROVIDER === 'mock';
    if (!isMockMode && env.META_APP_SECRET) {
      const signature = req.headers['x-hub-signature-256'] as string;
      const rawBody = (req as any).rawBody || '';

      if (!signature) {
        logger.warn('Missing X-Hub-Signature-256 header');
        return;
      }

      const hash = crypto
        .createHmac('sha256', env.META_APP_SECRET)
        .update(rawBody)
        .digest('hex');

      const expected = `sha256=${hash}`;
      // Use timingSafeEqual to prevent timing attacks
      try {
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
          logger.warn({ received: signature, expected }, 'Signature verification failed');
          return;
        }
      } catch (err) {
        // timingSafeEqual throws if buffer lengths differ
        logger.warn({ received: signature.length, expected: expected.length }, 'Signature length mismatch');
        return;
      }
    } else if (isMockMode) {
      logger.debug('HMAC signature verification skipped (WHATSAPP_PROVIDER=mock)');
    }

    // Process webhook asynchronously (don't await)
    const payload = req.body || {};

    if (payload.entry && Array.isArray(payload.entry)) {
      for (const entry of payload.entry) {
        if (entry.changes && Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            const value = change.value;

            // Handle incoming messages
            if (value.messages && Array.isArray(value.messages)) {
              whatsappService.handleIncomingMessages(value, value.contacts || []).catch(err => {
                logger.error({ err }, 'Error handling incoming messages');
              });
            }

            // Handle message status updates
            if (value.statuses && Array.isArray(value.statuses)) {
              whatsappService.handleMessageStatuses(value.statuses).catch(err => {
                logger.error({ err }, 'Error handling message statuses');
              });
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error({ error }, 'Webhook processing error');
  }
});

export default router;
