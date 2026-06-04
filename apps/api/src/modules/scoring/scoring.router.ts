import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../lib/db';
import { requireAuth, requireRole } from '../../middleware/auth';
import { getLlmProvider } from '../../integrations/llm';

const router = Router();

// GET scoring config (thresholds + factor weights)
router.get('/scoring/config', requireAuth, requireRole('OWNER', 'MANAGER'), async (_req, res, next) => {
  try {
    const setting = await db.setting.findUnique({ where: { key: 'scoreThresholds' } });
    res.json({
      thresholds: (setting?.value as any) || { hot: 80, warm: 50 },
      factorWeights: {
        buyingIntent:  0.25,
        budgetSignals: 0.15,
        eventDateClose: 0.10,
        engagement:    0.20,
        sentiment:     0.15,
        objections:    0.10,
        callLength:    0.05,
      },
    });
  } catch (e) { next(e); }
});

// PUT scoring config
router.put('/scoring/config', requireAuth, requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { hot = 80, warm = 50 } = req.body.thresholds || {};
    await db.setting.upsert({
      where: { key: 'scoreThresholds' },
      update: { value: { hot, warm }, updatedById: req.user!.userId },
      create: { key: 'scoreThresholds', value: { hot, warm }, updatedById: req.user!.userId },
    });
    res.json({ success: true, thresholds: { hot, warm } });
  } catch (e) { next(e); }
});

// GET lead score history
router.get('/leads/:id/scores', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scores = await db.leadScoreEvent.findMany({
      where: { leadId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(scores);
  } catch (e) { next(e); }
});

// POST force re-score a lead (using latest call)
router.post('/leads/:id/score/recompute', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lead = await db.lead.findUnique({
      where: { id: req.params.id },
      include: { calls: { orderBy: { createdAt: 'desc' }, take: 1, include: { summary: true } } },
    });

    if (!lead) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lead not found' } });

    const lastCall = lead.calls[0];
    if (!lastCall?.transcript) {
      return res.status(400).json({ error: { code: 'NO_TRANSCRIPT', message: 'No call transcript available to score from' } });
    }

    const llm = getLlmProvider();
    const intelligence = await llm.summariseAndScore({
      transcript: lastCall.transcript,
      lead: {
        name: lead.name,
        eventType: lead.eventType,
        guestCount: lead.guestCount || undefined,
        eventDate: lead.eventDate?.toISOString(),
        budgetMin: lead.budgetMin || undefined,
        budgetMax: lead.budgetMax || undefined,
      },
    });

    const scoreEvent = await db.leadScoreEvent.create({
      data: {
        leadId: lead.id,
        callId: lastCall.id,
        score: intelligence.score,
        band: intelligence.band as any,
        factors: intelligence.factors as any,
        rationale: intelligence.rationale,
        suggestedAction: intelligence.nextAction,
        source: 'MANUAL',
        model: 'mock-scorer-v1',
      },
    });

    await db.lead.update({
      where: { id: lead.id },
      data: { score: intelligence.score, scoreBand: intelligence.band as any },
    });

    const { emitToAll } = await import('../../lib/socket');
    emitToAll('lead:scored', { leadId: lead.id, score: intelligence.score, band: intelligence.band });

    res.json({ scoreEvent, intelligence });
  } catch (e) { next(e); }
});

// POST merge duplicates
router.post('/leads/merge', requireAuth, requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { primaryId, duplicateId } = req.body;
    if (!primaryId || !duplicateId) {
      return res.status(400).json({ error: { code: 'MISSING_IDS', message: 'primaryId and duplicateId required' } });
    }

    const [primary, duplicate] = await Promise.all([
      db.lead.findUnique({ where: { id: primaryId } }),
      db.lead.findUnique({ where: { id: duplicateId } }),
    ]);

    if (!primary || !duplicate) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lead(s) not found' } });
    }

    // Repoint all activities, messages, calls from duplicate to primary
    await db.$transaction([
      db.activity.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } }),
      db.message.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } }),
      db.call.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } }),
      db.leadScoreEvent.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } }),
      db.sequenceEnrollment.deleteMany({ where: { leadId: duplicateId } }),
      db.lead.update({ where: { id: duplicateId }, data: { deletedAt: new Date() } }),
      db.activity.create({
        data: {
          leadId: primaryId,
          userId: req.user!.userId,
          type: 'FIELD_UPDATED',
          title: 'Duplicate lead merged',
          description: `Merged duplicate lead: ${duplicate.name} (${duplicate.primaryPhone})`,
          meta: { mergedLeadId: duplicateId },
        },
      }),
    ]);

    res.json({ success: true, primaryId, mergedId: duplicateId });
  } catch (e) { next(e); }
});

export default router;
