-- ── Bookings & Availability ──────────────────────────────────────────────────
-- Confirmed/tentative event bookings against a venue. Powers the calendar view,
-- availability checks and double-booking prevention. Re-runnable (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "Booking" (
  id TEXT PRIMARY KEY,
  "leadId" TEXT,
  title TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "clientPhone" TEXT,
  "eventType" "EventType" NOT NULL DEFAULT 'WEDDING',
  venue TEXT NOT NULL DEFAULT 'Main Lawn',
  "eventDate" DATE NOT NULL,
  "startTime" TEXT,
  "endTime" TEXT,
  "guestCount" INT,
  -- TENTATIVE (soft hold) | CONFIRMED (hard block) | CANCELLED
  status TEXT NOT NULL DEFAULT 'CONFIRMED',
  amount FLOAT,
  "advanceReceived" FLOAT NOT NULL DEFAULT 0,
  notes TEXT,
  color TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP,
  FOREIGN KEY ("leadId") REFERENCES "Lead"(id),
  FOREIGN KEY ("createdById") REFERENCES "User"(id)
);

CREATE INDEX IF NOT EXISTS idx_booking_eventDate ON "Booking"("eventDate");
CREATE INDEX IF NOT EXISTS idx_booking_status   ON "Booking"(status);
CREATE INDEX IF NOT EXISTS idx_booking_leadId   ON "Booking"("leadId");
CREATE INDEX IF NOT EXISTS idx_booking_venue    ON "Booking"(venue);
