import { query, queryOne, queryMany, transaction } from '../../lib/db';
import { AppError } from '../../middleware/error';
import { emitToAll } from '../../lib/socket';
import { generateQuotationPdf, type QuotationData } from './quotation-pdf';

const { v4: uuidv4 } = require('uuid');

// ── Totals are always recomputed server-side from the line items (authoritative) ──
function computeTotals(items: any[], addlWork: any[], data: any) {
  const itemsTotal = items.reduce((s, it) => s + (Number(it.areaQty) || 0) * (Number(it.rate) || 0), 0);
  const addlTotal  = addlWork.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
  const subtotal   = +(itemsTotal + addlTotal).toFixed(2);
  const discountPct = Number(data.discountPct) || 0;
  const discountAmt = Number(data.discountAmt) || 0;
  const discount   = discountAmt > 0 ? discountAmt : +(subtotal * discountPct / 100).toFixed(2);
  const afterDisc  = subtotal - discount;
  const gstPct     = Number(data.gstPct) || 0;
  const gstAmt     = +(afterDisc * gstPct / 100).toFixed(2);
  const grandTotal = +(afterDisc + gstAmt).toFixed(2);
  return { subtotal, discountPct, discountAmt, gstPct, grandTotal, estCost: Number(data.estCost) || 0 };
}

// Map the frontend item shape ({ quantity }) to DB columns ({ areaQty }).
function normalizeItems(rawItems: any[]) {
  return (rawItems || [])
    .filter(it => (it?.description || '').trim() !== '' || Number(it?.rate) || Number(it?.quantity))
    .map((it, idx) => {
      const areaQty = Number(it.areaQty ?? it.quantity) || 0;
      const rate = Number(it.rate) || 0;
      return {
        order: idx,
        description: it.description || '',
        notes: it.notes || null,
        length: Number(it.length) || 0,
        width: Number(it.width) || 0,
        areaQty,
        unit: it.unit || 'Nos',
        rate,
        amount: +(areaQty * rate).toFixed(2),
      };
    });
}

function normalizeAddl(rawAddl: any[]) {
  return (rawAddl || [])
    .filter(it => (it?.item || '').trim() !== '' || Number(it?.rate) || Number(it?.qty))
    .map((it, idx) => {
      const qty = Number(it.qty) || 0;
      const rate = Number(it.rate) || 0;
      return { order: idx, item: it.item || '', qty, unit: it.unit || 'Nos', rate, amount: +(qty * rate).toFixed(2) };
    });
}

async function generateQuoteNumber(): Promise<string> {
  const now = new Date();
  const prefix = `NL-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM "Quotation" WHERE "quoteNumber" LIKE $1`,
    [`${prefix}-%`]
  );
  let seq = Number(row?.count || 0) + 1;
  // Guard against rare collisions
  for (let i = 0; i < 50; i++) {
    const candidate = `${prefix}-${String(seq).padStart(4, '0')}`;
    const exists = await queryOne('SELECT 1 FROM "Quotation" WHERE "quoteNumber" = $1', [candidate]);
    if (!exists) return candidate;
    seq++;
  }
  return `${prefix}-${Date.now().toString().slice(-5)}`;
}

async function fetchItems(quotationId: string) {
  const items = await queryMany<any>(
    `SELECT id, "order", description, notes, length, width, "areaQty", unit, rate, amount
     FROM "QuotationItem" WHERE "quotationId" = $1 ORDER BY "order" ASC`,
    [quotationId]
  );
  // Expose areaQty as `quantity` too, so the edit drawer hydrates correctly.
  return items.map(it => ({ ...it, quantity: it.areaQty }));
}

async function fetchAddl(quotationId: string) {
  return queryMany<any>(
    `SELECT id, "order", item, qty, unit, rate, amount
     FROM "QuotationAddlWork" WHERE "quotationId" = $1 ORDER BY "order" ASC`,
    [quotationId]
  );
}

export async function getQuotation(id: string) {
  const q = await queryOne<any>('SELECT * FROM "Quotation" WHERE id = $1', [id]);
  if (!q) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');
  const [items, addlWork] = await Promise.all([fetchItems(id), fetchAddl(id)]);
  return { ...q, items, addlWork };
}

export async function getQuotations(params: { page?: number; pageSize?: number }) {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const rows = await queryMany<any>(
    `SELECT * FROM "Quotation" ORDER BY "createdAt" DESC LIMIT $1 OFFSET $2`,
    [pageSize, offset]
  );
  const totalRow = await queryOne<{ count: string }>('SELECT COUNT(*) as count FROM "Quotation"');

  // Attach items/addlWork so the row can be edited directly from the list.
  const data = await Promise.all(rows.map(async q => {
    const [items, addlWork] = await Promise.all([fetchItems(q.id), fetchAddl(q.id)]);
    return { ...q, items, addlWork };
  }));

  return { data, total: Number(totalRow?.count || 0), page, pageSize };
}

export async function createQuotation(data: any, createdById?: string) {
  if (!data.clientName?.trim()) throw new AppError(400, 'BAD_REQUEST', 'Client name is required');

  const items = normalizeItems(data.items);
  const addlWork = normalizeAddl(data.addlWork);
  const totals = computeTotals(items, addlWork, data);
  const quoteNumber = await generateQuoteNumber();
  const id = uuidv4();
  const now = new Date();

  await transaction(async (client: any) => {
    await client.query(
      `INSERT INTO "Quotation" (id, "quoteNumber", "leadId", "clientName", "clientPhone", "projectDetails",
                                "quoteDate", "validityDays", "advancePct", subtotal, "discountPct", "discountAmt",
                                "gstPct", "grandTotal", "estCost", notes, "termsText", status, "createdById",
                                "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [
        id, quoteNumber, data.leadId || null, data.clientName.trim(), data.clientPhone || null,
        data.projectDetails || null, data.quoteDate ? new Date(data.quoteDate) : now,
        Number(data.validityDays) || 15, Number(data.advancePct) || 50,
        totals.subtotal, totals.discountPct, totals.discountAmt, totals.gstPct, totals.grandTotal, totals.estCost,
        data.notes || null, data.termsText || null, data.status || 'DRAFT', createdById || null, now, now,
      ]
    );
    for (const it of items) {
      await client.query(
        `INSERT INTO "QuotationItem" (id, "quotationId", "order", description, notes, length, width, "areaQty", unit, rate, amount, "createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [uuidv4(), id, it.order, it.description, it.notes, it.length, it.width, it.areaQty, it.unit, it.rate, it.amount, now]
      );
    }
    for (const aw of addlWork) {
      await client.query(
        `INSERT INTO "QuotationAddlWork" (id, "quotationId", "order", item, qty, unit, rate, amount, "createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [uuidv4(), id, aw.order, aw.item, aw.qty, aw.unit, aw.rate, aw.amount, now]
      );
    }
  });

  const quotation = await getQuotation(id);
  emitToAll('quotation:created', quotation);
  return quotation;
}

export async function updateQuotation(id: string, data: any, _userId?: string) {
  const existing = await queryOne<any>('SELECT * FROM "Quotation" WHERE id = $1', [id]);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');

  const replaceLines = data.items !== undefined || data.addlWork !== undefined;
  const now = new Date();

  await transaction(async (client: any) => {
    if (replaceLines) {
      const items = normalizeItems(data.items ?? (await fetchItems(id)));
      const addlWork = normalizeAddl(data.addlWork ?? (await fetchAddl(id)));
      const totals = computeTotals(items, addlWork, {
        discountPct: data.discountPct ?? existing.discountPct,
        discountAmt: data.discountAmt ?? existing.discountAmt,
        gstPct: data.gstPct ?? existing.gstPct,
        estCost: data.estCost ?? existing.estCost,
      });

      await client.query(
        `UPDATE "Quotation" SET
           "clientName" = $2, "clientPhone" = $3, "projectDetails" = $4, "quoteDate" = $5,
           "validityDays" = $6, "advancePct" = $7, subtotal = $8, "discountPct" = $9, "discountAmt" = $10,
           "gstPct" = $11, "grandTotal" = $12, "estCost" = $13, notes = $14, "termsText" = $15,
           "leadId" = $16, status = COALESCE($17, status), "updatedAt" = $18
         WHERE id = $1`,
        [
          id, data.clientName ?? existing.clientName, data.clientPhone ?? existing.clientPhone,
          data.projectDetails ?? existing.projectDetails,
          data.quoteDate ? new Date(data.quoteDate) : existing.quoteDate,
          data.validityDays ?? existing.validityDays, data.advancePct ?? existing.advancePct,
          totals.subtotal, totals.discountPct, totals.discountAmt, totals.gstPct, totals.grandTotal, totals.estCost,
          data.notes ?? existing.notes, data.termsText ?? existing.termsText,
          data.leadId ?? existing.leadId, data.status ?? null, now,
        ]
      );

      await client.query('DELETE FROM "QuotationItem" WHERE "quotationId" = $1', [id]);
      await client.query('DELETE FROM "QuotationAddlWork" WHERE "quotationId" = $1', [id]);
      for (const it of items) {
        await client.query(
          `INSERT INTO "QuotationItem" (id, "quotationId", "order", description, notes, length, width, "areaQty", unit, rate, amount, "createdAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [uuidv4(), id, it.order, it.description, it.notes, it.length, it.width, it.areaQty, it.unit, it.rate, it.amount, now]
        );
      }
      for (const aw of addlWork) {
        await client.query(
          `INSERT INTO "QuotationAddlWork" (id, "quotationId", "order", item, qty, unit, rate, amount, "createdAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [uuidv4(), id, aw.order, aw.item, aw.qty, aw.unit, aw.rate, aw.amount, now]
        );
      }
    } else {
      // Status-only / metadata-only update (e.g. mark ACCEPTED) — no line changes.
      await client.query(
        `UPDATE "Quotation" SET
           "clientName" = COALESCE($2, "clientName"), "clientPhone" = COALESCE($3, "clientPhone"),
           "projectDetails" = COALESCE($4, "projectDetails"), notes = COALESCE($5, notes),
           "termsText" = COALESCE($6, "termsText"), status = COALESCE($7, status), "updatedAt" = $8
         WHERE id = $1`,
        [id, data.clientName ?? null, data.clientPhone ?? null, data.projectDetails ?? null,
         data.notes ?? null, data.termsText ?? null, data.status ?? null, now]
      );
    }
  });

  const quotation = await getQuotation(id);
  emitToAll('quotation:updated', quotation);
  return quotation;
}

export async function deleteQuotation(id: string) {
  const existing = await queryOne<any>('SELECT id FROM "Quotation" WHERE id = $1', [id]);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');
  await transaction(async (client: any) => {
    await client.query('DELETE FROM "QuotationItem" WHERE "quotationId" = $1', [id]);
    await client.query('DELETE FROM "QuotationAddlWork" WHERE "quotationId" = $1', [id]);
    await client.query('DELETE FROM "Quotation" WHERE id = $1', [id]);
  });
  emitToAll('quotation:deleted', { id });
  return { success: true };
}

async function getVenueName(): Promise<string> {
  const row = await queryOne<{ value: any }>('SELECT value FROM "Setting" WHERE key = $1', ['venueName']);
  if (!row) return 'Nahata Lawns';
  return typeof row.value === 'string' ? row.value : (row.value ?? 'Nahata Lawns');
}

export async function renderPdf(id: string, opts: { theme?: string; color?: string }): Promise<{ buffer: Buffer; quoteNumber: string }> {
  const q = await getQuotation(id);
  const venueName = await getVenueName();
  const pdfData: QuotationData = {
    quoteNumber: q.quoteNumber, clientName: q.clientName, clientPhone: q.clientPhone || undefined,
    projectDetails: q.projectDetails || undefined, quoteDate: q.quoteDate,
    validityDays: q.validityDays, advancePct: q.advancePct,
    items: q.items, addlWork: q.addlWork,
    subtotal: q.subtotal, discountPct: q.discountPct, discountAmt: q.discountAmt,
    gstPct: q.gstPct, grandTotal: q.grandTotal, notes: q.notes || undefined, termsText: q.termsText || undefined,
  };
  const buffer = await generateQuotationPdf(pdfData, {
    theme: (opts.theme as any) || 'stylish',
    color: opts.color || '#1F5C45',
    venueName,
  });
  return { buffer, quoteNumber: q.quoteNumber };
}

export async function sendWhatsApp(id: string, _opts: { theme?: string; color?: string }) {
  const q = await getQuotation(id);
  if (!q.clientPhone) throw new AppError(400, 'NO_PHONE', 'This quotation has no client phone number');

  const venueName = await getVenueName();
  const total = `₹${Math.round(q.grandTotal).toLocaleString('en-IN')}`;
  const body =
    `Namaste ${q.clientName} 🙏\n\nThank you for considering ${venueName}. ` +
    `Please find your quotation ${q.quoteNumber}${q.projectDetails ? ` for ${q.projectDetails}` : ''}.\n\n` +
    `Grand Total: ${total}\nAdvance (${q.advancePct}%): ₹${Math.round(q.grandTotal * q.advancePct / 100).toLocaleString('en-IN')}\n` +
    `Valid for ${q.validityDays} days.\n\nWe look forward to hosting your special day! 🌿`;

  const { getWhatsAppProvider } = await import('../../integrations/whatsapp');
  const { providerMessageId } = await getWhatsAppProvider().sendText(q.clientPhone, body);

  // Move DRAFT → SENT once it goes out
  if (q.status === 'DRAFT') {
    await query('UPDATE "Quotation" SET status = $1, "updatedAt" = $2 WHERE id = $3', ['SENT', new Date(), id]);
  }
  emitToAll('quotation:updated', await getQuotation(id));

  return { success: true, message: `Quotation sent to ${q.clientPhone}`, providerMessageId };
}
