import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../lib/db';
import { requireAuth, requireRole } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { generateQuotationPdf } from './quotation-pdf';
import { getWhatsAppProvider } from '../../integrations/whatsapp';
import { logger } from '../../lib/logger';
import * as path from 'path';
import * as fs from 'fs';

const router = Router();
router.use(requireAuth);

/* ── helper: next quote number ──────────────────────────────────────────── */
async function nextQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.quotation.count({ where: { quoteNumber: { startsWith: `QT-${year}-` } } });
  return `QT-${year}-${String(count + 1).padStart(4, '0')}`;
}

/* ── recalculate totals ──────────────────────────────────────────────────── */
function calcTotals(items: any[], addl: any[], discountPct: number, discountAmt: number, gstPct: number) {
  const itemsTotal = items.reduce((s, i) => s + (i.amount || 0), 0);
  const addlTotal  = addl.reduce((s, i) => s + (i.amount || 0), 0);
  const subtotal   = itemsTotal + addlTotal;
  const discount   = discountAmt > 0 ? discountAmt : (subtotal * (discountPct || 0)) / 100;
  const afterDisc  = subtotal - discount;
  const gst        = (afterDisc * (gstPct || 0)) / 100;
  const grandTotal = afterDisc + gst;
  return { subtotal, grandTotal };
}

/* ── LIST ─────────────────────────────────────────────────────────────────── */
router.get('/quotations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadId, status, page = '1', pageSize = '20' } = req.query as any;
    const where: any = {};
    if (leadId) where.leadId = leadId;
    if (status)  where.status = status;

    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const [data, total] = await Promise.all([
      db.quotation.findMany({
        where,
        include: {
          lead:      { select: { id: true, name: true, primaryPhone: true } },
          createdBy: { select: { id: true, name: true } },
          _count:    { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip, take: parseInt(pageSize),
      }),
      db.quotation.count({ where }),
    ]);
    res.json({ data, page: parseInt(page), pageSize: parseInt(pageSize), total });
  } catch (e) { next(e); }
});

/* ── GET ONE ──────────────────────────────────────────────────────────────── */
router.get('/quotations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = await db.quotation.findUnique({
      where: { id: req.params.id },
      include: {
        items:     { orderBy: { order: 'asc' } },
        addlWork:  { orderBy: { order: 'asc' } },
        lead:      { select: { id: true, name: true, primaryPhone: true, eventType: true, eventDate: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!q) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');
    res.json(q);
  } catch (e) { next(e); }
});

/* ── CREATE ───────────────────────────────────────────────────────────────── */
router.post('/quotations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      leadId, clientName, clientPhone, projectDetails, quoteDate,
      validityDays, advancePct, discountPct, discountAmt, gstPct, estCost,
      notes, termsText, items = [], addlWork = [],
    } = req.body;

    const { subtotal, grandTotal } = calcTotals(items, addlWork, discountPct || 0, discountAmt || 0, gstPct || 0);
    const quoteNumber = await nextQuoteNumber();

    const q = await db.quotation.create({
      data: {
        quoteNumber,
        leadId:        leadId || undefined,
        clientName,
        clientPhone:   clientPhone || undefined,
        projectDetails:projectDetails || undefined,
        quoteDate:     quoteDate ? new Date(quoteDate) : new Date(),
        validityDays:  validityDays || 15,
        advancePct:    advancePct  || 50,
        discountPct:   discountPct || 0,
        discountAmt:   discountAmt || 0,
        gstPct:        gstPct     || 0,
        subtotal, grandTotal,
        estCost:       estCost    || 0,
        notes,
        termsText,
        createdById: req.user!.userId,
        items:   { create: items.map((it: any, i: number)   => ({ ...it, order: i + 1, amount: it.amount || 0 })) },
        addlWork:{ create: addlWork.map((it: any, i: number) => ({ ...it, order: i + 1, amount: it.amount || 0 })) },
      },
      include: { items: { orderBy: { order: 'asc' } }, addlWork: { orderBy: { order: 'asc' } } },
    });
    res.status(201).json(q);
  } catch (e) { next(e); }
});

/* ── UPDATE ───────────────────────────────────────────────────────────────── */
router.patch('/quotations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      clientName, clientPhone, projectDetails, quoteDate,
      validityDays, advancePct, discountPct, discountAmt, gstPct, estCost,
      notes, termsText, status, items, addlWork,
    } = req.body;

    const existing = await db.quotation.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');

    const updateData: any = {};
    if (clientName    !== undefined) updateData.clientName    = clientName;
    if (clientPhone   !== undefined) updateData.clientPhone   = clientPhone;
    if (projectDetails!== undefined) updateData.projectDetails= projectDetails;
    if (quoteDate     !== undefined) updateData.quoteDate     = new Date(quoteDate);
    if (validityDays  !== undefined) updateData.validityDays  = validityDays;
    if (advancePct    !== undefined) updateData.advancePct    = advancePct;
    if (discountPct   !== undefined) updateData.discountPct   = discountPct;
    if (discountAmt   !== undefined) updateData.discountAmt   = discountAmt;
    if (gstPct        !== undefined) updateData.gstPct        = gstPct;
    if (estCost       !== undefined) updateData.estCost       = estCost;
    if (notes         !== undefined) updateData.notes         = notes;
    if (termsText     !== undefined) updateData.termsText     = termsText;
    if (status        !== undefined) updateData.status        = status;

    // Re-create items if provided
    if (items) {
      await db.quotationItem.deleteMany({ where: { quotationId: req.params.id } });
      await db.quotationItem.createMany({
        data: items.map((it: any, i: number) => ({ ...it, quotationId: req.params.id, order: i + 1 })),
      });
    }
    if (addlWork) {
      await db.quotationAddlWork.deleteMany({ where: { quotationId: req.params.id } });
      await db.quotationAddlWork.createMany({
        data: addlWork.map((it: any, i: number) => ({ ...it, quotationId: req.params.id, order: i + 1 })),
      });
    }

    // Recalculate totals
    const allItems   = items   || (await db.quotationItem.findMany({ where: { quotationId: req.params.id } }));
    const allAddl    = addlWork|| (await db.quotationAddlWork.findMany({ where: { quotationId: req.params.id } }));
    const { subtotal, grandTotal } = calcTotals(
      allItems, allAddl,
      updateData.discountPct ?? existing.discountPct,
      updateData.discountAmt ?? existing.discountAmt,
      updateData.gstPct      ?? existing.gstPct,
    );
    updateData.subtotal   = subtotal;
    updateData.grandTotal = grandTotal;

    const q = await db.quotation.update({
      where: { id: req.params.id },
      data:  updateData,
      include: { items: { orderBy: { order: 'asc' } }, addlWork: { orderBy: { order: 'asc' } } },
    });
    res.json(q);
  } catch (e) { next(e); }
});

/* ── DELETE ───────────────────────────────────────────────────────────────── */
router.delete('/quotations/:id', requireRole('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db.quotation.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { next(e); }
});

/* ── GENERATE PDF ─────────────────────────────────────────────────────────── */
router.post('/quotations/:id/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = await db.quotation.findUnique({
      where: { id: req.params.id },
      include: {
        items:   { orderBy: { order: 'asc' } },
        addlWork:{ orderBy: { order: 'asc' } },
      },
    });
    if (!q) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');

    const { theme = 'stylish', color = '#1F5C45' } = req.body;

    // Get venue name from settings
    const venueNameSetting = await db.setting.findUnique({ where: { key: 'venueName' } });
    const venueName = (venueNameSetting?.value as string) || 'Nahata Lawns';

    const pdfBuffer = await generateQuotationPdf(q as any, { theme, color, venueName });

    // Save PDF to disk
    const pdfDir = path.join(process.cwd(), 'uploads', 'quotations');
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    const fileName = `${q.quoteNumber}.pdf`;
    const filePath = path.join(pdfDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    // Update record
    await db.quotation.update({ where: { id: req.params.id }, data: { pdfPath: fileName } });

    // Return PDF as download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (e) { next(e); }
});

/* ── SEND VIA WHATSAPP ────────────────────────────────────────────────────── */
router.post('/quotations/:id/send-whatsapp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = await db.quotation.findUnique({
      where: { id: req.params.id },
      include: { items: true, addlWork: true },
    });
    if (!q) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');

    const toPhone = q.clientPhone || req.body.phone;
    if (!toPhone) throw new AppError(400, 'NO_PHONE', 'No phone number — add client phone first');

    const { theme = 'stylish', color = '#1F5C45' } = req.body;
    const venueNameSetting = await db.setting.findUnique({ where: { key: 'venueName' } });
    const venueName = (venueNameSetting?.value as string) || 'Nahata Lawns';

    const pdfBuffer = await generateQuotationPdf(q as any, { theme, color, venueName });

    const wa = getWhatsAppProvider();
    // Send WhatsApp message with PDF info (real Meta API supports document messages)
    const body = `Dear ${q.clientName} 🙏\n\nPlease find attached your quotation *${q.quoteNumber}* from *${venueName}*.\n\n*Grand Total: ₹${q.grandTotal.toLocaleString('en-IN')}*\n\nValid for ${q.validityDays} days. Please feel free to reach out for any queries.`;
    await wa.sendText(toPhone.startsWith('+') ? toPhone : `+91${toPhone}`, body);

    logger.info({ quoteNumber: q.quoteNumber, toPhone }, 'Quotation WhatsApp sent');

    // Log activity if lead exists
    if (q.leadId) {
      await db.activity.create({
        data: {
          leadId: q.leadId,
          userId: req.user!.userId,
          type: 'WHATSAPP_SENT',
          title: `Quotation ${q.quoteNumber} sent via WhatsApp`,
          description: `Grand Total: ₹${q.grandTotal.toLocaleString('en-IN')}`,
        },
      });
    }

    await db.quotation.update({ where: { id: req.params.id }, data: { status: 'SENT' } });

    res.json({ success: true, message: `Quotation sent to ${toPhone}` });
  } catch (e) { next(e); }
});

export default router;
