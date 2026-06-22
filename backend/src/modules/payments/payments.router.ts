import { Router, Request, Response, NextFunction } from 'express';
import * as svc from './payments.service';
import { requireAuth, requireRole } from '../../middleware/auth';

const router = Router();
router.use(requireAuth);

// Revenue overview (billable quotations + summary)
router.get('/payments/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as any;
    res.json(await svc.getOverview({ from: q.from, to: q.to }));
  } catch (e) { next(e); }
});

// Ledger for one quotation
router.get('/payments/quotation/:quotationId', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.getLedger(req.params.quotationId)); } catch (e) { next(e); }
});

// Send a balance-due reminder over WhatsApp
router.post('/payments/quotation/:quotationId/reminder', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.sendReminder(req.params.quotationId)); } catch (e) { next(e); }
});

router.get('/payments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as any;
    res.json(await svc.listPayments({ quotationId: q.quotationId, invoiceId: q.invoiceId, leadId: q.leadId, method: q.method, from: q.from, to: q.to }));
  } catch (e) { next(e); }
});

router.post('/payments', async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json(await svc.createPayment(req.body, req.user!.userId)); } catch (e) { next(e); }
});

router.patch('/payments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.updatePayment(req.params.id, req.body)); } catch (e) { next(e); }
});

router.delete('/payments/:id', requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.deletePayment(req.params.id)); } catch (e) { next(e); }
});

export default router;
