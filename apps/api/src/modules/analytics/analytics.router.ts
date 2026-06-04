import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth';
import * as svc from './analytics.service';

const router = Router();
router.use(requireAuth);

router.get('/kpis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { range, from, to } = req.query as any;
    res.json(await svc.getKpis(range, from, to));
  } catch (e) { next(e); }
});

router.get('/enquiries-by-week', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { range, from, to } = req.query as any;
    res.json(await svc.getEnquiriesByWeek(range, from, to));
  } catch (e) { next(e); }
});

router.get('/leads-by-source', async (_req, res, next) => {
  try { res.json(await svc.getLeadsBySource()); } catch (e) { next(e); }
});

router.get('/conversion-funnel', async (_req, res, next) => {
  try { res.json(await svc.getConversionFunnel()); } catch (e) { next(e); }
});

router.get('/response-time', async (_req, res, next) => {
  try { res.json(await svc.getResponseTime()); } catch (e) { next(e); }
});

router.get('/best-source', async (_req, res, next) => {
  try { res.json(await svc.getBestSource()); } catch (e) { next(e); }
});

export default router;
