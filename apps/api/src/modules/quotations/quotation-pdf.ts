/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Quotation PDF generator — pdfmake 0.3.x (pure Node.js, no browser required).
 *
 * Font note: pdfmake 0.3.x ships with Roboto in its vfs_fonts bundle.
 * We load them via a virtual-fs adapter that reads from the bundled base64 strings.
 */

export interface QuotationData {
  quoteNumber:    string;
  clientName:     string;
  clientPhone?:   string;
  projectDetails?: string;
  quoteDate:      Date;
  validityDays:   number;
  advancePct:     number;
  items: Array<{
    description: string; notes?: string;
    areaQty: number; unit: string;
    rate: number; amount: number;
    length?: number; width?: number;
  }>;
  addlWork: Array<{ item: string; qty: number; unit: string; rate: number; amount: number }>;
  subtotal:    number;
  discountPct: number;
  discountAmt: number;
  gstPct:      number;
  grandTotal:  number;
  notes?:      string;
  termsText?:  string;
}

export interface PdfOptions {
  theme:     'stylish' | 'minimalist' | 'gst';
  color:     string;
  venueName: string;
}

function fmt(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export async function generateQuotationPdf(q: QuotationData, opts: PdfOptions): Promise<Buffer> {
  // pdfmake 0.3.x — use Printer directly (server-side class)
  const PdfPrinter = require('pdfmake/js/Printer').default;
  // vfs_fonts in 0.3.9 exports { 'Roboto-Regular.ttf': '<base64>', ... }
  const vfsData: Record<string, string> = require('pdfmake/build/vfs_fonts');

  // Virtual FS adapter pdfmake 0.3.x expects
  const virtualFs = {
    existsSync:   (p: string) => Object.prototype.hasOwnProperty.call(vfsData, p),
    readFileSync:  (p: string) => Buffer.from(vfsData[p], 'base64'),
  };

  const fontDescriptors = {
    Roboto: {
      normal:      'Roboto-Regular.ttf',
      bold:        'Roboto-Medium.ttf',
      italics:     'Roboto-Italic.ttf',
      bolditalics: 'Roboto-MediumItalic.ttf',
    },
  };

  // urlResolver is required in pdfmake 0.3.x (even if unused in our docs)
  const urlResolver = {
    resolve:  () => { /* no external URLs in our docs */ },
    resolved: () => Promise.resolve(),
  };
  const printer = new PdfPrinter(fontDescriptors, virtualFs, urlResolver);

  const accent = opts.color || '#1F5C45';
  const dark   = '#0f1f18';

  const discount  = q.discountAmt > 0 ? q.discountAmt : (q.subtotal * (q.discountPct || 0)) / 100;
  const afterDisc = q.subtotal - discount;
  const gstAmt    = (afterDisc * (q.gstPct || 0)) / 100;
  const advAmt    = q.grandTotal * (q.advancePct || 50) / 100;

  // ── Item rows ────────────────────────────────────────────────────────────
  const itemHeader = [
    { text: '#',          fontSize: 9, bold: true, color: '#475569', fillColor: '#f1f5f9', alignment: 'center' as const },
    { text: 'DESCRIPTION',fontSize: 9, bold: true, color: '#475569', fillColor: '#f1f5f9' },
    { text: 'QTY / AREA', fontSize: 9, bold: true, color: '#475569', fillColor: '#f1f5f9', alignment: 'right' as const },
    { text: 'RATE',       fontSize: 9, bold: true, color: '#475569', fillColor: '#f1f5f9', alignment: 'right' as const },
    { text: 'AMOUNT',     fontSize: 9, bold: true, color: '#475569', fillColor: '#f1f5f9', alignment: 'right' as const },
  ];

  const itemRows = q.items.map((it, i) => [
    { text: String(i + 1).padStart(2, '0'), fontSize: 9, color: '#94a3b8', alignment: 'center' as const },
    {
      stack: [
        { text: it.description || `Item ${i + 1}`, bold: true, fontSize: 10 },
        ...(it.notes ? [{ text: it.notes, color: '#64748b', fontSize: 8, margin: [0, 2, 0, 0] as [number,number,number,number] }] : []),
      ],
    },
    { text: `${it.areaQty || 0} ${it.unit}`, fontSize: 9, alignment: 'right' as const },
    { text: fmt(it.rate || 0),               fontSize: 9, alignment: 'right' as const },
    { text: fmt(it.amount || 0),             fontSize: 10, bold: true, alignment: 'right' as const },
  ]);

  // ── Additional work ──────────────────────────────────────────────────────
  const addlContent: any[] = [];
  if (q.addlWork?.length > 0) {
    const addlHeader = [
      { text: '#',      fontSize: 9, bold: true, color: '#475569', fillColor: '#f1f5f9', alignment: 'center' as const },
      { text: 'ITEM',   fontSize: 9, bold: true, color: '#475569', fillColor: '#f1f5f9' },
      { text: 'QTY',    fontSize: 9, bold: true, color: '#475569', fillColor: '#f1f5f9', alignment: 'right' as const },
      { text: 'UNIT',   fontSize: 9, bold: true, color: '#475569', fillColor: '#f1f5f9', alignment: 'right' as const },
      { text: 'RATE',   fontSize: 9, bold: true, color: '#475569', fillColor: '#f1f5f9', alignment: 'right' as const },
      { text: 'AMOUNT', fontSize: 9, bold: true, color: '#475569', fillColor: '#f1f5f9', alignment: 'right' as const },
    ];
    const addlRows = q.addlWork.map((it, i) => [
      { text: String(i + 1).padStart(2, '0'), fontSize: 9, color: '#94a3b8', alignment: 'center' as const },
      { text: it.item, bold: true, fontSize: 9 },
      { text: String(it.qty || 0),  fontSize: 9, alignment: 'right' as const },
      { text: it.unit,              fontSize: 9, alignment: 'right' as const },
      { text: fmt(it.rate || 0),   fontSize: 9, alignment: 'right' as const },
      { text: fmt(it.amount || 0), fontSize: 9, bold: true, alignment: 'right' as const },
    ]);
    addlContent.push(
      { text: 'ADDITIONAL WORK', fontSize: 8, bold: true, color: '#94a3b8', margin: [0, 16, 0, 6] },
      { table: { headerRows: 1, widths: [22, '*', 40, 40, 55, 65], body: [addlHeader, ...addlRows] }, layout: 'lightHorizontalLines' },
    );
  }

  // ── Summary rows ─────────────────────────────────────────────────────────
  const summaryBody: any[][] = [
    [
      { text: 'Subtotal', color: '#475569', fontSize: 10 },
      { text: fmt(q.subtotal || 0), alignment: 'right', color: '#475569', fontSize: 10 },
    ],
  ];
  if (discount > 0) summaryBody.push([
    { text: `Discount${q.discountPct > 0 ? ` (${q.discountPct}%)` : ''}`, color: '#475569', fontSize: 9 },
    { text: `- ${fmt(discount)}`, alignment: 'right', color: '#ef4444', fontSize: 9 },
  ]);
  if (q.gstPct > 0) summaryBody.push([
    { text: `GST (${q.gstPct}%)`, color: '#475569', fontSize: 9 },
    { text: fmt(gstAmt), alignment: 'right', color: '#475569', fontSize: 9 },
  ]);
  summaryBody.push([
    { text: 'GRAND TOTAL', bold: true, fontSize: 12, fillColor: dark, color: '#ffffff', margin: [6, 7, 0, 7] as any },
    { text: fmt(q.grandTotal || 0), bold: true, fontSize: 12, alignment: 'right', fillColor: dark, color: accent, margin: [0, 7, 6, 7] as any },
  ]);
  summaryBody.push([
    { text: `Advance (${q.advancePct || 50}%)`, color: '#64748b', fontSize: 8 },
    { text: fmt(advAmt), alignment: 'right', color: '#64748b', fontSize: 8 },
  ]);

  // ── Document definition ──────────────────────────────────────────────────
  const docDef: any = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 55],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#1e293b' },

    content: [
      // ── Header background (stylish theme only) ────────────────────────
      ...(opts.theme === 'stylish' ? [{
        canvas: [{ type: 'rect', x: -40, y: -40, w: 595, h: 88, color: dark }],
        margin: [0, 0, 0, 0],
      }] : []),

      // ── Brand + Quote number ──────────────────────────────────────────
      {
        columns: [
          {
            stack: [
              {
                text: opts.venueName,
                fontSize: 18, bold: true,
                color: opts.theme === 'stylish' ? '#ffffff' : '#0f172a',
                margin: [0, opts.theme === 'stylish' ? -65 : 0, 0, 3] as any,
              },
              {
                text: 'Wedding & Events Venue',
                fontSize: 8,
                color: opts.theme === 'stylish' ? accent : '#64748b',
              },
            ],
          },
          {
            stack: [
              {
                text: 'QUOTATION', fontSize: 20, bold: true, alignment: 'right',
                color: opts.theme === 'stylish' ? '#ffffff' : accent,
                margin: [0, opts.theme === 'stylish' ? -65 : 0, 0, 3] as any,
              },
              { text: q.quoteNumber, fontSize: 9, alignment: 'right', color: '#94a3b8' },
            ],
          },
        ],
      },

      // Accent divider line
      {
        canvas: [{ type: 'line', x1: 0, y1: 4, x2: 515, y2: 4, lineWidth: 1.5, lineColor: accent }],
        margin: [0, opts.theme === 'stylish' ? 10 : 6, 0, 14],
      },

      // ── Client + Project + Date ───────────────────────────────────────
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'QUOTATION FOR', fontSize: 7, bold: true, color: '#94a3b8', margin: [0, 0, 0, 3] },
              { text: q.clientName, fontSize: 13, bold: true },
              ...(q.clientPhone ? [{ text: q.clientPhone, fontSize: 9, color: '#64748b', margin: [0, 2, 0, 0] }] : []),
            ],
          },
          {
            width: '*',
            stack: [
              { text: 'PROJECT', fontSize: 7, bold: true, color: '#94a3b8', margin: [0, 0, 0, 3] },
              { text: q.projectDetails || '—', fontSize: 11 },
            ],
          },
          {
            width: 120,
            stack: [
              { text: 'DATE', fontSize: 7, bold: true, color: '#94a3b8', margin: [0, 0, 0, 3] },
              { text: fmtDate(q.quoteDate), fontSize: 11 },
              { text: `Valid for ${q.validityDays} days`, fontSize: 8, color: '#64748b', margin: [0, 3, 0, 0] },
            ],
          },
        ],
        margin: [0, 0, 0, 18],
      },

      // ── Items table ───────────────────────────────────────────────────
      { text: 'ITEM DETAILS', fontSize: 8, bold: true, color: '#94a3b8', margin: [0, 0, 0, 6] },
      {
        table: { headerRows: 1, widths: [22, '*', 65, 60, 70], body: [itemHeader, ...itemRows] },
        layout: {
          hLineColor: (i: number, node: any) => i === 0 || i === node.table.body.length ? accent : '#e2e8f0',
          vLineColor: () => 'transparent',
          hLineWidth: (i: number) => (i === 0 || i === 1 ? 1.2 : 0.5),
          paddingTop:    () => 7,
          paddingBottom: () => 7,
          paddingLeft:   () => 6,
          paddingRight:  () => 6,
        },
      },

      ...addlContent,

      // ── Totals ────────────────────────────────────────────────────────
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 230,
            margin: [0, 18, 0, 0],
            table: { widths: ['*', 95], body: summaryBody },
            layout: {
              hLineColor: () => '#e2e8f0',
              vLineColor: () => 'transparent',
              paddingTop:    () => 5,
              paddingBottom: () => 5,
              paddingLeft:   () => 5,
              paddingRight:  () => 5,
            },
          },
        ],
      },

      // ── Notes / Terms ─────────────────────────────────────────────────
      ...(q.notes || q.termsText ? [
        {
          canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 0.5, lineColor: '#e2e8f0' }],
          margin: [0, 18, 0, 10],
        },
        {
          columns: [
            q.notes ? {
              width: '*',
              stack: [
                { text: 'NOTES', fontSize: 7, bold: true, color: '#94a3b8', margin: [0, 0, 0, 4] },
                { text: q.notes, fontSize: 8, color: '#475569', lineHeight: 1.5 },
              ],
            } : { text: '', width: '*' },
            q.termsText ? {
              width: '*',
              stack: [
                { text: 'TERMS & CONDITIONS', fontSize: 7, bold: true, color: '#94a3b8', margin: [0, 0, 0, 4] },
                { text: q.termsText, fontSize: 8, color: '#475569', lineHeight: 1.5 },
              ],
            } : { text: '', width: '*' },
          ],
        },
      ] : []),

      // ── Signature ─────────────────────────────────────────────────────
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 170,
            stack: [
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 140, y2: 0, lineWidth: 1, lineColor: '#334155' }], margin: [0, 28, 0, 4] },
              { text: `For ${opts.venueName}`, fontSize: 8, bold: true, color: '#334155' },
              { text: 'Authorised Signatory',  fontSize: 7, color: '#94a3b8' },
            ],
          },
        ],
        margin: [0, 22, 0, 0],
      },
    ],
  };

  // createPdfKitDocument is async in pdfmake 0.3.x
  const pdfDoc = await printer.createPdfKitDocument(docDef);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on('data',  (c: Buffer) => chunks.push(c));
    pdfDoc.on('end',   () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', (e: Error) => reject(e));
    pdfDoc.end();
  });
}
