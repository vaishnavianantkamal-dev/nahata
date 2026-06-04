import { db } from '../../lib/db';

function getDateRange(range: string, from?: string, to?: string): { start: Date; end: Date } {
  const now = new Date();
  if (range === '7d') return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: now };
  if (range === '30d') return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: now };
  if (range === 'custom' && from && to) return { start: new Date(from), end: new Date(to) };
  // this_month
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
}

function getPrevRange(start: Date, end: Date): { start: Date; end: Date } {
  const duration = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - duration), end: new Date(start.getTime()) };
}

export async function getKpis(range = 'this_month', from?: string, to?: string) {
  const { start, end } = getDateRange(range, from, to);
  const { start: prevStart, end: prevEnd } = getPrevRange(start, end);

  // Won/Lost stages
  const wonStages = await db.stage.findMany({ where: { isWon: true, deletedAt: null } });
  const lostStages = await db.stage.findMany({ where: { isLost: true, deletedAt: null } });
  const siteVisitStage = await db.stage.findFirst({ where: { key: 'site_visit', deletedAt: null } });
  const wonStageIds = wonStages.map(s => s.id);
  const lostStageIds = lostStages.map(s => s.id);

  const [
    newLeads, prevNewLeads,
    bookings, prevBookings,
    lostInPeriod, prevLostInPeriod,
    siteVisits, prevSiteVisits,
    inPipeline,
    whatsappSent,
  ] = await Promise.all([
    db.lead.count({ where: { createdAt: { gte: start, lte: end }, deletedAt: null } }),
    db.lead.count({ where: { createdAt: { gte: prevStart, lte: prevEnd }, deletedAt: null } }),
    db.lead.count({ where: { stageId: { in: wonStageIds }, updatedAt: { gte: start, lte: end }, deletedAt: null } }),
    db.lead.count({ where: { stageId: { in: wonStageIds }, updatedAt: { gte: prevStart, lte: prevEnd }, deletedAt: null } }),
    db.lead.count({ where: { stageId: { in: lostStageIds }, updatedAt: { gte: start, lte: end }, deletedAt: null } }),
    db.lead.count({ where: { stageId: { in: lostStageIds }, updatedAt: { gte: prevStart, lte: prevEnd }, deletedAt: null } }),
    siteVisitStage ? db.activity.count({ where: { type: 'STAGE_CHANGE', meta: { path: ['toStageId'], equals: siteVisitStage.id }, createdAt: { gte: start, lte: end } } }) : Promise.resolve(0),
    siteVisitStage ? db.activity.count({ where: { type: 'STAGE_CHANGE', meta: { path: ['toStageId'], equals: siteVisitStage.id }, createdAt: { gte: prevStart, lte: prevEnd } } }) : Promise.resolve(0),
    db.lead.count({ where: { status: 'OPEN', deletedAt: null } }),
    db.message.count({ where: { direction: 'OUTBOUND', channel: 'WHATSAPP', createdAt: { gte: start, lte: end } } }),
  ]);

  const winRate = bookings + lostInPeriod > 0 ? Math.round((bookings / (bookings + lostInPeriod)) * 100) : 0;
  const prevWinRate = prevBookings + prevLostInPeriod > 0 ? Math.round((prevBookings / (prevBookings + prevLostInPeriod)) * 100) : 0;

  function delta(curr: number, prev: number) {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  }

  return {
    newLeads,
    siteVisits,
    bookings,
    winRate,
    totalEnquiries: newLeads,
    inPipeline,
    confirmed: bookings,
    whatsappSent,
    deltas: {
      newLeads: delta(newLeads, prevNewLeads),
      siteVisits: delta(siteVisits, prevSiteVisits),
      bookings: delta(bookings, prevBookings),
      winRate: winRate - prevWinRate,
    },
  };
}

export async function getEnquiriesByWeek(range = '30d', from?: string, to?: string) {
  const { start, end } = getDateRange(range, from, to);
  const leads = await db.lead.findMany({
    where: { createdAt: { gte: start, lte: end }, deletedAt: null },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  // Map: ISO week-start timestamp → count (avoids locale mutation bug)
  const weeks = new Map<number, { label: string; count: number }>();

  for (const l of leads) {
    const d = new Date(l.createdAt);
    const day = d.getDay(); // 0=Sun, 1=Mon
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7)); // always land on Monday
    monday.setHours(0, 0, 0, 0);
    const ts = monday.getTime();
    const label = monday.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    if (!weeks.has(ts)) weeks.set(ts, { label, count: 0 });
    weeks.get(ts)!.count += 1;
  }

  // Sort chronologically
  return Array.from(weeks.entries())
    .sort(([a], [b]) => a - b)
    .map(([, v]) => ({ week: v.label, count: v.count }));
}

export async function getLeadsBySource() {
  const sources = await db.lead.groupBy({
    by: ['source'],
    _count: { id: true },
    where: { deletedAt: null },
    orderBy: { _count: { id: 'desc' } },
  });

  const total = sources.reduce((s, x) => s + x._count.id, 0);

  return sources.map(s => ({
    source: s.source,
    label: formatSource(s.source),
    count: s._count.id,
    percentage: total > 0 ? Math.round((s._count.id / total) * 100) : 0,
  }));
}

export async function getConversionFunnel() {
  const stages = await db.stage.findMany({
    where: { deletedAt: null, isLost: false },
    orderBy: { order: 'asc' },
    include: { _count: { select: { leads: { where: { deletedAt: null } } } } },
  });

  const first = stages[0]?._count.leads || 1;
  return stages.map(s => ({
    stageId: s.id,
    stageName: s.name,
    stageKey: s.key,
    count: s._count.leads,
    dropoffPercent: first > 0 ? Math.round(((first - s._count.leads) / first) * 100) : 0,
  }));
}

export async function getResponseTime() {
  const leads = await db.lead.findMany({
    where: { firstResponseAt: { not: null }, deletedAt: null },
    select: { createdAt: true, firstResponseAt: true },
    take: 200,
  });

  const times = leads
    .map(l => (l.firstResponseAt!.getTime() - l.createdAt.getTime()) / 60000)
    .filter(t => t >= 0 && t < 24 * 60);

  if (times.length === 0) return { avgMinutes: 0, distribution: [] };

  const avg = Math.round(times.reduce((s, t) => s + t, 0) / times.length);
  const distribution = [
    { label: '< 5 min',    count: times.filter(t => t < 5).length },
    { label: '5–30 min',   count: times.filter(t => t >= 5 && t < 30).length },
    { label: '30–120 min', count: times.filter(t => t >= 30 && t < 120).length },
    { label: '> 2 hrs',    count: times.filter(t => t >= 120).length },
  ];

  return { avgMinutes: avg, distribution };
}

export async function getBestSource() {
  const sources = await db.lead.groupBy({
    by: ['source'],
    _count: { id: true },
    where: { deletedAt: null },
  });

  const wonStages = await db.stage.findMany({ where: { isWon: true } });
  const wonIds = wonStages.map(s => s.id);

  const results = await Promise.all(sources.map(async s => {
    const bookings = await db.lead.count({ where: { source: s.source, stageId: { in: wonIds }, deletedAt: null } });
    return {
      source: s.source,
      label: formatSource(s.source),
      total: s._count.id,
      bookings,
      winRate: s._count.id > 0 ? Math.round((bookings / s._count.id) * 100) : 0,
    };
  }));

  return results.sort((a, b) => b.winRate - a.winRate);
}

function formatSource(s: string): string {
  const m: Record<string, string> = {
    WEDMEGOOD: 'WedMeGood', JUSTDIAL: 'JustDial', GOOGLE_MAPS: 'Google Maps',
    WEBSITE: 'Website', MANUAL: 'Manual', WHATSAPP_INBOUND: 'WhatsApp',
    IVR_INBOUND: 'IVR Call', REFERRAL: 'Referral', OTHER: 'Other',
  };
  return m[s] || s;
}
