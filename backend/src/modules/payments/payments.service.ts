import { query, queryOne, queryMany } from '../../lib/db';
import { AppError } from '../../middleware/error';
import { emitToAll } from '../../lib/socket';

const { v4: uuidv4 } = require('uuid');

const VALID_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER'] as const;
const UPDATABLE_FIELDS = new Set(['amount', 'method', 'reference', 'paidOn', 'notes']);

// Quotation statuses that count as billable revenue for the overview/summary.
const BILLABLE_STATUSES = ['ACCEPTED', 'INVOICED'];

const SELECT_PAYMENT = `
  SELECT id, "quotationId", "invoiceId", "leadId", amount, method, reference,
         to_char("paidOn", 'YYYY-MM-DD') as "paidOn", notes, "createdById",
         "createdAt", "updatedAt"
  FROM "Payment"
`;

// Derive a payment status + balance for a quotation total.
function deriveStatus(grandTotal: number, totalPaid: number, advancePct: number) {
  const balance = +(grandTotal - totalPaid).toFixed(2);
  const advanceDue = +(grandTotal * (advancePct || 0) / 100).toFixed(2);
  let paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' = 'UNPAID';
  if (grandTotal > 0 && totalPaid >= grandTotal) paymentStatus = 'PAID';
  else if (totalPaid > 0) paymentStatus = 'PARTIAL';
  return { balance, advanceDue, advancePaid: totalPaid >= advanceDue && advanceDue > 0, paymentStatus };
}

async function fetchPayment(id: string) {
  return queryOne<any>(`${SELECT_PAYMENT} WHERE id = $1 AND "deletedAt" IS NULL`, [id]);
}

async function requireQuotation(quotationId: string) {
  const q = await queryOne<any>(
    'SELECT id, "quoteNumber", "clientName", "clientPhone", "leadId", "grandTotal", "advancePct", status FROM "Quotation" WHERE id = $1',
    [quotationId]
  );
  if (!q) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');
  return q;
}

export async function listPayments(params: { quotationId?: string; invoiceId?: string; leadId?: string; method?: string; from?: string; to?: string }) {
  const conditions = ['p."deletedAt" IS NULL'];
  const values: any[] = [];
  let i = 1;
  if (params.quotationId) { conditions.push(`p."quotationId" = $${i++}`); values.push(params.quotationId); }
  if (params.invoiceId)   { conditions.push(`p."invoiceId" = $${i++}`);   values.push(params.invoiceId); }
  if (params.leadId)      { conditions.push(`p."leadId" = $${i++}`);      values.push(params.leadId); }
  if (params.method)      { conditions.push(`p.method = $${i++}`);        values.push(params.method); }
  if (params.from)        { conditions.push(`p."paidOn" >= $${i++}::date`); values.push(params.from); }
  if (params.to)          { conditions.push(`p."paidOn" <= $${i++}::date`); values.push(params.to); }

  return queryMany<any>(
    `SELECT p.id, p."quotationId", p."leadId", p.amount, p.method, p.reference,
            to_char(p."paidOn", 'YYYY-MM-DD') as "paidOn", p.notes, p."createdById",
            p."createdAt", p."updatedAt",
            q."quoteNumber" as "quoteNumber", q."clientName" as "clientName"
     FROM "Payment" p
     LEFT JOIN "Quotation" q ON p."quotationId" = q.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY p."paidOn" DESC, p."createdAt" DESC`,
    values
  );
}

/** Full ledger for one quotation: the quotation header, its payments, and computed totals. */
export async function getLedger(quotationId: string) {
  const q = await requireQuotation(quotationId);
  const payments = await queryMany<any>(
    `${SELECT_PAYMENT} WHERE "quotationId" = $1 AND "deletedAt" IS NULL ORDER BY "paidOn" ASC, "createdAt" ASC`,
    [quotationId]
  );
  const totalPaid = +payments.reduce((s, p) => s + (Number(p.amount) || 0), 0).toFixed(2);
  const derived = deriveStatus(Number(q.grandTotal) || 0, totalPaid, Number(q.advancePct) || 0);
  return {
    quotation: {
      id: q.id, quoteNumber: q.quoteNumber, clientName: q.clientName, clientPhone: q.clientPhone,
      grandTotal: Number(q.grandTotal) || 0, advancePct: Number(q.advancePct) || 0, status: q.status,
    },
    payments,
    totalPaid,
    ...derived,
  };
}

/**
 * Revenue overview: every billable quotation (ACCEPTED/INVOICED, or any quotation
 * that already has a payment) with its paid/balance figures, plus a top summary.
 */
export async function getOverview(params: { from?: string; to?: string } = {}) {
  const values: any[] = [];
  let i = 1;
  let dateFilter = '';
  if (params.from) { dateFilter += ` AND q."quoteDate" >= $${i++}::date`; values.push(params.from); }
  if (params.to)   { dateFilter += ` AND q."quoteDate" <= $${i++}::date`; values.push(params.to); }

  const billableList = `'${BILLABLE_STATUSES.join("','")}'`;
  const rows = await queryMany<any>(
    `SELECT q.id, q."quoteNumber", q."clientName", q."clientPhone", q.status,
            q."grandTotal", q."advancePct", to_char(q."quoteDate", 'YYYY-MM-DD') as "quoteDate",
            COALESCE(SUM(p.amount) FILTER (WHERE p."deletedAt" IS NULL), 0) as paid,
            COUNT(p.id) FILTER (WHERE p."deletedAt" IS NULL) as "paymentCount",
            to_char(MAX(p."paidOn") FILTER (WHERE p."deletedAt" IS NULL), 'YYYY-MM-DD') as "lastPaymentOn"
     FROM "Quotation" q
     LEFT JOIN "Payment" p ON p."quotationId" = q.id
     WHERE 1=1${dateFilter}
     GROUP BY q.id
     HAVING q.status IN (${billableList}) OR COUNT(p.id) FILTER (WHERE p."deletedAt" IS NULL) > 0
     ORDER BY q."createdAt" DESC`,
    values
  );

  const list = rows.map(r => {
    const grandTotal = Number(r.grandTotal) || 0;
    const totalPaid = Number(r.paid) || 0;
    const derived = deriveStatus(grandTotal, totalPaid, Number(r.advancePct) || 0);
    return {
      quotationId: r.id, quoteNumber: r.quoteNumber, clientName: r.clientName, clientPhone: r.clientPhone,
      status: r.status, grandTotal, advancePct: Number(r.advancePct) || 0, quoteDate: r.quoteDate,
      totalPaid, paymentCount: Number(r.paymentCount) || 0, lastPaymentOn: r.lastPaymentOn,
      ...derived,
    };
  });

  const summary = {
    billableCount: list.length,
    totalBillable: +list.reduce((s, r) => s + r.grandTotal, 0).toFixed(2),
    totalReceived: +list.reduce((s, r) => s + r.totalPaid, 0).toFixed(2),
    totalOutstanding: +list.reduce((s, r) => s + Math.max(0, r.balance), 0).toFixed(2),
    fullyPaidCount: list.filter(r => r.paymentStatus === 'PAID').length,
    partialCount: list.filter(r => r.paymentStatus === 'PARTIAL').length,
    unpaidCount: list.filter(r => r.paymentStatus === 'UNPAID').length,
  };

  return { summary, rows: list };
}

export async function createPayment(data: any, createdById?: string) {
  if (!data.quotationId && !data.invoiceId) throw new AppError(400, 'BAD_REQUEST', 'quotationId or invoiceId is required');
  const amount = Number(data.amount);
  if (!amount || amount <= 0) throw new AppError(400, 'BAD_REQUEST', 'amount must be greater than 0');

  const method = data.method || 'CASH';
  if (!VALID_METHODS.includes(method)) {
    throw new AppError(400, 'BAD_REQUEST', `method must be one of ${VALID_METHODS.join(', ')}`);
  }

  // Resolve quotation/lead linkage from whichever anchor was supplied.
  let quotationId: string | null = data.quotationId || null;
  let leadId: string | null = null;
  if (data.invoiceId) {
    const inv = await queryOne<any>('SELECT id, "quotationId", "leadId" FROM "Invoice" WHERE id = $1 AND "deletedAt" IS NULL', [data.invoiceId]);
    if (!inv) throw new AppError(404, 'NOT_FOUND', 'Invoice not found');
    if (!quotationId) quotationId = inv.quotationId || null;
    leadId = inv.leadId || null;
  }
  if (quotationId) {
    const q = await requireQuotation(quotationId);
    leadId = leadId || q.leadId || null;
  }

  const id = uuidv4();
  const now = new Date();
  const paidOn = (data.paidOn && String(data.paidOn).slice(0, 10)) || now.toISOString().slice(0, 10);

  await query(
    `INSERT INTO "Payment" (id, "quotationId", "invoiceId", "leadId", amount, method, reference, "paidOn", notes, "createdById", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [id, quotationId, data.invoiceId || null, leadId, +amount.toFixed(2), method, data.reference || null, paidOn, data.notes || null, createdById || null, now, now]
  );

  const payment = await fetchPayment(id);
  const ledger = quotationId ? await getLedger(quotationId) : null;
  emitToAll('payment:created', { payment, ledger });
  return { payment, ledger };
}

export async function updatePayment(id: string, data: any) {
  const existing = await fetchPayment(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Payment not found');

  if (data.amount !== undefined) {
    const amt = Number(data.amount);
    if (!amt || amt <= 0) throw new AppError(400, 'BAD_REQUEST', 'amount must be greater than 0');
  }
  if (data.method !== undefined && !VALID_METHODS.includes(data.method)) {
    throw new AppError(400, 'BAD_REQUEST', `method must be one of ${VALID_METHODS.join(', ')}`);
  }

  const sets: string[] = [];
  const values: any[] = [id];
  let i = 2;
  for (const [key, value] of Object.entries(data)) {
    if (!UPDATABLE_FIELDS.has(key)) continue;
    let v: any = value;
    if (key === 'amount') v = +Number(v).toFixed(2);
    if (key === 'paidOn' && v) v = String(v).slice(0, 10);
    sets.push(`"${key}" = $${i++}`);
    values.push(v);
  }
  if (sets.length > 0) {
    values.push(new Date());
    await query(`UPDATE "Payment" SET ${sets.join(', ')}, "updatedAt" = $${i} WHERE id = $1`, values);
  }

  const payment = await fetchPayment(id);
  const ledger = existing.quotationId ? await getLedger(existing.quotationId) : null;
  emitToAll('payment:updated', { payment, ledger });
  return { payment, ledger };
}

export async function deletePayment(id: string) {
  const existing = await fetchPayment(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Payment not found');
  const now = new Date();
  await query('UPDATE "Payment" SET "deletedAt" = $1, "updatedAt" = $2 WHERE id = $3', [now, now, id]);
  const ledger = existing.quotationId ? await getLedger(existing.quotationId) : null;
  emitToAll('payment:deleted', { id, ledger });
  return { success: true, ledger };
}

/** Send a balance-due reminder over WhatsApp (mock provider until Meta is wired). */
export async function sendReminder(quotationId: string) {
  const ledger = await getLedger(quotationId);
  if (!ledger.quotation.clientPhone) throw new AppError(400, 'NO_PHONE', 'This quotation has no client phone number');
  if (ledger.balance <= 0) throw new AppError(400, 'ALREADY_PAID', 'This quotation is already fully paid');

  const venue = await queryOne<{ value: any }>('SELECT value FROM "Setting" WHERE key = $1', ['venueName']);
  const venueName = venue ? (typeof venue.value === 'string' ? venue.value : (venue.value ?? 'Nahata Lawns')) : 'Nahata Lawns';
  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  const body =
    `Namaste ${ledger.quotation.clientName} 🙏\n\nGentle reminder from ${venueName} regarding quotation ${ledger.quotation.quoteNumber}.\n\n` +
    `Total: ${fmt(ledger.quotation.grandTotal)}\nReceived: ${fmt(ledger.totalPaid)}\nBalance due: ${fmt(ledger.balance)}\n\n` +
    `Kindly arrange the pending payment at your convenience. Thank you! 🌿`;

  const { getWhatsAppProvider } = await import('../../integrations/whatsapp');
  const { providerMessageId } = await getWhatsAppProvider().sendText(ledger.quotation.clientPhone, body);
  return { success: true, message: `Reminder sent to ${ledger.quotation.clientPhone}`, providerMessageId };
}
