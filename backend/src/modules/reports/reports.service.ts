/* eslint-disable @typescript-eslint/no-var-requires */
import { queryMany } from '../../lib/db';
import { AppError } from '../../middleware/error';
import { formatSource } from './helpers';

const { stringify } = require('csv-stringify/sync');

interface Column { key: string; header: string; width?: number }
interface Report { sheetName: string; columns: Column[]; rows: any[] }

// Build a "createdAt BETWEEN from..to" filter (to is inclusive of the whole day).
function dateRange(col: string, from?: string, to?: string) {
  const conditions: string[] = [];
  const params: any[] = [];
  let i = 1;
  if (from) { conditions.push(`${col} >= $${i++}::date`); params.push(from); }
  if (to)   { conditions.push(`${col} < ($${i++}::date + INTERVAL '1 day')`); params.push(to); }
  return { clause: conditions.length ? conditions.join(' AND ') : '', params };
}

// ── Leads report ──────────────────────────────────────────────────────────────
async function leadsReport(from?: string, to?: string): Promise<Report> {
  const { clause, params } = dateRange('l."createdAt"', from, to);
  const where = ['l."deletedAt" IS NULL', clause].filter(Boolean).join(' AND ');
  const rows = await queryMany<any>(
    `SELECT l.name, l."primaryPhone", l."altPhone", l.email, l.source,
            s.name AS stage, u.name AS owner, l.status, l."scoreBand", l.score,
            l."eventType", l."guestCount",
            to_char(l."eventDate", 'YYYY-MM-DD') AS "eventDate",
            l."budgetMin", l."budgetMax",
            to_char(l."createdAt", 'YYYY-MM-DD') AS "createdAt"
     FROM "Lead" l
     LEFT JOIN "Stage" s ON l."stageId" = s.id
     LEFT JOIN "User" u ON l."ownerId" = u.id
     WHERE ${where}
     ORDER BY l."createdAt" DESC`,
    params
  );
  return {
    sheetName: 'Leads',
    columns: [
      { key: 'name', header: 'Name', width: 22 },
      { key: 'primaryPhone', header: 'Phone', width: 16 },
      { key: 'altPhone', header: 'Alt Phone', width: 16 },
      { key: 'email', header: 'Email', width: 24 },
      { key: 'source', header: 'Source', width: 14 },
      { key: 'stage', header: 'Stage', width: 16 },
      { key: 'owner', header: 'Owner', width: 18 },
      { key: 'status', header: 'Status', width: 10 },
      { key: 'scoreBand', header: 'Score Band', width: 12 },
      { key: 'score', header: 'Score', width: 8 },
      { key: 'eventType', header: 'Event Type', width: 14 },
      { key: 'guestCount', header: 'Guests', width: 8 },
      { key: 'eventDate', header: 'Event Date', width: 14 },
      { key: 'budgetMin', header: 'Budget Min', width: 12 },
      { key: 'budgetMax', header: 'Budget Max', width: 12 },
      { key: 'createdAt', header: 'Created', width: 14 },
    ],
    rows: rows.map(r => ({ ...r, source: formatSource(r.source) })),
  };
}

// ── Source performance report ─────────────────────────────────────────────────
async function sourcePerformanceReport(from?: string, to?: string): Promise<Report> {
  const { clause, params } = dateRange('"createdAt"', from, to);
  const where = ['"deletedAt" IS NULL', clause].filter(Boolean).join(' AND ');
  const rows = await queryMany<any>(
    `SELECT source, COUNT(*) total, COUNT(*) FILTER (WHERE status = 'WON') bookings,
            COUNT(*) FILTER (WHERE status = 'LOST') lost
     FROM "Lead" WHERE ${where} GROUP BY source ORDER BY total DESC`,
    params
  );
  return {
    sheetName: 'Source Performance',
    columns: [
      { key: 'source', header: 'Source', width: 16 },
      { key: 'total', header: 'Total Leads', width: 12 },
      { key: 'bookings', header: 'Bookings (Won)', width: 14 },
      { key: 'lost', header: 'Lost', width: 10 },
      { key: 'winRate', header: 'Win Rate %', width: 12 },
    ],
    rows: rows.map(r => {
      const total = Number(r.total), bookings = Number(r.bookings);
      return {
        source: formatSource(r.source),
        total,
        bookings,
        lost: Number(r.lost),
        winRate: total > 0 ? Math.round((bookings / total) * 100) : 0,
      };
    }),
  };
}

// ── Calls report ──────────────────────────────────────────────────────────────
async function callsReport(from?: string, to?: string): Promise<Report> {
  const { clause, params } = dateRange('c."createdAt"', from, to);
  const where = clause || 'TRUE';
  const rows = await queryMany<any>(
    `SELECT l.name AS lead, u.name AS agent, c.direction, c.status,
            c."fromNumber", c."toNumber", c."durationSec",
            to_char(c."startedAt", 'YYYY-MM-DD HH24:MI') AS "startedAt",
            cs.summary, cs.sentiment, cs."nextAction",
            lse.score, lse.band
     FROM "Call" c
     LEFT JOIN "Lead" l ON c."leadId" = l.id
     LEFT JOIN "User" u ON c."userId" = u.id
     LEFT JOIN "CallSummary" cs ON cs."callId" = c.id
     LEFT JOIN LATERAL (
       SELECT score, band FROM "LeadScoreEvent" WHERE "callId" = c.id ORDER BY "createdAt" DESC LIMIT 1
     ) lse ON true
     WHERE ${where}
     ORDER BY c."createdAt" DESC`,
    params
  );
  return {
    sheetName: 'Calls',
    columns: [
      { key: 'lead', header: 'Lead', width: 22 },
      { key: 'agent', header: 'Agent', width: 18 },
      { key: 'direction', header: 'Direction', width: 10 },
      { key: 'status', header: 'Status', width: 12 },
      { key: 'fromNumber', header: 'From', width: 16 },
      { key: 'toNumber', header: 'To', width: 16 },
      { key: 'durationSec', header: 'Duration (s)', width: 12 },
      { key: 'startedAt', header: 'Started', width: 18 },
      { key: 'summary', header: 'AI Summary', width: 40 },
      { key: 'sentiment', header: 'Sentiment', width: 12 },
      { key: 'nextAction', header: 'Next Action', width: 28 },
      { key: 'score', header: 'Score', width: 8 },
      { key: 'band', header: 'Band', width: 10 },
    ],
    rows,
  };
}

const BUILDERS: Record<string, (from?: string, to?: string) => Promise<Report>> = {
  leads: leadsReport,
  'source-performance': sourcePerformanceReport,
  calls: callsReport,
};

export async function buildReport(key: string, filters: { from?: string; to?: string }): Promise<Report> {
  const builder = BUILDERS[key];
  if (!builder) throw new AppError(404, 'UNKNOWN_REPORT', `Unknown report: ${key}`);
  return builder(filters.from || undefined, filters.to || undefined);
}

export function toCsv(report: Report): string {
  return stringify(report.rows, {
    header: true,
    columns: report.columns.map(c => ({ key: c.key, header: c.header })),
    cast: { boolean: (v: boolean) => (v ? 'Yes' : 'No') },
  });
}

export async function toXlsx(report: Report): Promise<Buffer> {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nahata Lawns CRM';
  const ws = wb.addWorksheet(report.sheetName);
  ws.columns = report.columns.map(c => ({ header: c.header, key: c.key, width: c.width || 18 }));
  ws.addRows(report.rows);
  // Header styling
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F5C45' } };
  header.alignment = { vertical: 'middle' };
  header.height = 20;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  return (await wb.xlsx.writeBuffer()) as Buffer;
}
