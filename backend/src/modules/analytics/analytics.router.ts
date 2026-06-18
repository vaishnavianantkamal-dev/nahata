import express from 'express';
import { requireAuth } from '../../middleware/auth';
import * as svc from './analytics.service';

const router = express.Router();
router.use(requireAuth);

router.get('/kpis', async (req, res, next) => {
  try {
    res.json(await svc.getKpis());
  } catch (err) { next(err); }
});

router.get('/enquiries-by-week', async (req, res, next) => {
  try {
    res.json(await svc.getEnquiriesByWeek());
  } catch (err) { next(err); }
});

router.get('/leads-by-source', async (req, res, next) => {
  try {
    res.json(await svc.getLeadsBySource());
  } catch (err) { next(err); }
});

router.get('/conversion-funnel', async (req, res, next) => {
  try {
    res.json(await svc.getConversionFunnel());
  } catch (err) { next(err); }
});

router.get('/response-time', async (req, res, next) => {
  try {
    res.json(await svc.getResponseTime());
  } catch (err) { next(err); }
});

router.get('/best-source', async (req, res, next) => {
  try {
    res.json(await svc.getBestSource());
  } catch (err) { next(err); }
});

export default router;
