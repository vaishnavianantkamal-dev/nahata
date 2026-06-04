import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth';
import { sendWhatsApp, getConversation, stopAllEnrollmentsForLead } from './whatsapp.service';
import { db } from '../../lib/db';
import { emitToLead, emitToAll } from '../../lib/socket';
import { logger } from '../../lib/logger';

const router = Router();

// Send a WhatsApp message (manual)
router.post('/send', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const msg = await sendWhatsApp(req.body.leadId, {
      templateId: req.body.templateId,
      body: req.body.body,
      variables: req.body.variables,
      trigger: 'MANUAL',
      userId: req.user!.userId,
    });
    res.json(msg);
  } catch (e) { next(e); }
});

// Get conversation thread for a lead
router.get('/conversations/:leadId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await getConversation(req.params.leadId)); } catch (e) { next(e); }
});

// WhatsApp webhook (public — Meta verifies)
router.get('/webhooks/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    logger.info('WhatsApp webhook verified');
    return res.send(challenge);
  }
  res.sendStatus(403);
});

router.post('/webhooks/whatsapp', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    logger.debug({ body }, 'WhatsApp webhook received');

    // Handle inbound messages
    const entry = body?.entry?.[0]?.changes?.[0]?.value;
    if (entry?.messages) {
      for (const msg of entry.messages) {
        const from = msg.from; // E.164 without +
        const phone = from.startsWith('+') ? from : `+${from}`;
        const text = msg.text?.body || '';

        // Find lead by phone
        const lead = await db.lead.findFirst({ where: { primaryPhone: phone, deletedAt: null } });
        if (lead) {
          await db.message.create({
            data: {
              leadId: lead.id,
              direction: 'INBOUND',
              channel: 'WHATSAPP',
              status: 'RECEIVED',
              body: text,
              providerMessageId: msg.id,
              receivedAt: new Date(),
            },
          });

          await db.lead.update({ where: { id: lead.id }, data: { lastContactAt: new Date() } });

          // Stop active sequence enrollments (lead replied)
          const { stopAllEnrollmentsForLead } = await import('./whatsapp.service');
          await stopAllEnrollmentsForLead(lead.id, 'lead_replied');

          await db.activity.create({
            data: { leadId: lead.id, type: 'WHATSAPP_RECEIVED', title: 'WhatsApp message received', description: text.slice(0, 120) },
          });

          emitToLead(lead.id, 'message:received', { leadId: lead.id, body: text });
        }
      }
    }

    // Handle delivery/read status updates
    if (entry?.statuses) {
      for (const status of entry.statuses) {
        const msgStatus = status.status.toUpperCase();
        await db.message.updateMany({
          where: { providerMessageId: status.id },
          data: {
            status: msgStatus as any,
            deliveredAt: msgStatus === 'DELIVERED' ? new Date() : undefined,
            readAt: msgStatus === 'READ' ? new Date() : undefined,
          },
        });
        emitToAll('message:status', { providerMessageId: status.id, status: msgStatus });
      }
    }

    res.sendStatus(200);
  } catch (err) {
    logger.error({ err }, 'WhatsApp webhook error');
    res.sendStatus(200); // Always 200 to Meta
  }
});

export default router;
