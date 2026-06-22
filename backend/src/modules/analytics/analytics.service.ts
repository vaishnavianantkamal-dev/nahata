import { queryOne, queryMany } from '../../lib/db';

// ── helpers ───────────────────────────────────────────────────────────────────
async function count(sql: string, params: any[] = []): Promise<number> {
  const row = await queryOne<{ c: string }>(sql, params);
  return Number(row?.c || 0);
}
// Same as count() but tolerates a missing table (e.g. fresh DB before migrate) → 0.
async function safeCount(sql: string, params: any[] = []): Promise<number> {
  try { return await count(sql, params); } catch { return 0; }
}
function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}
const SOURCE_LABELS: Record<string, string> = {
  WEDMEGOOD: 'WedMeGood', JUSTDIAL: 'JustDial', GOOGLE_MAPS: 'Google Maps', WEBSITE: 'Website',
  MANUAL: 'Manual', WHATSAPP_INBOUND: 'WhatsApp', IVR_INBOUND: 'IVR Call', REFERRAL: 'Referral', OTHER: 'Other',
};

function monthBounds() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  return {
    startThis: new Date(y, m, 1),
    startNext: new Date(y, m + 1, 1),
    startPrev: new Date(y, m - 1, 1),
  };
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
export async function getKpis() {
  const { startThis, startNext, startPrev } = monthBounds();

  // New leads — this vs last month
  const newLeads = await count('SELECT COUNT(*) c FROM "Lead" WHERE "deletedAt" IS NULL AND "createdAt" >= $1 AND "createdAt" < $2', [startThis, startNext]);
  const newLeadsPrev = await count('SELECT COUNT(*) c FROM "Lead" WHERE "deletedAt" IS NULL AND "createdAt" >= $1 AND "createdAt" < $2', [startPrev, startThis]);

  // Site visits scheduled — stage-change activities into the Site Visit stage
  const siteStage = await queryOne<{ id: string }>(`SELECT id FROM "Stage" WHERE key = 'site_visit' AND "deletedAt" IS NULL`);
  let siteVisits = 0, siteVisitsPrev = 0;
  if (siteStage) {
    siteVisits = await count(`SELECT COUNT(*) c FROM "Activity" WHERE type = 'STAGE_CHANGE' AND meta->>'toStageId' = $1 AND "createdAt" >= $2 AND "createdAt" < $3`, [siteStage.id, startThis, startNext]);
    siteVisitsPrev = await count(`SELECT COUNT(*) c FROM "Activity" WHERE type = 'STAGE_CHANGE' AND meta->>'toStageId' = $1 AND "createdAt" >= $2 AND "createdAt" < $3`, [siteStage.id, startPrev, startThis]);
  }

  // Confirmed bookings — this vs last month
  const bookings = await safeCount(`SELECT COUNT(*) c FROM "Booking" WHERE "deletedAt" IS NULL AND status = 'CONFIRMED' AND "createdAt" >= $1 AND "createdAt" < $2`, [startThis, startNext]);
  const bookingsPrev = await safeCount(`SELECT COUNT(*) c FROM "Booking" WHERE "deletedAt" IS NULL AND status = 'CONFIRMED' AND "createdAt" >= $1 AND "createdAt" < $2`, [startPrev, startThis]);

  // Win rate — all-time (won / closed), plus per-month for the delta
  const allTime = await queryOne<{ won: string; closed: string }>(`SELECT COUNT(*) FILTER (WHERE status = 'WON') won, COUNT(*) FILTER (WHERE status IN ('WON','LOST')) closed FROM "Lead" WHERE "deletedAt" IS NULL`);
  const winRate = Number(allTime?.closed || 0) > 0 ? Math.round((Number(allTime!.won) / Number(allTime!.closed)) * 100) : 0;
  const wrMonth = async (a: Date, b: Date) => {
    const r = await queryOne<{ won: string; closed: string }>(`SELECT COUNT(*) FILTER (WHERE status = 'WON') won, COUNT(*) FILTER (WHERE status IN ('WON','LOST')) closed FROM "Lead" WHERE "deletedAt" IS NULL AND "createdAt" >= $1 AND "createdAt" < $2`, [a, b]);
    return Number(r?.closed || 0) > 0 ? (Number(r!.won) / Number(r!.closed)) * 100 : 0;
  };
  const winRateDelta = Math.round((await wrMonth(startThis, startNext)) - (await wrMonth(startPrev, startThis)));

  // Row B — snapshots
  const totalEnquiries = await count('SELECT COUNT(*) c FROM "Lead" WHERE "deletedAt" IS NULL');
  const inPipeline = await count(`SELECT COUNT(*) c FROM "Lead" WHERE "deletedAt" IS NULL AND status = 'OPEN'`);
  const confirmed = await count(`SELECT COUNT(*) c FROM "Lead" WHERE "deletedAt" IS NULL AND status = 'WON'`);
  const whatsappSent = await safeCount(`SELECT COUNT(*) c FROM "Message" WHERE direction = 'OUTBOUND' AND channel = 'WHATSAPP' AND "createdAt" >= $1 AND "createdAt" < $2`, [startThis, startNext]);

  return {
    newLeads, siteVisits, bookings, winRate,
    totalEnquiries, inPipeline, confirmed, whatsappSent,
    deltas: {
      newLeads: pctChange(newLeads, newLeadsPrev),
      siteVisits: pctChange(siteVisits, siteVisitsPrev),
      bookings: pctChange(bookings, bookingsPrev),
      winRate: winRateDelta,
    },
  };
}

// ── Enquiries by week (last 5 weeks, Monday-aligned) ──────────────────────────
export async function getEnquiriesByWeek() {
  const weekStart = (d: Date) => {
    const x = new Date(d); x.setHours(0, 0, 0, 0);
    const day = (x.getDay() + 6) % 7; // 0 = Monday
    x.setDate(x.getDate() - day);
    return x;
  };
  const thisWeek = weekStart(new Date());
  const buckets: { start: Date; end: Date; week: string }[] = [];
  for (let i = 4; i >= 0; i--) {
    const start = new Date(thisWeek); start.setDate(start.getDate() - i * 7);
    const end = new Date(start); end.setDate(end.getDate() + 7);
    buckets.push({ start, end, week: start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) });
  }

  // Count each bucket by explicit [start, end) bounds — avoids any timezone/key mismatch.
  const counts = await Promise.all(buckets.map(b =>
    count('SELECT COUNT(*) c FROM "Lead" WHERE "deletedAt" IS NULL AND "createdAt" >= $1 AND "createdAt" < $2', [b.start, b.end])
  ));
  return buckets.map((b, i) => ({ week: b.week, count: counts[i] }));
}

// ── Leads by source ───────────────────────────────────────────────────────────
export async function getLeadsBySource() {
  const rows = await queryMany<{ source: string; c: string }>(
    `SELECT source, COUNT(*) c FROM "Lead" WHERE "deletedAt" IS NULL GROUP BY source ORDER BY c DESC`
  );
  const total = rows.reduce((s, r) => s + Number(r.c), 0) || 1;
  return rows.map(r => ({
    source: r.source,
    count: Number(r.c),
    percentage: Math.round((Number(r.c) / total) * 100),
  }));
}

// ── Conversion funnel (leads that reached each non-lost stage) ────────────────
export async function getConversionFunnel() {
  const stages = await queryMany<{ id: string; name: string; order: number }>(
    `SELECT id, name, "order" FROM "Stage" WHERE "deletedAt" IS NULL AND "isLost" = false ORDER BY "order" ASC`
  );
  if (stages.length === 0) return [];

  // Count of leads currently sitting at each (non-lost) stage order
  const counts = await queryMany<{ ord: number; c: string }>(
    `SELECT s."order" ord, COUNT(*) c
     FROM "Lead" l JOIN "Stage" s ON l."stageId" = s.id
     WHERE l."deletedAt" IS NULL AND s."isLost" = false
     GROUP BY s."order"`
  );
  const atOrder = (o: number) => counts.filter(c => Number(c.ord) >= o).reduce((s, c) => s + Number(c.c), 0);

  let prev = 0;
  return stages.map((st, i) => {
    const reached = atOrder(st.order);
    const dropoffPercent = i === 0 || prev === 0 ? 0 : Math.round((1 - reached / prev) * 100);
    prev = reached;
    return { stageId: st.id, stageName: st.name, count: reached, dropoffPercent };
  });
}

// ── Average first-response time (minutes) ─────────────────────────────────────
export async function getResponseTime() {
  const row = await queryOne<{ m: string }>(
    `SELECT AVG(EXTRACT(EPOCH FROM ("firstResponseAt" - "createdAt")) / 60) m
     FROM "Lead" WHERE "deletedAt" IS NULL AND "firstResponseAt" IS NOT NULL`
  );
  return row?.m ? Math.round(Number(row.m)) : 0;
}

// ── Source performance (win rate per source) ──────────────────────────────────
export async function getBestSource() {
  const rows = await queryMany<{ source: string; total: string; bookings: string }>(
    `SELECT source, COUNT(*) total, COUNT(*) FILTER (WHERE status = 'WON') bookings
     FROM "Lead" WHERE "deletedAt" IS NULL GROUP BY source`
  );
  return rows
    .map(r => {
      const total = Number(r.total), bookings = Number(r.bookings);
      return {
        source: r.source,
        label: SOURCE_LABELS[r.source] || r.source,
        total,
        bookings,
        winRate: total > 0 ? Math.round((bookings / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.winRate - a.winRate || b.bookings - a.bookings || b.total - a.total);
}
