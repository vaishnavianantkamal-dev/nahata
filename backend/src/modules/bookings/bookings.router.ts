import { Router, Request, Response, NextFunction } from 'express';
import * as svc from './bookings.service';
import { requireAuth, requireRole } from '../../middleware/auth';

const router = Router();
router.use(requireAuth);

// Month calendar feed: { bookings, enquiries } — ?month=YYYY-MM (defaults to current month)
router.get('/bookings/calendar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    res.json(await svc.getCalendar(month));
  } catch (e) { next(e); }
});

// Availability check: ?date=YYYY-MM-DD&venue=&excludeId=
router.get('/bookings/availability', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, venue, excludeId } = req.query as any;
    res.json(await svc.checkAvailability(date, venue || undefined, excludeId || undefined));
  } catch (e) { next(e); }
});

router.get('/bookings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as any;
    res.json(await svc.getBookings({
      from: q.from, to: q.to, venue: q.venue, status: q.status, leadId: q.leadId,
    }));
  } catch (e) { next(e); }
});

router.get('/bookings/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.getBooking(req.params.id)); } catch (e) { next(e); }
});

router.post('/bookings', async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json(await svc.createBooking(req.body, req.user!.userId)); } catch (e) { next(e); }
});

router.patch('/bookings/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.updateBooking(req.params.id, req.body, req.user!.userId)); } catch (e) { next(e); }
});

router.patch('/bookings/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.updateStatus(req.params.id, req.body.status)); } catch (e) { next(e); }
});

router.delete('/bookings/:id', requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await svc.deleteBooking(req.params.id)); } catch (e) { next(e); }
});

export default router;
