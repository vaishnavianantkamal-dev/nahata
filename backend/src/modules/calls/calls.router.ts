import express from 'express';
import { requireAuth } from '../../middleware/auth';
import * as callsService from './calls.service';

const router = express.Router();

router.post('/calls/click-to-call/:leadId', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const call = await callsService.clickToCall(req.params.leadId, userId);
    res.json(call);
  } catch (err) {
    next(err);
  }
});

router.get('/calls', requireAuth, async (req, res, next) => {
  try {
    const calls = await callsService.getCalls(req.query as any);
    res.json(calls);
  } catch (err) {
    next(err);
  }
});

router.get('/calls/:id', requireAuth, async (req, res, next) => {
  try {
    const call = await callsService.getCall(req.params.id);
    res.json(call);
  } catch (err) {
    next(err);
  }
});

export default router;
