import { Router, Request, Response, NextFunction } from 'express';
import * as svc from './stages.service';
import { requireAuth, requireRole } from '../../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', async (_req, res, next) => {
  try { res.json(await svc.getStages()); } catch (e) { next(e); }
});

router.post('/', requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json(await svc.createStage(req.body)); } catch (e) { next(e); }
});

router.patch('/reorder', requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try { await svc.reorderStages(req.body.orderedIds); res.json({ success: true }); } catch (e) { next(e); }
});

router.patch('/:id', requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.updateStage(req.params.id, req.body)); } catch (e) { next(e); }
});

router.delete('/:id', requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try { await svc.deleteStage(req.params.id); res.json({ success: true }); } catch (e) { next(e); }
});

router.get('/:id/binding', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.getStageBinding(req.params.id)); } catch (e) { next(e); }
});

router.put('/:id/binding', requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.setStageBinding(req.params.id, req.body.templateId, req.body.enabled)); } catch (e) { next(e); }
});

export default router;
