import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { db } from '../../lib/db';
import { stringify } from 'csv-stringify';
import * as ExcelJS from 'exceljs';
import { formatSource } from './helpers';

const router = Router();
router.use(requireAuth);

async function getLeadsData(query: any) {
  const where: any = { deletedAt: null };
  if (query.from) where.createdAt = { gte: new Date(query.from) };
  if (query.to) where.createdAt = { ...where.createdAt, lte: new Date(query.to) };
  if (query.stageId) where.stageId = query.stageId;
  if (query.source) where.source = query.source;

  return db.lead.findMany({
    where,
    include: { stage: { select: { name: true } }, owner: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10000,
  });
}

router.get('/leads.csv', requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leads = await getLeadsData(req.query);
    const rows = leads.map(l => ({
      Name: l.name,
      Phone: l.primaryPhone,
      Email: l.email || '',
      Source: formatSource(l.source),
      'Event Type': l.eventType,
      'Guest Count': l.guestCount || '',
      'Event Date': l.eventDate ? l.eventDate.toLocaleDateString('en-IN') : '',
      Stage: l.stage.name,
      Status: l.status,
      Owner: l.owner?.name || '',
      Score: l.score ?? '',
      Band: l.scoreBand,
      'Created At': l.createdAt.toLocaleDateString('en-IN'),
    }));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    stringify(rows, { header: true }).pipe(res);
  } catch (e) { next(e); }
});

router.get('/leads.xlsx', requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leads = await getLeadsData(req.query);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Leads');
    ws.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Source', key: 'source', width: 15 },
      { header: 'Event', key: 'event', width: 15 },
      { header: 'Guests', key: 'guests', width: 10 },
      { header: 'Stage', key: 'stage', width: 18 },
      { header: 'Score', key: 'score', width: 10 },
      { header: 'Band', key: 'band', width: 12 },
      { header: 'Owner', key: 'owner', width: 18 },
      { header: 'Created', key: 'created', width: 14 },
    ];
    leads.forEach(l => ws.addRow({
      name: l.name, phone: l.primaryPhone, source: formatSource(l.source),
      event: l.eventType, guests: l.guestCount, stage: l.stage.name,
      score: l.score, band: l.scoreBand, owner: l.owner?.name || '',
      created: l.createdAt.toLocaleDateString('en-IN'),
    }));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { next(e); }
});

router.get('/source-performance.csv', requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { getLeadsBySource, getBestSource } = await import('../analytics/analytics.service');
    const data = await getBestSource();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="source-performance.csv"');
    stringify(data.map(d => ({
      Source: d.label,
      'Total Leads': d.total,
      Bookings: d.bookings,
      'Win Rate %': d.winRate,
    })), { header: true }).pipe(res);
  } catch (e) { next(e); }
});

router.get('/calls.csv', requireRole('OWNER', 'MANAGER'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const calls = await db.call.findMany({
      include: { lead: { select: { name: true } }, agent: { select: { name: true } }, summary: true },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="calls.csv"');
    stringify(calls.map(c => ({
      Lead: c.lead?.name || '',
      Agent: c.agent?.name || '',
      Direction: c.direction,
      Status: c.status,
      'Duration (s)': c.durationSec || '',
      Score: c.summary ? '' : '',
      'Next Action': c.summary?.nextAction || '',
      'Created At': c.createdAt.toLocaleDateString('en-IN'),
    })), { header: true }).pipe(res);
  } catch (e) { next(e); }
});

export default router;
