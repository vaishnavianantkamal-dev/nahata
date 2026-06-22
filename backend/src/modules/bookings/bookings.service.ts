import { query, queryOne, queryMany } from '../../lib/db';
import { AppError } from '../../middleware/error';
import { emitToAll } from '../../lib/socket';

const VALID_STATUSES = ['TENTATIVE', 'CONFIRMED', 'CANCELLED'] as const;
type BookingStatus = (typeof VALID_STATUSES)[number];

// Columns a client is allowed to set/update — guards the dynamic UPDATE builder.
const UPDATABLE_FIELDS = new Set([
  'leadId', 'title', 'clientName', 'clientPhone', 'eventType', 'venue',
  'eventDate', 'startTime', 'endTime', 'guestCount', 'status', 'amount',
  'advanceReceived', 'notes', 'color',
]);

const SELECT_BOOKING = `
  SELECT b.id, b."leadId", b.title, b."clientName", b."clientPhone", b."eventType",
         b.venue, to_char(b."eventDate", 'YYYY-MM-DD') as "eventDate",
         b."startTime", b."endTime", b."guestCount", b.status, b.amount,
         b."advanceReceived", b.notes, b.color, b."createdById",
         b."createdAt", b."updatedAt",
         l.name as "lead.name", l."stageId" as "lead.stageId", l."scoreBand" as "lead.scoreBand"
  FROM "Booking" b
  LEFT JOIN "Lead" l ON b."leadId" = l.id
`;

function shapeBooking(row: any) {
  if (!row) return row;
  const { ['lead.name']: ln, ['lead.stageId']: ls, ['lead.scoreBand']: lb, ...rest } = row;
  return {
    ...rest,
    lead: row['lead.name'] ? { id: row.leadId, name: ln, stageId: ls, scoreBand: lb } : null,
  };
}

async function fetchBooking(id: string) {
  const row = await queryOne<any>(`${SELECT_BOOKING} WHERE b.id = $1 AND b."deletedAt" IS NULL`, [id]);
  return row ? shapeBooking(row) : null;
}

/**
 * Returns CONFIRMED + TENTATIVE bookings that already sit on a given date/venue.
 * A date is "available" when there is no CONFIRMED booking on it (tentative holds
 * do not block — they only warn). `excludeId` lets edits ignore themselves.
 */
export async function checkAvailability(date: string, venue = 'Main Lawn', excludeId?: string) {
  if (!date) throw new AppError(400, 'BAD_REQUEST', 'A date is required');

  const params: any[] = [date, venue];
  let exclude = '';
  if (excludeId) { params.push(excludeId); exclude = ` AND b.id <> $${params.length}`; }

  const rows = await queryMany<any>(
    `${SELECT_BOOKING}
     WHERE b."eventDate" = $1::date AND b.venue = $2
       AND b.status <> 'CANCELLED' AND b."deletedAt" IS NULL${exclude}
     ORDER BY b.status ASC, b."startTime" ASC NULLS FIRST`,
    params
  );

  const shaped = rows.map(shapeBooking);
  const confirmed = shaped.filter(b => b.status === 'CONFIRMED');
  const tentative = shaped.filter(b => b.status === 'TENTATIVE');

  return { date, venue, available: confirmed.length === 0, confirmed, tentative };
}

// Internal guard reused by create + update. Throws on a confirmed clash.
async function assertNoDoubleBooking(date: string, venue: string, excludeId?: string) {
  const { confirmed } = await checkAvailability(date, venue, excludeId);
  if (confirmed.length > 0) {
    throw new AppError(409, 'DOUBLE_BOOKING',
      `${venue} is already booked on ${date} for "${confirmed[0].title}".`,
      { conflicts: confirmed });
  }
}

export async function getBookings(params: {
  from?: string; to?: string; venue?: string; status?: string; leadId?: string;
}) {
  const conditions = ['b."deletedAt" IS NULL'];
  const values: any[] = [];
  let i = 1;

  if (params.from)   { conditions.push(`b."eventDate" >= $${i++}::date`); values.push(params.from); }
  if (params.to)     { conditions.push(`b."eventDate" <= $${i++}::date`); values.push(params.to); }
  if (params.venue)  { conditions.push(`b.venue = $${i++}`);              values.push(params.venue); }
  if (params.status) { conditions.push(`b.status = $${i++}`);            values.push(params.status); }
  if (params.leadId) { conditions.push(`b."leadId" = $${i++}`);          values.push(params.leadId); }

  const rows = await queryMany<any>(
    `${SELECT_BOOKING} WHERE ${conditions.join(' AND ')} ORDER BY b."eventDate" ASC, b."startTime" ASC NULLS FIRST`,
    values
  );
  return rows.map(shapeBooking);
}

export async function getBooking(id: string) {
  const booking = await fetchBooking(id);
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  return booking;
}

/**
 * Month calendar feed: confirmed/tentative bookings for the month PLUS the
 * enquiry event-dates pulled (read-only) from open leads, so the venue owner
 * can see demand and commitments on one grid. `month` = 'YYYY-MM'.
 */
export async function getCalendar(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month || '')) {
    throw new AppError(400, 'BAD_REQUEST', 'month must be in YYYY-MM format');
  }
  const [y, m] = month.split('-').map(Number);
  const monthStart = `${month}-01`;
  const nextMonth  = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

  const bookings = await queryMany<any>(
    `${SELECT_BOOKING}
     WHERE b."deletedAt" IS NULL AND b."eventDate" >= $1::date AND b."eventDate" < $2::date
     ORDER BY b."eventDate" ASC, b."startTime" ASC NULLS FIRST`,
    [monthStart, nextMonth]
  );

  const enquiries = await queryMany<any>(
    `SELECT id, name, "eventType", "scoreBand", "stageId",
            to_char("eventDate", 'YYYY-MM-DD') as "eventDate"
     FROM "Lead"
     WHERE "deletedAt" IS NULL AND status = 'OPEN' AND "eventDate" IS NOT NULL
       AND "eventDate" >= $1::date AND "eventDate" < $2::date
     ORDER BY "eventDate" ASC`,
    [monthStart, nextMonth]
  );

  return { month, bookings: bookings.map(shapeBooking), enquiries };
}

export async function createBooking(data: any, createdById?: string) {
  const eventDate = (data.eventDate || '').slice(0, 10);
  if (!eventDate) throw new AppError(400, 'BAD_REQUEST', 'eventDate is required');

  const status: BookingStatus = data.status || 'CONFIRMED';
  if (!VALID_STATUSES.includes(status)) {
    throw new AppError(400, 'BAD_REQUEST', `status must be one of ${VALID_STATUSES.join(', ')}`);
  }
  const venue = data.venue?.trim() || 'Main Lawn';

  // Pull client details from the linked lead when not explicitly supplied.
  let clientName = data.clientName?.trim();
  let clientPhone = data.clientPhone?.trim() || null;
  let eventType = data.eventType;
  if (data.leadId) {
    const lead = await queryOne<any>('SELECT * FROM "Lead" WHERE id = $1 AND "deletedAt" IS NULL', [data.leadId]);
    if (!lead) throw new AppError(404, 'NOT_FOUND', 'Linked lead not found');
    clientName  = clientName  || lead.name;
    clientPhone = clientPhone || lead.primaryPhone;
    eventType   = eventType   || lead.eventType;
  }
  if (!clientName) throw new AppError(400, 'BAD_REQUEST', 'clientName is required');

  if (status === 'CONFIRMED') await assertNoDoubleBooking(eventDate, venue);

  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  const now = new Date();
  const title = data.title?.trim() || `${clientName} — ${eventType || 'Event'}`;

  await query(
    `INSERT INTO "Booking" (id, "leadId", title, "clientName", "clientPhone", "eventType", venue,
                            "eventDate", "startTime", "endTime", "guestCount", status, amount,
                            "advanceReceived", notes, color, "createdById", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
    [
      id, data.leadId || null, title, clientName, clientPhone, eventType || 'WEDDING', venue,
      eventDate, data.startTime || null, data.endTime || null,
      data.guestCount != null ? parseInt(data.guestCount) : null,
      status, data.amount != null ? Number(data.amount) : null,
      data.advanceReceived != null ? Number(data.advanceReceived) : 0,
      data.notes || null, data.color || null, createdById || null, now, now,
    ]
  );

  const booking = await fetchBooking(id);
  emitToAll('booking:created', booking);
  return booking;
}

export async function updateBooking(id: string, data: any, _userId?: string) {
  // fetchBooking returns eventDate as a 'YYYY-MM-DD' string (via to_char) — avoids TZ drift.
  const existing = await fetchBooking(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Booking not found');

  if (data.status && !VALID_STATUSES.includes(data.status)) {
    throw new AppError(400, 'BAD_REQUEST', `status must be one of ${VALID_STATUSES.join(', ')}`);
  }

  // Effective values after the patch — used for the double-booking guard.
  const nextStatus = (data.status || existing.status) as string;
  const nextDate   = (data.eventDate ? String(data.eventDate).slice(0, 10) : null) || existing.eventDate;
  const nextVenue  = data.venue?.trim() || existing.venue;

  if (nextStatus === 'CONFIRMED') await assertNoDoubleBooking(nextDate, nextVenue, id);

  const sets: string[] = [];
  const values: any[] = [id];
  let i = 2;
  for (const [key, value] of Object.entries(data)) {
    if (!UPDATABLE_FIELDS.has(key)) continue;
    let v: any = value;
    if (key === 'eventDate' && v) v = String(v).slice(0, 10);
    if (key === 'guestCount') v = v != null && v !== '' ? parseInt(v as any) : null;
    if (key === 'amount') v = v != null && v !== '' ? Number(v) : null;
    if (key === 'advanceReceived') v = v != null && v !== '' ? Number(v) : 0;
    if (key === 'venue') v = (v as string)?.trim() || 'Main Lawn';
    sets.push(`"${key}" = $${i++}`);
    values.push(v);
  }

  if (sets.length > 0) {
    values.push(new Date());
    await query(`UPDATE "Booking" SET ${sets.join(', ')}, "updatedAt" = $${i} WHERE id = $1`, values);
  }

  const booking = await fetchBooking(id);
  emitToAll('booking:updated', booking);
  return booking;
}

export async function updateStatus(id: string, status: string) {
  return updateBooking(id, { status });
}

export async function deleteBooking(id: string) {
  const existing = await queryOne<any>('SELECT * FROM "Booking" WHERE id = $1', [id]);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  const now = new Date();
  await query('UPDATE "Booking" SET "deletedAt" = $1, "updatedAt" = $2 WHERE id = $3', [now, now, id]);
  emitToAll('booking:deleted', { id });
  return { success: true };
}
