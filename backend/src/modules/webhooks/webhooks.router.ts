import { Router, Request, Response, NextFunction } from 'express';
import { createLead, checkDuplicate } from '../leads/leads.service';
import { fireLeadCreatedAutomation } from '../whatsapp/whatsapp.service';
import { normalizeIndianPhone } from '../../lib/helpers';
import { logger } from '../../lib/logger';
import { db } from '../../lib/db';

const router = Router();

// Generic intake pipeline: normalise → dedupe → create → fire automation
async function intake(source: string, rawData: {
  name?: string; phone?: string; email?: string; eventType?: string;
  guestCount?: number; eventDate?: string; sourceDetail?: string; externalRef?: string;
}, res: Response) {
  try {
    const phone = normalizeIndianPhone(rawData.phone || '');
    if (!phone) {
      logger.warn({ source, rawData }, 'Webhook: invalid phone number');
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    // Dedupe check
    const existing = await checkDuplicate(phone);
    if (existing) {
      logger.info({ source, phone, existingLeadId: existing.id }, 'Webhook: duplicate lead detected');
      await db.activity.create({
        data: {
          leadId: existing.id,
          type: 'FIELD_UPDATED',
          title: `Repeat enquiry from ${source}`,
          description: `Duplicate enquiry received from ${source}`,
          meta: { source, rawData: rawData as any },
        },
      });
      return res.json({ status: 'duplicate', leadId: existing.id });
    }

    const { lead } = await createLead({
      name: rawData.name || `Enquiry from ${source}`,
      primaryPhone: phone,
      email: rawData.email,
      source,
      sourceDetail: rawData.sourceDetail,
      eventType: rawData.eventType || 'OTHER',
      guestCount: rawData.guestCount,
      eventDate: rawData.eventDate,
      externalRef: rawData.externalRef,
    });

    // Fire automation asynchronously (don't block webhook response)
    fireLeadCreatedAutomation(lead.id).catch(err =>
      logger.error({ err, leadId: lead.id }, 'Lead automation failed after webhook intake'),
    );

    logger.info({ source, leadId: lead.id, phone }, 'Webhook: new lead created');
    res.status(201).json({ status: 'created', leadId: lead.id });
  } catch (err) {
    logger.error({ err, source, rawData }, 'Webhook intake failed');
    res.status(500).json({ error: 'Intake failed' });
  }
}

// WedMeGood
router.post('/leads/wedmegood', async (req: Request, res: Response, next: NextFunction) => {
  const b = req.body;
  await intake('WEDMEGOOD', {
    name: b.bridgeName || b.groomName ? `${b.bridgeName || ''} & ${b.groomName || ''}`.trim() : b.name,
    phone: b.mobile || b.phone,
    email: b.email,
    eventType: mapEventType(b.functionType || b.event_type),
    guestCount: parseInt(b.guests || b.no_of_guests || '0') || undefined,
    eventDate: b.eventDate || b.event_date,
    sourceDetail: b.listing || b.source_listing,
    externalRef: b.enquiryId || b.id,
  }, res);
});

// JustDial
router.post('/leads/justdial', async (req: Request, res: Response, next: NextFunction) => {
  const b = req.body;
  await intake('JUSTDIAL', {
    name: b.name || b.sender_name,
    phone: b.mobile || b.phone || b.sender_mobile,
    email: b.email,
    eventType: 'WEDDING',
    sourceDetail: b.category || b.brancharea,
    externalRef: b.uniqueid || b.id,
  }, res);
});

// Google Maps
router.post('/leads/google_maps', async (req: Request, res: Response, next: NextFunction) => {
  const b = req.body;
  await intake('GOOGLE_MAPS', {
    name: b.name || b.displayName,
    phone: b.phone || b.formattedPhoneNumber,
    email: b.email,
    eventType: 'WEDDING',
    sourceDetail: b.message,
    externalRef: b.conversationId || b.id,
  }, res);
});

// Website form
router.post('/leads/website', async (req: Request, res: Response, next: NextFunction) => {
  const b = req.body;
  await intake('WEBSITE', {
    name: b.name || b.brideName ? `${b.brideName || ''} & ${b.groomName || ''}`.trim() : b.name,
    phone: b.phone || b.mobile,
    email: b.email,
    eventType: mapEventType(b.eventType || b.function_type),
    guestCount: parseInt(b.guestCount || b.guests || '0') || undefined,
    eventDate: b.eventDate,
    sourceDetail: b.message || b.notes,
  }, res);
});

function mapEventType(raw?: string): string {
  if (!raw) return 'WEDDING';
  const r = raw.toLowerCase();
  if (r.includes('reception')) return 'RECEPTION';
  if (r.includes('engagement')) return 'ENGAGEMENT';
  if (r.includes('sangeet')) return 'SANGEET';
  if (r.includes('birthday')) return 'BIRTHDAY';
  if (r.includes('corporate')) return 'CORPORATE';
  return 'WEDDING';
}

export default router;
