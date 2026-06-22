import express, { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth';
import * as svc from './whatsapp.service';
import { queryMany, queryOne } from '../../lib/db';

const router = express.Router();
router.use(requireAuth);

// Get conversation history for a lead
router.get('/conversations/:leadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const messages = await queryMany(
      `SELECT * FROM "Message" WHERE "leadId" = $1 ORDER BY "createdAt" DESC LIMIT 100`,
      [req.params.leadId]
    );
    res.json(messages);
  } catch (e) {
    next(e);
  }
});

// Send manual message to a lead
router.post('/send/:leadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { body, templateId } = req.body;

    if (!body && !templateId) {
      return res.status(400).json({ error: 'Provide body or templateId' });
    }

    const messagePayload = templateId
      ? { type: 'text', text: { body: `[Template: ${templateId}]` } }
      : { type: 'text', text: { body } };

    const success = await svc.sendWhatsAppMessage(req.params.leadId, messagePayload, 'manual');

    res.status(success ? 201 : 400).json({ success });
  } catch (e) {
    next(e);
  }
});

// Get WhatsApp integration status
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = {
      provider: process.env.WHATSAPP_PROVIDER || 'mock',
      configured: !!(process.env.META_WABA_PHONE_NUMBER_ID && process.env.META_WABA_TOKEN),
      leadFormMode: process.env.LEAD_FORM_MODE || 'link',
      hasFlowId: !!process.env.WHATSAPP_FLOW_ID,
    };

    const messageCount = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM "Message" WHERE channel = $1',
      ['WHATSAPP']
    );

    const leadCount = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM "Lead" WHERE source = $1',
      ['WHATSAPP_INBOUND']
    );

    res.json({
      ...config,
      stats: {
        totalMessages: parseInt(messageCount?.count || '0', 10),
        totalLeads: parseInt(leadCount?.count || '0', 10),
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
