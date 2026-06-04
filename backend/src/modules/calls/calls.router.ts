import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth';
import * as svc from './calls.service';
import { db } from '../../lib/db';
import { emitToLead } from '../../lib/socket';
import { logger } from '../../lib/logger';
import { normalizeIndianPhone } from '../../lib/helpers';
import { fireLeadCreatedAutomation } from '../whatsapp/whatsapp.service';
import { createLead } from '../leads/leads.service';

const router = Router();

// Click-to-call
router.post('/calls/click-to-call', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.clickToCall(req.body.leadId, req.user!.userId)); } catch (e) { next(e); }
});

// Get calls
router.get('/calls', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await svc.getCalls({
      leadId: req.query.leadId as string,
      direction: req.query.direction as string,
      status: req.query.status as string,
    }));
  } catch (e) { next(e); }
});

// Get single call
router.get('/calls/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.getCall(req.params.id)); } catch (e) { next(e); }
});

// Re-run AI pipeline
router.post('/calls/:id/retry-ai', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try { await svc.processCallRecording(req.params.id); res.json({ success: true }); } catch (e) { next(e); }
});

// Telephony webhook — call lifecycle events
router.post('/webhooks/telephony/events', async (req: Request, res: Response) => {
  try {
    const { providerCallId, status, answeredAt, endedAt, durationSec } = req.body;
    const call = await db.call.findFirst({ where: { providerCallId } });
    if (call) {
      await db.call.update({
        where: { id: call.id },
        data: {
          status: status?.toUpperCase() || call.status,
          answeredAt: answeredAt ? new Date(answeredAt) : call.answeredAt,
          endedAt: endedAt ? new Date(endedAt) : call.endedAt,
          durationSec: durationSec || call.durationSec,
        },
      });
      if (call.leadId) emitToLead(call.leadId, 'call:status', { callId: call.id, status });
    }
    res.sendStatus(200);
  } catch (err) {
    logger.error({ err }, 'Telephony event webhook error');
    res.sendStatus(200);
  }
});

// Telephony webhook — recording ready → kick off AI pipeline
router.post('/webhooks/telephony/recording', async (req: Request, res: Response) => {
  try {
    const { providerCallId } = req.body;
    const call = await db.call.findFirst({ where: { providerCallId } });
    if (call) {
      // Process in background (don't await in the webhook handler)
      svc.processCallRecording(call.id).catch(err => logger.error({ err }, 'Recording AI pipeline failed'));
    }
    res.sendStatus(200);
  } catch (err) {
    logger.error({ err }, 'Recording webhook error');
    res.sendStatus(200);
  }
});

// IVR webhook — inbound call
router.post('/webhooks/telephony/ivr', async (req: Request, res: Response) => {
  try {
    const { callerPhone, providerCallId } = req.body;
    const phone = normalizeIndianPhone(callerPhone || req.body.from || '');

    if (!phone) { return res.sendStatus(400); }

    // Find or create lead
    let lead = await db.lead.findFirst({ where: { primaryPhone: phone, deletedAt: null } });
    if (!lead) {
      const result = await createLead({
        name: `IVR Caller ${phone.slice(-4)}`,
        primaryPhone: phone,
        source: 'IVR_INBOUND',
        eventType: 'OTHER',
      });
      lead = result.lead;
      // Fire automation for new IVR lead
      await fireLeadCreatedAutomation(lead.id).catch(() => {});
    }

    const call = await db.call.create({
      data: {
        leadId: lead.id,
        direction: 'INBOUND',
        status: 'IN_PROGRESS',
        fromNumber: phone,
        toNumber: process.env.EXOTEL_CALLER_ID || '+914044444444',
        providerCallId,
        consentPlayed: true,
        startedAt: new Date(),
      },
    });

    // Process recording when ready
    setTimeout(() => {
      svc.processCallRecording(call.id).catch(() => {});
    }, 5000);

    res.json({ success: true, leadId: lead.id, callId: call.id });
  } catch (err) {
    logger.error({ err }, 'IVR webhook error');
    res.sendStatus(200);
  }
});

export default router;
