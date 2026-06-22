import { Router, Request, Response, NextFunction } from 'express';
import * as svc from './quotations.service';
import { requireAuth, requireRole } from '../../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/quotations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as any;
    res.json(await svc.getQuotations({
      page: q.page ? parseInt(q.page) : 1,
      pageSize: q.pageSize ? parseInt(q.pageSize) : 20,
    }));
  } catch (e) { next(e); }
});

router.get('/quotations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.getQuotation(req.params.id)); } catch (e) { next(e); }
});

router.post('/quotations', async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json(await svc.createQuotation(req.body, req.user!.userId)); } catch (e) { next(e); }
});

router.patch('/quotations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.updateQuotation(req.params.id, req.body, req.user!.userId)); } catch (e) { next(e); }
});

router.delete('/quotations/:id', requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.deleteQuotation(req.params.id)); } catch (e) { next(e); }
});

// Generate + stream the PDF
router.post('/quotations/:id/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { buffer, quoteNumber } = await svc.renderPdf(req.params.id, req.body || {});
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${quoteNumber}.pdf"`);
    res.send(buffer);
  } catch (e) { next(e); }
});

// Send the quotation summary to the client over WhatsApp
router.post('/quotations/:id/send-whatsapp', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.sendWhatsApp(req.params.id, req.body || {})); } catch (e) { next(e); }
});

export default router;
