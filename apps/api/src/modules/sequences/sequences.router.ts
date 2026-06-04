import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../lib/db';
import { requireAuth, requireRole } from '../../middleware/auth';
import { enrollInSequence, stopEnrollment } from '../whatsapp/whatsapp.service';

const router = Router();

router.get('/sequences', requireAuth, async (_req, res, next) => {
  try {
    res.json(await db.sequence.findMany({
      include: { steps: { orderBy: { order: 'asc' }, include: { template: { select: { id: true, name: true, body: true } } } } },
      orderBy: { createdAt: 'asc' },
    }));
  } catch (e) { next(e); }
});

router.post('/sequences', requireAuth, requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { steps, ...data } = req.body;
    const seq = await db.sequence.create({
      data: { ...data, steps: steps ? { create: steps } : undefined },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    res.status(201).json(seq);
  } catch (e) { next(e); }
});

router.patch('/sequences/:id', requireAuth, requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { steps, ...data } = req.body;
    const seq = await db.sequence.update({ where: { id: req.params.id }, data });
    res.json(seq);
  } catch (e) { next(e); }
});

router.get('/sequences/:id/enrollments', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await db.sequenceEnrollment.findMany({
      where: { sequenceId: req.params.id },
      include: { lead: { select: { id: true, name: true, primaryPhone: true } } },
      orderBy: { enrolledAt: 'desc' },
    }));
  } catch (e) { next(e); }
});

router.post('/leads/:id/sequences/:seqId/enroll', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await enrollInSequence(req.params.id, req.params.seqId));
  } catch (e) { next(e); }
});

router.post('/enrollments/:id/stop', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await stopEnrollment(req.params.id, 'manual_stop');
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
