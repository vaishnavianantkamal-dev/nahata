import { Router, Request, Response, NextFunction } from 'express';
import * as svc from './leads.service';
import { requireAuth, requireRole } from '../../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as any;
    const result = await svc.getLeads({
      page: q.page ? parseInt(q.page) : 1,
      pageSize: q.pageSize ? parseInt(q.pageSize) : 20,
      sort: q.sort, order: q.order,
      stageId: q.stageId, source: q.source, ownerId: q.ownerId,
      status: q.status, scoreBand: q.scoreBand, eventType: q.eventType,
      dateFrom: q.dateFrom, dateTo: q.dateTo, search: q.search,
    });
    res.json(result);
  } catch (e) { next(e); }
});

router.get('/duplicates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phone = req.query.phone as string;
    if (!phone) return res.json(null);
    res.json(await svc.checkDuplicate(phone));
  } catch (e) { next(e); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.getLead(req.params.id)); } catch (e) { next(e); }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.createLead(req.body, req.user!.userId);
    res.status(result.isDuplicate ? 200 : 201).json(result);
  } catch (e) { next(e); }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.updateLead(req.params.id, req.body, req.user!.userId)); } catch (e) { next(e); }
});

router.patch('/:id/stage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lead, toStage } = await svc.moveLead(req.params.id, req.body.stageId, req.user!.userId);
    // Fire stage automation
    const { fireStageAutomation } = await import('../whatsapp/whatsapp.service');
    await fireStageAutomation(lead.id, req.body.stageId).catch(() => {});
    res.json({ lead, toStage });
  } catch (e) { next(e); }
});

router.patch('/:id/source', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.changeSource(req.params.id, req.body.source, req.body.sourceDetail, req.user!.userId)); } catch (e) { next(e); }
});

router.patch('/:id/assign', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.assignLead(req.params.id, req.body.ownerId, req.user!.userId)); } catch (e) { next(e); }
});

router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.updateStatus(req.params.id, req.body.status, req.body.lostReason, req.user!.userId)); } catch (e) { next(e); }
});

router.post('/:id/notes', async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json(await svc.addNote(req.params.id, req.body.content, req.user!.userId)); } catch (e) { next(e); }
});

router.get('/:id/timeline', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.getTimeline(req.params.id)); } catch (e) { next(e); }
});

router.delete('/:id', requireRole('OWNER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query } = await import('../../lib/db');
    await query('UPDATE "Lead" SET "deletedAt" = $1, "updatedAt" = $2 WHERE id = $3', [new Date(), new Date(), req.params.id]);
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
