import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../lib/db';
import { requireAuth, requireRole } from '../../middleware/auth';
import { AppError } from '../../middleware/error';

const router = Router();

// Template Groups
router.get('/template-groups', requireAuth, async (_req, res, next) => {
  try {
    const groups = await db.templateGroup.findMany({
      where: { deletedAt: null },
      orderBy: { order: 'asc' },
      include: { _count: { select: { templates: { where: { deletedAt: null, isActive: true } } } } },
    });
    res.json(groups);
  } catch (e) { next(e); }
});

router.post('/template-groups', requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const maxOrder = await db.templateGroup.aggregate({ _max: { order: true } });
    const group = await db.templateGroup.create({
      data: { ...req.body, order: (maxOrder._max.order ?? 0) + 1 },
    });
    res.status(201).json(group);
  } catch (e) { next(e); }
});

router.patch('/template-groups/:id', requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await db.templateGroup.update({ where: { id: req.params.id }, data: req.body }));
  } catch (e) { next(e); }
});

router.delete('/template-groups/:id', requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db.templateGroup.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.get('/template-groups/:id/templates', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await db.template.findMany({
      where: { groupId: req.params.id, deletedAt: null },
      orderBy: { order: 'asc' },
    }));
  } catch (e) { next(e); }
});

// Templates
router.get('/templates', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await db.template.findMany({
      where: { deletedAt: null, isActive: true },
      include: { group: { select: { id: true, name: true } } },
      orderBy: { order: 'asc' },
    }));
  } catch (e) { next(e); }
});

router.post('/templates', requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const maxOrder = await db.template.aggregate({
      _max: { order: true },
      where: { groupId: req.body.groupId },
    });
    const tpl = await db.template.create({
      data: { ...req.body, order: (maxOrder._max.order ?? 0) + 1 },
    });
    res.status(201).json(tpl);
  } catch (e) { next(e); }
});

router.patch('/templates/:id', requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await db.template.update({ where: { id: req.params.id }, data: req.body }));
  } catch (e) { next(e); }
});

router.delete('/templates/:id', requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db.template.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.post('/templates/:id/preview', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tpl = await db.template.findUnique({ where: { id: req.params.id } });
    if (!tpl) throw new AppError(404, 'NOT_FOUND', 'Template not found');

    let rendered = tpl.body;
    if (req.body.leadId) {
      const lead = await db.lead.findUnique({ where: { id: req.body.leadId }, include: { owner: { select: { name: true } } } });
      if (lead) {
        rendered = rendered
          .replace(/\{Name\}/g, lead.name)
          .replace(/\{Date\}/g, lead.eventDate ? new Date(lead.eventDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'your event date')
          .replace(/\{GuestCount\}/g, lead.guestCount ? String(lead.guestCount) : 'your guests')
          .replace(/\{EventType\}/g, lead.eventType ? lead.eventType.charAt(0) + lead.eventType.slice(1).toLowerCase() : 'event')
          .replace(/\{VenueName\}/g, 'Nahata Lawns')
          .replace(/\{OwnerName\}/g, lead.owner?.name || 'our team');
      }
    } else {
      rendered = rendered
        .replace(/\{Name\}/g, 'Priya & Aakash').replace(/\{Date\}/g, '12 Dec 2024')
        .replace(/\{GuestCount\}/g, '450').replace(/\{EventType\}/g, 'Wedding')
        .replace(/\{VenueName\}/g, 'Nahata Lawns').replace(/\{OwnerName\}/g, 'S. Iyer');
    }

    res.json({ rendered, original: tpl.body });
  } catch (e) { next(e); }
});

export default router;
