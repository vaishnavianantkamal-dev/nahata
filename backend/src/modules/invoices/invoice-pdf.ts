/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * GST Invoice PDF generator — pdfmake 0.3.x (same server-side setup as quotation-pdf).
 * Renders a Tax Invoice / Proforma Invoice with a CGST+SGST or IGST tax split.
 */

export interface InvoiceData {
  invoiceNumber: string;
  clientName: string;
  clientPhone?: string;
  clientGstin?: string;
  clientAddress?: string;
  projectDetails?: string;
  issueDate: Date | string;
  dueDate?: Date | string | null;
  placeOfSupply?: string;
  interState: boolean;
  items: Array<{ description: string; notes?: string; hsn?: string; areaQty: number; unit: string; rate: number; amount: number }>;
  subtotal: number;
  discountAmt: number;
  taxableValue: number;
  gstPct: number;
  cgstAmt: number;
  sgstAmt: number;
  igstAmt: number;
  grandTotal: number;
  amountInWords?: string;
  advancePct: number;
  totalPaid?: number;
  balance?: number;
  notes?: string;
  termsText?: string;
}

export interface InvoicePdfOptions {
  color: string;
  venueName: string;
  venueGstin?: string;
  venueAddress?: string;
}

function fmt(n: number): string { return `₹${Math.round((n || 0)).toLocaleString('en-IN')}`; }
function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export async function generateInvoicePdf(inv: InvoiceData, opts: InvoicePdfOptions): Promise<Buffer> {
  const PdfPrinter = require('pdfmake/js/Printer').default;
  const vfsData: Record<string, string> = require('pdfmake/build/vfs_fonts');
  const virtualFs = {
    existsSync: (p: string) => Object.prototype.hasOwnProperty.call(vfsData, p),
    readFileSync: (p: string) => Buffer.from(vfsData[p], 'base64'),
  };
  const fontDescriptors = {
    Roboto: { normal: 'Roboto-Regular.ttf', bold: 'Roboto-Medium.ttf', italics: 'Roboto-Italic.ttf', bolditalics: 'Roboto-MediumItalic.ttf' },
  };
  const urlResolver = { resolve: () => {}, resolved: () => Promise.resolve() };
  const printer = new PdfPrinter(fontDescriptors, virtualFs, urlResolver);

  const accent = opts.color || '#1F5C45';
  const dark = '#0f1f18';
  const ink = '#0f172a';        // primary text
  const body = '#475569';       // secondary text
  const muted = '#94a3b8';      // labels
  const hair = '#e2e8f0';       // hairlines
  const title = 'INVOICE';

  // Tiny helpers for a consistent type scale
  const label = (t: string, m: number[] = [0, 0, 0, 4]) =>
    ({ text: t, fontSize: 7.5, bold: true, color: muted, characterSpacing: 1.4, margin: m });
  const metaRow = (k: string, v: string, top = 0) =>
    ({ columns: [{ text: k, fontSize: 8.5, color: muted }, { text: v, fontSize: 8.5, alignment: 'right', bold: true, color: ink }], margin: [0, top, 0, 0] as any });

  // ── Item table ──
  const itemHeader = ['#', 'DESCRIPTION', 'HSN / SAC', 'QTY', 'RATE', 'AMOUNT'].map((t, i) => ({
    text: t, fontSize: 7.5, bold: true, color: '#ffffff', characterSpacing: 0.5,
    alignment: (i >= 3 ? 'right' : i === 0 ? 'center' : 'left') as 'left' | 'right' | 'center',
  }));
  const itemRows = inv.items.map((it, i) => [
    { text: String(i + 1).padStart(2, '0'), fontSize: 8.5, color: muted, alignment: 'center' as const },
    { stack: [
      { text: it.description || `Item ${i + 1}`, bold: true, fontSize: 9.5, color: ink },
      ...(it.notes ? [{ text: it.notes, color: muted, fontSize: 7.5, margin: [0, 2, 0, 0] as [number, number, number, number] }] : []),
    ] },
    { text: it.hsn || '—', fontSize: 8.5, color: body, alignment: 'left' as const },
    { text: `${it.areaQty || 0} ${it.unit}`, fontSize: 8.5, color: body, alignment: 'right' as const },
    { text: fmt(it.rate || 0), fontSize: 8.5, color: body, alignment: 'right' as const },
    { text: fmt(it.amount || 0), fontSize: 9.5, bold: true, color: ink, alignment: 'right' as const },
  ]);

  // ── Summary rows (taxable → tax split → total → received/balance) ──
  const sumRow = (k: string, v: string, opt: any = {}) => ([
    { text: k, color: opt.kColor || body, fontSize: opt.fontSize || 9 },
    { text: v, alignment: 'right', color: opt.vColor || body, fontSize: opt.fontSize || 9, bold: opt.bold || false },
  ]);
  const summaryBody: any[][] = [sumRow('Subtotal', fmt(inv.subtotal))];
  if (inv.discountAmt > 0) summaryBody.push(sumRow('Discount', `- ${fmt(inv.discountAmt)}`, { vColor: '#ef4444' }));
  summaryBody.push(sumRow('Taxable Value', fmt(inv.taxableValue), { bold: true, kColor: ink, vColor: ink }));
  if (inv.interState) {
    summaryBody.push(sumRow(`IGST (${inv.gstPct}%)`, fmt(inv.igstAmt)));
  } else {
    const half = inv.gstPct / 2;
    summaryBody.push(sumRow(`CGST (${half}%)`, fmt(inv.cgstAmt)));
    summaryBody.push(sumRow(`SGST (${half}%)`, fmt(inv.sgstAmt)));
  }
  summaryBody.push([
    { text: 'GRAND TOTAL', bold: true, fontSize: 11, color: '#ffffff', fillColor: dark, characterSpacing: 0.5, margin: [8, 9, 0, 9] as any },
    { text: fmt(inv.grandTotal), bold: true, fontSize: 12, alignment: 'right', color: '#ffffff', fillColor: dark, margin: [0, 9, 8, 9] as any },
  ]);
  if (inv.totalPaid != null && inv.totalPaid > 0) {
    summaryBody.push(sumRow('Received', fmt(inv.totalPaid), { fontSize: 8.5, kColor: '#16a34a', vColor: '#16a34a' }));
    summaryBody.push(sumRow('Balance Due', fmt(inv.balance ?? (inv.grandTotal - (inv.totalPaid || 0))), { bold: true, fontSize: 9.5, kColor: '#dc2626', vColor: '#dc2626' }));
  }

  const docDef: any = {
    pageSize: 'A4',
    pageMargins: [44, 40, 44, 58],
    defaultStyle: { font: 'Roboto', fontSize: 9.5, color: '#1e293b', lineHeight: 1.15 },
    footer: (currentPage: number, pageCount: number) => ({
      margin: [44, 14, 44, 0],
      columns: [
        { text: `${opts.venueName} · ${inv.invoiceNumber}`, fontSize: 7, color: muted },
        { text: `Page ${currentPage} of ${pageCount}`, fontSize: 7, color: muted, alignment: 'right' },
      ],
    }),
    content: [
      // ── Header band ──
      { canvas: [{ type: 'rect', x: -44, y: -40, w: 595, h: 104, color: dark }] },
      {
        columns: [
          { stack: [
            { text: opts.venueName, fontSize: 19, bold: true, color: '#ffffff', margin: [0, -74, 0, 3] as any },
            { text: 'WEDDING & EVENTS VENUE', fontSize: 7.5, color: '#cbd5e1', characterSpacing: 2 },
            ...(opts.venueGstin ? [{ text: `GSTIN  ${opts.venueGstin}`, fontSize: 7.5, color: '#cbd5e1', margin: [0, 4, 0, 0] as any }] : []),
            ...(opts.venueAddress ? [{ text: opts.venueAddress, fontSize: 7.5, color: '#94a3b8', margin: [0, 2, 0, 0] as any }] : []),
          ] },
          { stack: [
            { text: title, fontSize: 24, bold: true, alignment: 'right', color: '#ffffff', characterSpacing: 4, margin: [0, -74, 0, 4] as any },
            { text: inv.invoiceNumber, fontSize: 9.5, alignment: 'right', color: '#cbd5e1', characterSpacing: 0.5 },
          ] },
        ],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 6, x2: 507, y2: 6, lineWidth: 2, lineColor: accent }], margin: [0, 18, 0, 20] },

      // ── Bill-to + meta ──
      {
        columns: [
          { width: '*', stack: [
            label('BILLED TO', [0, 0, 0, 6]),
            { text: inv.clientName, fontSize: 13, bold: true, color: ink },
            ...(inv.clientPhone ? [{ text: inv.clientPhone, fontSize: 9, color: body, margin: [0, 3, 0, 0] as any }] : []),
            ...(inv.clientAddress ? [{ text: inv.clientAddress, fontSize: 8.5, color: body, margin: [0, 2, 0, 0] as any }] : []),
            ...(inv.clientGstin ? [{ text: `GSTIN  ${inv.clientGstin}`, fontSize: 8.5, color: body, margin: [0, 2, 0, 0] as any }] : []),
          ] },
          { width: 210, stack: [
            metaRow('Invoice Date', fmtDate(inv.issueDate)),
            ...(inv.dueDate ? [metaRow('Due Date', fmtDate(inv.dueDate), 5)] : []),
            ...(inv.placeOfSupply ? [metaRow('Place of Supply', inv.placeOfSupply, 5)] : []),
            ...(inv.projectDetails ? [metaRow('Project', inv.projectDetails, 5)] : []),
          ] },
        ],
        columnGap: 28,
        margin: [0, 0, 0, 22],
      },

      // ── Items ──
      {
        table: { headerRows: 1, widths: [24, '*', 60, 54, 64, 72], body: [itemHeader, ...itemRows] },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? dark : rowIndex % 2 === 0 ? '#f8fafc' : null),
          hLineColor: (i: number, node: any) => (i === 1 ? accent : i === node.table.body.length ? '#cbd5e1' : hair),
          hLineWidth: (i: number, node: any) => (i === 0 ? 0 : i === 1 ? 1.5 : i === node.table.body.length ? 1 : 0.5),
          vLineWidth: () => 0,
          paddingTop: () => 8, paddingBottom: () => 8, paddingLeft: () => 8, paddingRight: () => 8,
        },
      },

      // ── Amount in words + totals ──
      {
        columns: [
          { width: '*', margin: [0, 18, 16, 0], stack: [
            ...(inv.amountInWords ? [{
              table: { widths: ['*'], body: [[{ stack: [
                label('AMOUNT IN WORDS', [0, 0, 0, 4]),
                { text: inv.amountInWords, fontSize: 9.5, italics: true, color: '#334155', lineHeight: 1.3 },
              ], margin: [12, 11, 12, 11] }]] },
              layout: { fillColor: () => '#f8fafc', hLineWidth: () => 0, vLineWidth: () => 0 },
            }] : []),
          ] },
          { width: 248, margin: [0, 18, 0, 0],
            table: { widths: ['*', 104], body: summaryBody },
            layout: {
              hLineColor: () => hair,
              hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 0 : 0.6),
              vLineWidth: () => 0,
              paddingTop: () => 6, paddingBottom: () => 6, paddingLeft: () => 8, paddingRight: () => 8,
            },
          },
        ],
      },

      // ── Notes / terms ──
      ...(inv.notes || inv.termsText ? [
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 507, y2: 5, lineWidth: 0.5, lineColor: hair }], margin: [0, 22, 0, 14] },
        { columns: [
          inv.notes ? { width: '*', stack: [label('NOTES'), { text: inv.notes, fontSize: 8.5, color: body, lineHeight: 1.5 }] } : { text: '', width: '*' },
          inv.termsText ? { width: '*', stack: [label('TERMS & CONDITIONS'), { text: inv.termsText, fontSize: 8.5, color: body, lineHeight: 1.5 }] } : { text: '', width: '*' },
        ], columnGap: 28 },
      ] : []),

      // ── Signature ──
      {
        columns: [
          { width: '*', text: '' },
          { width: 180, stack: [
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 1, lineColor: '#334155' }], margin: [0, 36, 0, 5] },
            { text: `For ${opts.venueName}`, fontSize: 8.5, bold: true, color: '#334155' },
            { text: 'Authorised Signatory', fontSize: 7.5, color: muted, margin: [0, 1, 0, 0] as any },
          ] },
        ],
        margin: [0, 24, 0, 0],
      },

      // ── Thank-you note ──
      { text: 'Thank you for choosing ' + opts.venueName + '.', fontSize: 8, italics: true, color: muted, alignment: 'center', margin: [0, 28, 0, 0] },
    ],
  };

  const pdfDoc = await printer.createPdfKitDocument(docDef);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on('data', (c: Buffer) => chunks.push(c));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', (e: Error) => reject(e));
    pdfDoc.end();
  });
}
