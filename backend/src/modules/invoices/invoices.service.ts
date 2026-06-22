import { query, queryOne, queryMany, transaction } from '../../lib/db';
import { AppError } from '../../middleware/error';
import { emitToAll } from '../../lib/socket';
import { amountToWords } from './number-to-words';
import { generateInvoicePdf, type InvoiceData } from './invoice-pdf';
import * as qsvc from '../quotations/quotations.service';

const { v4: uuidv4 } = require('uuid');

const round2 = (n: number) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

// Standard 15-char GSTIN: 2-digit state code + 10-char PAN + entity digit + 'Z' + checksum.
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export function validateGstin(gstin?: string | null) {
  if (!gstin) return;
  if (!GSTIN_REGEX.test(String(gstin).trim().toUpperCase())) {
    throw new AppError(400, 'INVALID_GSTIN', 'GSTIN must be a valid 15-character GST number (e.g. 27ABCDE1234F1Z5)');
  }
}

// ── GST split: intra-state → CGST+SGST, inter-state → IGST ──
function computeGst(taxableValue: number, gstPct: number, interState: boolean) {
  const tax = round2(taxableValue * (gstPct || 0) / 100);
  if (interState) return { cgstAmt: 0, sgstAmt: 0, igstAmt: tax };
  const half = round2(tax / 2);
  // keep the two halves summing exactly to `tax`
  return { cgstAmt: half, sgstAmt: round2(tax - half), igstAmt: 0 };
}

// Indian financial year label for a date, e.g. Jun-2026 → "2026-27".
function fyLabel(d: Date): string {
  const y = d.getFullYear();
  const start = d.getMonth() >= 3 ? y : y - 1; // April (month 3) starts the FY
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

async function generateInvoiceNumber(date: Date): Promise<string> {
  const base = `INV/${fyLabel(date)}/`;
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM "Invoice" WHERE "invoiceNumber" LIKE $1`,
    [`${base}%`]
  );
  let seq = Number(row?.count || 0) + 1;
  for (let i = 0; i < 100; i++) {
    const candidate = `${base}${String(seq).padStart(4, '0')}`;
    const exists = await queryOne('SELECT 1 FROM "Invoice" WHERE "invoiceNumber" = $1', [candidate]);
    if (!exists) return candidate;
    seq++;
  }
  return `${base}${Date.now().toString().slice(-5)}`;
}

function normalizeItems(rawItems: any[]) {
  return (rawItems || [])
    .filter(it => (it?.description || '').trim() !== '' || Number(it?.rate) || Number(it?.quantity ?? it?.areaQty))
    .map((it, idx) => {
      const areaQty = Number(it.areaQty ?? it.quantity) || 0;
      const rate = Number(it.rate) || 0;
      return {
        order: idx,
        description: it.description || '',
        notes: it.notes || null,
        hsn: it.hsn || null,
        areaQty,
        unit: it.unit || 'Nos',
        rate,
        amount: round2(areaQty * rate),
      };
    });
}

function deriveStatus(stored: string, grandTotal: number, totalPaid: number) {
  if (stored === 'CANCELLED') return 'CANCELLED';
  if (grandTotal > 0 && totalPaid >= grandTotal) return 'PAID';
  if (totalPaid > 0) return 'PARTIAL';
  return 'UNPAID';
}

async function fetchItems(invoiceId: string) {
  const items = await queryMany<any>(
    `SELECT id, "order", description, notes, hsn, "areaQty", unit, rate, amount
     FROM "InvoiceItem" WHERE "invoiceId" = $1 ORDER BY "order" ASC`,
    [invoiceId]
  );
  return items.map(it => ({ ...it, quantity: it.areaQty }));
}

async function fetchPayments(invoiceId: string) {
  return queryMany<any>(
    `SELECT id, "quotationId", "invoiceId", amount, method, reference,
            to_char("paidOn", 'YYYY-MM-DD') as "paidOn", notes
     FROM "Payment" WHERE "invoiceId" = $1 AND "deletedAt" IS NULL
     ORDER BY "paidOn" ASC, "createdAt" ASC`,
    [invoiceId]
  );
}

async function shapeInvoice(row: any) {
  const items = await fetchItems(row.id);
  const payments = await fetchPayments(row.id);
  const totalPaid = round2(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0));
  const grandTotal = Number(row.grandTotal) || 0;
  const status = deriveStatus(row.status, grandTotal, totalPaid);
  const advanceDue = round2(grandTotal * (Number(row.advancePct) || 0) / 100);
  return {
    ...row,
    interState: row.interState === true || row.interState === 't',
    items,
    payments,
    totalPaid,
    balance: round2(grandTotal - totalPaid),
    advanceDue,
    advancePaid: advanceDue > 0 && totalPaid >= advanceDue,
    status,
  };
}

export async function getInvoice(id: string) {
  const row = await queryOne<any>(
    `SELECT *, to_char("issueDate", 'YYYY-MM-DD') as "issueDate", to_char("dueDate", 'YYYY-MM-DD') as "dueDate" FROM "Invoice" WHERE id = $1 AND "deletedAt" IS NULL`,
    [id]
  );
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Invoice not found');
  return shapeInvoice(row);
}

export async function listInvoices(params: { status?: string; from?: string; to?: string }) {
  const conditions = ['"deletedAt" IS NULL'];
  const values: any[] = [];
  let i = 1;
  if (params.from)   { conditions.push(`"issueDate" >= $${i++}::date`);  values.push(params.from); }
  if (params.to)     { conditions.push(`"issueDate" <= $${i++}::date`);  values.push(params.to); }

  const rows = await queryMany<any>(
    `SELECT *, to_char("issueDate", 'YYYY-MM-DD') as "issueDate", to_char("dueDate", 'YYYY-MM-DD') as "dueDate"
     FROM "Invoice" WHERE ${conditions.join(' AND ')} ORDER BY "createdAt" DESC`,
    values
  );
  let data = await Promise.all(rows.map(shapeInvoice));
  if (params.status) data = data.filter(d => d.status === params.status);

  const summary = {
    count: data.length,
    totalBilled: round2(data.filter(d => d.status !== 'CANCELLED').reduce((s, d) => s + (Number(d.grandTotal) || 0), 0)),
    totalReceived: round2(data.reduce((s, d) => s + d.totalPaid, 0)),
    totalOutstanding: round2(data.filter(d => d.status !== 'CANCELLED').reduce((s, d) => s + Math.max(0, d.balance), 0)),
    paidCount: data.filter(d => d.status === 'PAID').length,
  };
  return { data, summary };
}

export async function createInvoice(data: any, createdById?: string) {
  validateGstin(data.clientGstin);

  // Pull defaults from the source quotation when one is linked.
  let quotation: any = null;
  if (data.quotationId) {
    quotation = await qsvc.getQuotation(data.quotationId).catch(() => null);
    if (!quotation) throw new AppError(404, 'NOT_FOUND', 'Linked quotation not found');
  }

  const clientName = (data.clientName ?? quotation?.clientName ?? '').trim();
  if (!clientName) throw new AppError(400, 'BAD_REQUEST', 'clientName is required');

  const rawItems = (data.items && data.items.length) ? data.items : (quotation?.items || []);
  const items = normalizeItems(rawItems);
  if (items.length === 0) throw new AppError(400, 'BAD_REQUEST', 'At least one line item is required');

  const subtotal = round2(items.reduce((s, it) => s + it.amount, 0));
  const discountAmt = round2(Math.max(0, Number(data.discountAmt ?? quotation?.discountAmt ?? 0)));
  const taxableValue = round2(subtotal - discountAmt);
  const gstPct = Number(data.gstPct ?? quotation?.gstPct ?? 0);
  const interState = data.interState === true;
  const { cgstAmt, sgstAmt, igstAmt } = computeGst(taxableValue, gstPct, interState);
  const grandTotal = round2(taxableValue + cgstAmt + sgstAmt + igstAmt);
  const advancePct = Number(data.advancePct ?? quotation?.advancePct ?? 0);

  const id = uuidv4();
  const now = new Date();
  const issueDate = (data.issueDate && String(data.issueDate).slice(0, 10)) || now.toISOString().slice(0, 10);
  const invoiceNumber = await generateInvoiceNumber(new Date(issueDate));

  await transaction(async (client: any) => {
    await client.query(
      `INSERT INTO "Invoice" (id, "invoiceNumber", type, "quotationId", "bookingId", "leadId",
         "clientName", "clientPhone", "clientGstin", "clientAddress", "projectDetails",
         "issueDate", "dueDate", "placeOfSupply", "interState",
         subtotal, "discountAmt", "taxableValue", "gstPct", "cgstAmt", "sgstAmt", "igstAmt",
         "grandTotal", "advancePct", "amountInWords", notes, "termsText", status, "createdById", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)`,
      [
        id, invoiceNumber, 'TAX_INVOICE', data.quotationId || null, data.bookingId || null,
        data.leadId ?? quotation?.leadId ?? null,
        clientName, data.clientPhone ?? quotation?.clientPhone ?? null, data.clientGstin || null,
        data.clientAddress || null, data.projectDetails ?? quotation?.projectDetails ?? null,
        issueDate, data.dueDate ? String(data.dueDate).slice(0, 10) : null, data.placeOfSupply || null, interState,
        subtotal, discountAmt, taxableValue, gstPct, cgstAmt, sgstAmt, igstAmt,
        grandTotal, advancePct, amountToWords(grandTotal), data.notes ?? quotation?.notes ?? null,
        data.termsText ?? quotation?.termsText ?? null, 'UNPAID', createdById || null, now, now,
      ]
    );
    for (const it of items) {
      await client.query(
        `INSERT INTO "InvoiceItem" (id, "invoiceId", "order", description, notes, hsn, "areaQty", unit, rate, amount, "createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [uuidv4(), id, it.order, it.description, it.notes, it.hsn, it.areaQty, it.unit, it.rate, it.amount, now]
      );
    }

    // Attach already-received (unlinked) payments from the source quotation to this invoice,
    // and mark the quotation as invoiced.
    if (data.quotationId) {
      await client.query(
        `UPDATE "Payment" SET "invoiceId" = $1, "updatedAt" = $2
         WHERE "quotationId" = $3 AND "invoiceId" IS NULL AND "deletedAt" IS NULL`,
        [id, now, data.quotationId]
      );
      await client.query('UPDATE "Quotation" SET status = $1, "updatedAt" = $2 WHERE id = $3', ['INVOICED', now, data.quotationId]);
    }
  });

  // Persist a status that reflects any adopted payments
  const built = await getInvoice(id);
  if (built.status !== 'UNPAID') {
    await query('UPDATE "Invoice" SET status = $1, "updatedAt" = $2 WHERE id = $3', [built.status, now, id]);
  }

  emitToAll('invoice:created', built);
  return built;
}

// Metadata columns that can be patched directly (non-financial). dueDate/issueDate get sliced.
const META_FIELDS = new Set(['clientName', 'clientPhone', 'clientGstin', 'clientAddress', 'projectDetails', 'issueDate', 'dueDate', 'placeOfSupply', 'notes', 'termsText', 'status']);

export async function updateInvoice(id: string, data: any) {
  const existing = await queryOne<any>('SELECT * FROM "Invoice" WHERE id = $1 AND "deletedAt" IS NULL', [id]);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Invoice not found');
  if (data.status && !['UNPAID', 'PARTIAL', 'PAID', 'CANCELLED'].includes(data.status)) {
    throw new AppError(400, 'BAD_REQUEST', 'Invalid status');
  }
  if (data.clientGstin !== undefined) validateGstin(data.clientGstin);

  // A financial edit recomputes totals + the GST split (and replaces line items if given).
  const recompute = data.items !== undefined || data.gstPct !== undefined ||
    data.interState !== undefined || data.discountAmt !== undefined || data.advancePct !== undefined;

  const now = new Date();
  await transaction(async (client: any) => {
    if (recompute) {
      const items = data.items !== undefined ? normalizeItems(data.items) : await fetchItems(id);
      if (items.length === 0) throw new AppError(400, 'BAD_REQUEST', 'At least one line item is required');
      const subtotal = round2(items.reduce((s, it) => s + it.amount, 0));
      const discountAmt = round2(Math.max(0, Number(data.discountAmt ?? existing.discountAmt) || 0));
      const taxableValue = round2(subtotal - discountAmt);
      const gstPct = Number(data.gstPct ?? existing.gstPct) || 0;
      const interState = data.interState !== undefined ? data.interState === true : existing.interState === true;
      const { cgstAmt, sgstAmt, igstAmt } = computeGst(taxableValue, gstPct, interState);
      const grandTotal = round2(taxableValue + cgstAmt + sgstAmt + igstAmt);
      const advancePct = Number(data.advancePct ?? existing.advancePct) || 0;

      await client.query(
        `UPDATE "Invoice" SET subtotal=$2, "discountAmt"=$3, "taxableValue"=$4, "gstPct"=$5, "interState"=$6,
           "cgstAmt"=$7, "sgstAmt"=$8, "igstAmt"=$9, "grandTotal"=$10, "advancePct"=$11, "amountInWords"=$12, "updatedAt"=$13
         WHERE id=$1`,
        [id, subtotal, discountAmt, taxableValue, gstPct, interState, cgstAmt, sgstAmt, igstAmt, grandTotal, advancePct, amountToWords(grandTotal), now]
      );

      if (data.items !== undefined) {
        await client.query('DELETE FROM "InvoiceItem" WHERE "invoiceId" = $1', [id]);
        for (const it of items) {
          await client.query(
            `INSERT INTO "InvoiceItem" (id, "invoiceId", "order", description, notes, hsn, "areaQty", unit, rate, amount, "createdAt")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [uuidv4(), id, it.order, it.description, it.notes, it.hsn, it.areaQty, it.unit, it.rate, it.amount, now]
          );
        }
      }
    }

    // Metadata fields
    const sets: string[] = [];
    const values: any[] = [id];
    let i = 2;
    for (const [key, value] of Object.entries(data)) {
      if (!META_FIELDS.has(key)) continue;
      let v: any = value;
      if ((key === 'dueDate' || key === 'issueDate') && v) v = String(v).slice(0, 10);
      sets.push(`"${key}" = $${i++}`);
      values.push(v);
    }
    if (sets.length > 0) {
      values.push(now);
      await client.query(`UPDATE "Invoice" SET ${sets.join(', ')}, "updatedAt" = $${i} WHERE id = $1`, values);
    }
  });

  const invoice = await getInvoice(id);
  emitToAll('invoice:updated', invoice);
  return invoice;
}

export async function cancelInvoice(id: string) {
  return updateInvoice(id, { status: 'CANCELLED' });
}

export async function deleteInvoice(id: string) {
  const existing = await queryOne<any>('SELECT id FROM "Invoice" WHERE id = $1', [id]);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Invoice not found');
  const now = new Date();
  // Detach payments so they aren't orphaned/hidden, then soft-delete the invoice.
  await query('UPDATE "Payment" SET "invoiceId" = NULL, "updatedAt" = $1 WHERE "invoiceId" = $2', [now, id]);
  await query('UPDATE "Invoice" SET "deletedAt" = $1, "updatedAt" = $2 WHERE id = $3', [now, now, id]);
  emitToAll('invoice:deleted', { id });
  return { success: true };
}

async function getVenueSettings() {
  const rows = await queryMany<{ key: string; value: any }>(
    `SELECT key, value FROM "Setting" WHERE key IN ('venueName', 'venueGstin', 'venueAddress')`
  );
  const map: Record<string, string> = {};
  rows.forEach(r => { map[r.key] = typeof r.value === 'string' ? r.value : (r.value ?? ''); });
  return { venueName: map.venueName || 'Nahata Lawns', venueGstin: map.venueGstin || '', venueAddress: map.venueAddress || '' };
}

export async function renderPdf(id: string, opts: { color?: string }): Promise<{ buffer: Buffer; invoiceNumber: string }> {
  const inv = await getInvoice(id);
  const venue = await getVenueSettings();
  const pdfData: InvoiceData = {
    invoiceNumber: inv.invoiceNumber, clientName: inv.clientName, clientPhone: inv.clientPhone || undefined,
    clientGstin: inv.clientGstin || undefined, clientAddress: inv.clientAddress || undefined, projectDetails: inv.projectDetails || undefined,
    issueDate: inv.issueDate, dueDate: inv.dueDate, placeOfSupply: inv.placeOfSupply || undefined, interState: inv.interState,
    items: inv.items, subtotal: inv.subtotal, discountAmt: inv.discountAmt, taxableValue: inv.taxableValue,
    gstPct: inv.gstPct, cgstAmt: inv.cgstAmt, sgstAmt: inv.sgstAmt, igstAmt: inv.igstAmt, grandTotal: inv.grandTotal,
    amountInWords: inv.amountInWords || undefined, advancePct: inv.advancePct, totalPaid: inv.totalPaid, balance: inv.balance,
    notes: inv.notes || undefined, termsText: inv.termsText || undefined,
  };
  const buffer = await generateInvoicePdf(pdfData, { color: opts.color || '#1F5C45', ...venue });
  return { buffer, invoiceNumber: inv.invoiceNumber };
}

export async function sendWhatsApp(id: string) {
  const inv = await getInvoice(id);
  if (!inv.clientPhone) throw new AppError(400, 'NO_PHONE', 'This invoice has no client phone number');
  const venue = await getVenueSettings();
  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  const body =
    `Namaste ${inv.clientName} 🙏\n\n${venue.venueName} — Tax Invoice ${inv.invoiceNumber}.\n\n` +
    `Total: ${fmt(inv.grandTotal)}\nReceived: ${fmt(inv.totalPaid)}\nBalance due: ${fmt(inv.balance)}\n\n` +
    `Thank you for choosing us! 🌿`;
  const { getWhatsAppProvider } = await import('../../integrations/whatsapp');
  const { providerMessageId } = await getWhatsAppProvider().sendText(inv.clientPhone, body);
  return { success: true, message: `Invoice sent to ${inv.clientPhone}`, providerMessageId };
}
