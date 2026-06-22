-- ── Invoices (Proforma + Tax Invoice) ────────────────────────────────────────
-- Immutable billing documents generated from an accepted quotation, with a
-- CGST/SGST (or IGST) tax split. Payments link to an invoice via Payment.invoiceId.
-- Re-runnable (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "Invoice" (
  id TEXT PRIMARY KEY,
  "invoiceNumber" TEXT NOT NULL UNIQUE,
  -- PROFORMA | TAX_INVOICE
  type TEXT NOT NULL DEFAULT 'TAX_INVOICE',
  "quotationId" TEXT,
  "bookingId" TEXT,
  "leadId" TEXT,
  "clientName" TEXT NOT NULL,
  "clientPhone" TEXT,
  "clientGstin" TEXT,
  "clientAddress" TEXT,
  "projectDetails" TEXT,
  "issueDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  "dueDate" DATE,
  "placeOfSupply" TEXT,
  "interState" BOOLEAN NOT NULL DEFAULT false,
  subtotal FLOAT NOT NULL DEFAULT 0,
  "discountAmt" FLOAT NOT NULL DEFAULT 0,
  "taxableValue" FLOAT NOT NULL DEFAULT 0,
  "gstPct" FLOAT NOT NULL DEFAULT 0,
  "cgstAmt" FLOAT NOT NULL DEFAULT 0,
  "sgstAmt" FLOAT NOT NULL DEFAULT 0,
  "igstAmt" FLOAT NOT NULL DEFAULT 0,
  "grandTotal" FLOAT NOT NULL DEFAULT 0,
  "advancePct" INT NOT NULL DEFAULT 0,
  "amountInWords" TEXT,
  notes TEXT,
  "termsText" TEXT,
  -- UNPAID | PARTIAL | PAID | CANCELLED  (live balance is derived from payments)
  status TEXT NOT NULL DEFAULT 'UNPAID',
  "createdById" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP,
  FOREIGN KEY ("quotationId") REFERENCES "Quotation"(id),
  FOREIGN KEY ("bookingId") REFERENCES "Booking"(id),
  FOREIGN KEY ("leadId") REFERENCES "Lead"(id),
  FOREIGN KEY ("createdById") REFERENCES "User"(id)
);
CREATE INDEX IF NOT EXISTS idx_invoice_quotationId ON "Invoice"("quotationId");
CREATE INDEX IF NOT EXISTS idx_invoice_type        ON "Invoice"(type);
CREATE INDEX IF NOT EXISTS idx_invoice_status      ON "Invoice"(status);
CREATE INDEX IF NOT EXISTS idx_invoice_issueDate   ON "Invoice"("issueDate");

CREATE TABLE IF NOT EXISTS "InvoiceItem" (
  id TEXT PRIMARY KEY,
  "invoiceId" TEXT NOT NULL,
  "order" INT NOT NULL,
  description TEXT NOT NULL,
  notes TEXT,
  hsn TEXT,
  "areaQty" FLOAT NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'Nos',
  rate FLOAT NOT NULL DEFAULT 0,
  amount FLOAT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_invoiceitem_invoiceId ON "InvoiceItem"("invoiceId");

-- Link payments to invoices (and allow quotation-less invoices)
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;
ALTER TABLE "Payment" ALTER COLUMN "quotationId" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_invoiceId ON "Payment"("invoiceId");
