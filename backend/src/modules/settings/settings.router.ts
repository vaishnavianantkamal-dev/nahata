import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../lib/db';
import { requireAuth, requireRole } from '../../middleware/auth';

const router = Router();

router.get('/settings', requireAuth, async (_req, res, next) => {
  try {
    const settings = await db.setting.findMany({ orderBy: { key: 'asc' } });
    const obj: Record<string, any> = {};
    for (const s of settings) obj[s.key] = s.value;
    res.json(obj);
  } catch (e) { next(e); }
});

router.put('/settings/:key', requireAuth, requireRole('OWNER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const setting = await db.setting.upsert({
      where: { key: req.params.key },
      update: { value: req.body.value, updatedById: req.user!.userId },
      create: { key: req.params.key, value: req.body.value, updatedById: req.user!.userId },
    });
    res.json(setting);
  } catch (e) { next(e); }
});

router.get('/source-integrations', requireAuth, requireRole('OWNER', 'MANAGER'), async (_req, res, next) => {
  try {
    res.json(await db.sourceIntegration.findMany({ orderBy: { source: 'asc' } }));
  } catch (e) { next(e); }
});

router.put('/source-integrations/:source', requireAuth, requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const si = await db.sourceIntegration.upsert({
      where: { source: req.params.source as any },
      update: req.body,
      create: { source: req.params.source as any, displayName: req.params.source, ...req.body },
    });
    res.json(si);
  } catch (e) { next(e); }
});

export default router;
