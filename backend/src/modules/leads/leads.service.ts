import { query, queryOne, queryMany } from '../../lib/db';
import { AppError } from '../../middleware/error';
import { normalizeIndianPhone } from '../../lib/helpers';
import { emitToAll, emitToLead } from '../../lib/socket';

export async function getLeads(queryParams: {
  page?: number; pageSize?: number; sort?: string; order?: string;
  stageId?: string; source?: string; ownerId?: string; status?: string;
  scoreBand?: string; eventType?: string; dateFrom?: string; dateTo?: string;
  search?: string;
}) {
  const { page = 1, pageSize = 20, sort = 'createdAt', order = 'desc' } = queryParams;
  const offset = (page - 1) * pageSize;

  let whereConditions = ['l."deletedAt" IS NULL'];
  let params: any[] = [];
  let paramIndex = 1;

  if (queryParams.stageId) {
    whereConditions.push(`l."stageId" = $${paramIndex++}`);
    params.push(queryParams.stageId);
  }
  if (queryParams.source) {
    whereConditions.push(`l.source = $${paramIndex++}`);
    params.push(queryParams.source);
  }
  if (queryParams.ownerId) {
    whereConditions.push(`l."ownerId" = $${paramIndex++}`);
    params.push(queryParams.ownerId);
  }
  if (queryParams.status) {
    whereConditions.push(`l.status = $${paramIndex++}`);
    params.push(queryParams.status);
  }
  if (queryParams.scoreBand) {
    whereConditions.push(`l."scoreBand" = $${paramIndex++}`);
    params.push(queryParams.scoreBand);
  }
  if (queryParams.eventType) {
    whereConditions.push(`l."eventType" = $${paramIndex++}`);
    params.push(queryParams.eventType);
  }
  if (queryParams.dateFrom) {
    whereConditions.push(`l."createdAt" >= $${paramIndex++}`);
    params.push(new Date(queryParams.dateFrom));
  }
  if (queryParams.dateTo) {
    whereConditions.push(`l."createdAt" <= $${paramIndex++}`);
    params.push(new Date(queryParams.dateTo));
  }
  if (queryParams.search) {
    const searchPattern = `%${queryParams.search}%`;
    whereConditions.push(`(l.name ILIKE $${paramIndex} OR l."primaryPhone" LIKE $${paramIndex + 1} OR l.email ILIKE $${paramIndex + 2})`);
    params.push(searchPattern, queryParams.search, searchPattern);
    paramIndex += 3;
  }

  const validSorts: Record<string, string> = {
    score: `score ${order || 'desc'}`,
    createdAt: `l."createdAt" ${order || 'desc'}`,
    lastContactAt: `l."lastContactAt" ${order || 'desc'}`,
    eventDate: `l."eventDate" ${order || 'asc'}`,
    name: `l.name ${order || 'asc'}`,
  };
  const orderByClause = validSorts[sort] || `l."createdAt" desc`;

  const whereSQL = whereConditions.join(' AND ');

  const dataParams = [...params, pageSize, offset];
  const dataResult = await queryMany<any>(
    `SELECT l.id, l.name, l."primaryPhone", l."altPhone", l.email, l.source, l."sourceDetail",
            l."eventType", l."guestCount", l."eventDate", l."budgetMin", l."budgetMax", l."stageId",
            l.status, l."ownerId", l.score, l."scoreBand", l."lastContactAt", l."firstResponseAt",
            l."nextFollowUpAt", l.notes, l."lostReason", l."isArchived", l."createdAt", l."updatedAt",
            s.id as "stage.id", s.name as "stage.name", s.key as "stage.key", s.color as "stage.color",
            s."isWon" as "stage.isWon", s."isLost" as "stage.isLost",
            u.id as "owner.id", u.name as "owner.name", u."avatarUrl" as "owner.avatarUrl"
     FROM "Lead" l
     LEFT JOIN "Stage" s ON l."stageId" = s.id
     LEFT JOIN "User" u ON l."ownerId" = u.id
     WHERE ${whereSQL}
     ORDER BY ${orderByClause}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    dataParams
  );

  const totalResult = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM "Lead" l WHERE ${whereSQL}`,
    params
  );

  const data = dataResult.map(row => ({
    id: row.id, name: row.name, primaryPhone: row.primaryPhone, altPhone: row.altPhone,
    email: row.email, source: row.source, sourceDetail: row.sourceDetail, eventType: row.eventType,
    guestCount: row.guestCount, eventDate: row.eventDate, budgetMin: row.budgetMin, budgetMax: row.budgetMax,
    stageId: row.stageId, status: row.status, ownerId: row.ownerId, score: row.score,
    scoreBand: row.scoreBand, lastContactAt: row.lastContactAt, firstResponseAt: row.firstResponseAt,
    nextFollowUpAt: row.nextFollowUpAt, notes: row.notes, lostReason: row.lostReason,
    isArchived: row.isArchived, createdAt: row.createdAt, updatedAt: row.updatedAt,
    stage: { id: row['stage.id'], name: row['stage.name'], key: row['stage.key'], color: row['stage.color'], isWon: row['stage.isWon'], isLost: row['stage.isLost'] },
    owner: row['owner.id'] ? { id: row['owner.id'], name: row['owner.name'], avatarUrl: row['owner.avatarUrl'] } : null,
  }));

  return { data, page, pageSize, total: totalResult?.count || 0 };
}

export async function getLead(id: string) {
  const lead = await queryOne<any>(
    'SELECT * FROM "Lead" WHERE id = $1 AND "deletedAt" IS NULL',
    [id]
  );
  if (!lead) throw new AppError(404, 'NOT_FOUND', 'Lead not found');

  const [stage, owner, messages, calls, activities, scoreEvents] = await Promise.all([
    queryOne<any>('SELECT * FROM "Stage" WHERE id = $1', [lead.stageId]),
    lead.ownerId ? queryOne<any>('SELECT id, name, "avatarUrl", email FROM "User" WHERE id = $1', [lead.ownerId]) : Promise.resolve(null),
    queryMany<any>('SELECT * FROM "Message" WHERE "leadId" = $1 ORDER BY "createdAt" DESC LIMIT 50', [id]),
    queryMany<any>(
      `SELECT c.*, cs.id as "summary.id", cs.summary, cs.event, cs.guests, cs."eventDate", cs.sentiment, cs.objections, cs."nextAction",
              u.id as "agent.id", u.name as "agent.name"
       FROM "Call" c
       LEFT JOIN "CallSummary" cs ON c.id = cs."callId"
       LEFT JOIN "User" u ON c."userId" = u.id
       WHERE c."leadId" = $1
       ORDER BY c."createdAt" DESC LIMIT 50`,
      [id]
    ),
    queryMany<any>(
      `SELECT a.*, u.id as "user.id", u.name as "user.name", u."avatarUrl" as "user.avatarUrl"
       FROM "Activity" a
       LEFT JOIN "User" u ON a."userId" = u.id
       WHERE a."leadId" = $1
       ORDER BY a."createdAt" DESC LIMIT 50`,
      [id]
    ),
    queryMany<any>('SELECT * FROM "LeadScoreEvent" WHERE "leadId" = $1 ORDER BY "createdAt" DESC LIMIT 10', [id]),
  ]);

  const callsFormatted = calls.map(c => ({
    ...c,
    summary: c['summary.id'] ? {
      id: c['summary.id'],
      summary: c.summary,
      event: c.event,
      guests: c.guests,
      eventDate: c.eventDate,
      sentiment: c.sentiment,
      objections: c.objections,
      nextAction: c.nextAction,
    } : null,
    agent: c['agent.id'] ? { id: c['agent.id'], name: c['agent.name'] } : null,
  }));

  const activitiesFormatted = activities.map(a => ({
    ...a,
    user: a['user.id'] ? { id: a['user.id'], name: a['user.name'], avatarUrl: a['user.avatarUrl'] } : null,
  }));

  return {
    ...lead,
    stage,
    owner,
    messages,
    calls: callsFormatted,
    activities: activitiesFormatted,
    scoreEvents,
  };
}

export async function createLead(data: any, createdByUserId?: string) {
  const phone = normalizeIndianPhone(data.primaryPhone);
  if (!phone) throw new AppError(400, 'INVALID_PHONE', 'Invalid Indian phone number');

  const dup = await checkDuplicate(phone);
  if (dup) return { lead: dup, isDuplicate: true };

  const defaultStage = await queryOne<any>(
    'SELECT * FROM "Stage" WHERE "isDefault" = true AND "deletedAt" IS NULL LIMIT 1'
  );
  if (!defaultStage) throw new AppError(500, 'NO_DEFAULT_STAGE', 'No default stage configured');

  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  const now = new Date();

  await query(
    `INSERT INTO "Lead" (id, name, "primaryPhone", "altPhone", email, source, "sourceDetail", "eventType",
                         "guestCount", "eventDate", "budgetMin", "budgetMax", "stageId", "ownerId", notes,
                         "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
    [
      id, data.name, phone,
      data.altPhone ? (normalizeIndianPhone(data.altPhone) || data.altPhone) : null,
      data.email, data.source || 'MANUAL', data.sourceDetail, data.eventType,
      data.guestCount, data.eventDate ? new Date(data.eventDate) : null,
      data.budgetMin, data.budgetMax, data.stageId || defaultStage.id,
      data.ownerId, data.notes, now, now,
    ]
  );

  const lead = await getLead(id);

  await query(
    `INSERT INTO "Activity" (id, "leadId", "userId", type, title, description, "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [uuidv4(), id, createdByUserId || null, 'LEAD_CREATED', 'Lead created', `Enquiry received from ${data.source || 'MANUAL'}`, now]
  );

  emitToAll('lead:created', lead);
  return { lead, isDuplicate: false };
}

export async function updateLead(id: string, data: any, userId?: string) {
  const existing = await queryOne<any>('SELECT * FROM "Lead" WHERE id = $1', [id]);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Lead not found');

  if (data.primaryPhone) {
    const phone = normalizeIndianPhone(data.primaryPhone);
    if (!phone) throw new AppError(400, 'INVALID_PHONE', 'Invalid Indian phone number');
    data.primaryPhone = phone;
  }
  if (data.eventDate) data.eventDate = new Date(data.eventDate);

  const updateFields = Object.entries(data)
    .map(([key], i) => `"${key}" = $${i + 2}`)
    .join(', ');
  const params = [id, ...Object.values(data), new Date()];
  const paramIndex = params.length;

  await query(
    `UPDATE "Lead" SET ${updateFields}, "updatedAt" = $${paramIndex} WHERE id = $1`,
    params
  );

  const lead = await getLead(id);

  const { v4: uuidv4 } = require('uuid');
  await query(
    `INSERT INTO "Activity" (id, "leadId", "userId", type, title, "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [uuidv4(), id, userId || null, 'FIELD_UPDATED', 'Lead details updated', new Date()]
  );

  emitToAll('lead:updated', lead);
  emitToLead(id, 'lead:updated', lead);
  return lead;
}

export async function moveLead(id: string, toStageId: string, userId?: string) {
  const lead = await queryOne<any>('SELECT * FROM "Lead" WHERE id = $1', [id]);
  if (!lead) throw new AppError(404, 'NOT_FOUND', 'Lead not found');

  const toStage = await queryOne<any>('SELECT * FROM "Stage" WHERE id = $1', [toStageId]);
  if (!toStage) throw new AppError(404, 'NOT_FOUND', 'Stage not found');

  const newStatus = toStage.isWon ? 'WON' : toStage.isLost ? 'LOST' : 'OPEN';
  const now = new Date();

  await query(
    `UPDATE "Lead" SET "stageId" = $1, status = $2, "lastContactAt" = $3, "updatedAt" = $4 WHERE id = $5`,
    [toStageId, newStatus, now, now, id]
  );

  const { v4: uuidv4 } = require('uuid');
  await query(
    `INSERT INTO "Activity" (id, "leadId", "userId", type, title, meta, "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      uuidv4(), id, userId || null, 'STAGE_CHANGE', `Moved to ${toStage.name}`,
      JSON.stringify({ fromStageId: lead.stageId, fromStageName: lead.stageName, toStageId, toStageName: toStage.name }),
      now,
    ]
  );

  const updated = await getLead(id);
  const leadStage = await queryOne<any>('SELECT * FROM "Stage" WHERE id = $1', [lead.stageId]);

  emitToAll('lead:stage_changed', { leadId: id, fromStageId: lead.stageId, toStageId });
  emitToLead(id, 'lead:stage_changed', updated);

  return { lead: updated, fromStage: leadStage, toStage };
}

export async function changeSource(id: string, source: string, sourceDetail: string | undefined, userId?: string) {
  const existing = await queryOne<any>('SELECT * FROM "Lead" WHERE id = $1', [id]);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Lead not found');

  const now = new Date();
  await query(
    `UPDATE "Lead" SET source = $1, "sourceDetail" = $2, "updatedAt" = $3 WHERE id = $4`,
    [source, sourceDetail, now, id]
  );

  const { v4: uuidv4 } = require('uuid');
  await query(
    `INSERT INTO "Activity" (id, "leadId", "userId", type, title, meta, "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [uuidv4(), id, userId || null, 'SOURCE_CHANGE', `Source changed to ${source}`, JSON.stringify({ fromSource: existing.source, toSource: source }), now]
  );

  const lead = await getLead(id);
  emitToAll('lead:updated', lead);
  return lead;
}

export async function assignLead(id: string, ownerId: string | null, userId?: string) {
  const now = new Date();
  await query(
    `UPDATE "Lead" SET "ownerId" = $1, "updatedAt" = $2 WHERE id = $3`,
    [ownerId, now, id]
  );

  const owner = ownerId ? await queryOne<any>('SELECT id, name FROM "User" WHERE id = $1', [ownerId]) : null;

  const { v4: uuidv4 } = require('uuid');
  await query(
    `INSERT INTO "Activity" (id, "leadId", "userId", type, title, meta, "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      uuidv4(), id, userId || null, 'ASSIGNMENT',
      ownerId ? `Assigned to ${owner?.name}` : 'Assignment removed',
      JSON.stringify({ ownerId }),
      now,
    ]
  );

  const lead = await getLead(id);
  emitToAll('lead:assigned', { leadId: id, ownerId });
  return lead;
}

export async function updateStatus(id: string, status: string, lostReason?: string, userId?: string) {
  const now = new Date();
  await query(
    `UPDATE "Lead" SET status = $1, "lostReason" = $2, "updatedAt" = $3 WHERE id = $4`,
    [status, lostReason, now, id]
  );

  const { v4: uuidv4 } = require('uuid');
  await query(
    `INSERT INTO "Activity" (id, "leadId", "userId", type, title, meta, "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [uuidv4(), id, userId || null, 'FIELD_UPDATED', `Status changed to ${status}`, JSON.stringify({ status, lostReason }), now]
  );

  const lead = await getLead(id);
  emitToAll('lead:updated', { leadId: id, status });
  return lead;
}

export async function addNote(id: string, content: string, userId?: string) {
  const { v4: uuidv4 } = require('uuid');
  const activityId = uuidv4();
  await query(
    `INSERT INTO "Activity" (id, "leadId", "userId", type, title, description, "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [activityId, id, userId || null, 'NOTE', 'Note added', content, new Date()]
  );
  return queryOne('SELECT * FROM "Activity" WHERE id = $1', [activityId]);
}

export async function getTimeline(id: string) {
  return queryMany<any>(
    `SELECT a.*, u.id as "user.id", u.name as "user.name", u."avatarUrl" as "user.avatarUrl"
     FROM "Activity" a
     LEFT JOIN "User" u ON a."userId" = u.id
     WHERE a."leadId" = $1
     ORDER BY a."createdAt" DESC
     LIMIT 100`,
    [id]
  );
}

export async function checkDuplicate(phone: string) {
  return queryOne<any>(
    'SELECT * FROM "Lead" WHERE "primaryPhone" = $1 AND "deletedAt" IS NULL',
    [phone]
  );
}

export async function getPipelineBoard(pageSize = 15) {
  const stages = await queryMany<any>(
    'SELECT * FROM "Stage" WHERE "deletedAt" IS NULL ORDER BY "order" ASC'
  );

  const columns = await Promise.all(stages.map(async (stage) => {
    const leads = await queryMany<any>(
      `SELECT l.id, l.name, l."primaryPhone", l."altPhone", l.email, l.source, l."sourceDetail",
              l."eventType", l."guestCount", l."eventDate", l."budgetMin", l."budgetMax", l."stageId",
              l.status, l."ownerId", l.score, l."scoreBand", l."lastContactAt", l."firstResponseAt",
              l."nextFollowUpAt", l.notes, l."lostReason", l."isArchived", l."createdAt", l."updatedAt",
              s.id as "stage.id", s.name as "stage.name", s.key as "stage.key", s.color as "stage.color",
              s."isWon" as "stage.isWon", s."isLost" as "stage.isLost",
              u.id as "owner.id", u.name as "owner.name", u."avatarUrl" as "owner.avatarUrl"
       FROM "Lead" l
       LEFT JOIN "Stage" s ON l."stageId" = s.id
       LEFT JOIN "User" u ON l."ownerId" = u.id
       WHERE l."stageId" = $1 AND l."deletedAt" IS NULL
       ORDER BY l.score DESC, l."createdAt" DESC
       LIMIT $2`,
      [stage.id, pageSize]
    );

    const totalResult = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM "Lead" WHERE "stageId" = $1 AND "deletedAt" IS NULL',
      [stage.id]
    );

    return {
      stage,
      leads: leads.map(row => ({
        id: row.id, name: row.name, primaryPhone: row.primaryPhone, altPhone: row.altPhone,
        email: row.email, source: row.source, sourceDetail: row.sourceDetail, eventType: row.eventType,
        guestCount: row.guestCount, eventDate: row.eventDate, budgetMin: row.budgetMin, budgetMax: row.budgetMax,
        stageId: row.stageId, status: row.status, ownerId: row.ownerId, score: row.score,
        scoreBand: row.scoreBand, lastContactAt: row.lastContactAt, firstResponseAt: row.firstResponseAt,
        nextFollowUpAt: row.nextFollowUpAt, notes: row.notes, lostReason: row.lostReason,
        isArchived: row.isArchived, createdAt: row.createdAt, updatedAt: row.updatedAt,
        stage: { id: row['stage.id'], name: row['stage.name'], key: row['stage.key'], color: row['stage.color'], isWon: row['stage.isWon'], isLost: row['stage.isLost'] },
        owner: row['owner.id'] ? { id: row['owner.id'], name: row['owner.name'], avatarUrl: row['owner.avatarUrl'] } : null,
      })),
      total: totalResult?.count || 0,
    };
  }));

  return columns;
}
