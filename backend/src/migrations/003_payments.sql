-- ── Payments & Invoice tracking ──────────────────────────────────────────────
-- Records money received against a quotation so balance-due / advance-paid can be
-- tracked, closing the revenue loop. Re-runnable (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "Payment" (
  id TEXT PRIMARY KEY,
  "quotationId" TEXT NOT NULL,
  "leadId" TEXT,
  amount FLOAT NOT NULL,
  -- CASH | UPI | BANK_TRANSFER | CHEQUE | CARD | OTHER
  method TEXT NOT NULL DEFAULT 'CASH',
  reference TEXT,
  "paidOn" DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP,
  FOREIGN KEY ("quotationId") REFERENCES "Quotation"(id) ON DELETE CASCADE,
  FOREIGN KEY ("leadId") REFERENCES "Lead"(id),
  FOREIGN KEY ("createdById") REFERENCES "User"(id)
);

CREATE INDEX IF NOT EXISTS idx_payment_quotationId ON "Payment"("quotationId");
CREATE INDEX IF NOT EXISTS idx_payment_leadId      ON "Payment"("leadId");
CREATE INDEX IF NOT EXISTS idx_payment_paidOn      ON "Payment"("paidOn");
