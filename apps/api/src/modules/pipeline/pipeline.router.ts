import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getPipelineBoard, moveLead } from '../leads/leads.service';
import { fireStageAutomation } from '../whatsapp/whatsapp.service';

const router = Router();
router.use(requireAuth);

router.get('/board', async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json(await getPipelineBoard()); } catch (e) { next(e); }
});

router.patch('/move', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadId, toStageId } = req.body;
    const result = await moveLead(leadId, toStageId, req.user!.userId);
    await fireStageAutomation(leadId, toStageId).catch(() => {});
    res.json(result);
  } catch (e) { next(e); }
});

export default router;
