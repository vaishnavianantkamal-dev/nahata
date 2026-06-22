import express, { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth';
import * as svc from './reports.service';

const router = express.Router();
router.use(requireAuth);

// GET /reports/<report>.csv?from=&to=
router.get('/:report.csv', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as any;
    const report = await svc.buildReport(req.params.report, { from: q.from, to: q.to });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.report}.csv"`);
    res.send(svc.toCsv(report));
  } catch (e) { next(e); }
});

// GET /reports/<report>.xlsx?from=&to=
router.get('/:report.xlsx', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as any;
    const report = await svc.buildReport(req.params.report, { from: q.from, to: q.to });
    const buf = await svc.toXlsx(report);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.report}.xlsx"`);
    res.send(buf);
  } catch (e) { next(e); }
});

export default router;
