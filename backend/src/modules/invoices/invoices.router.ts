import { Router, Request, Response, NextFunction } from 'express';
import * as svc from './invoices.service';
import { requireAuth, requireRole } from '../../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as any;
    res.json(await svc.listInvoices({ status: q.status, from: q.from, to: q.to }));
  } catch (e) { next(e); }
});

router.get('/invoices/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.getInvoice(req.params.id)); } catch (e) { next(e); }
});

router.post('/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json(await svc.createInvoice(req.body, req.user!.userId)); } catch (e) { next(e); }
});

router.patch('/invoices/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.updateInvoice(req.params.id, req.body)); } catch (e) { next(e); }
});

router.post('/invoices/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.cancelInvoice(req.params.id)); } catch (e) { next(e); }
});

router.delete('/invoices/:id', requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.deleteInvoice(req.params.id)); } catch (e) { next(e); }
});

router.post('/invoices/:id/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { buffer, invoiceNumber } = await svc.renderPdf(req.params.id, req.body || {});
    const safeName = invoiceNumber.replace(/[\/\\]/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
    res.send(buffer);
  } catch (e) { next(e); }
});

router.post('/invoices/:id/send-whatsapp', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.sendWhatsApp(req.params.id)); } catch (e) { next(e); }
});

export default router;
