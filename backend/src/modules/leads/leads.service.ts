import { Prisma } from '@prisma/client';
import { db } from '../../lib/db';
import { AppError } from '../../middleware/error';
import { normalizeIndianPhone } from '../../lib/helpers';
import { emitToAll, emitToLead } from '../../lib/socket';

const LEAD_SELECT = {
  id: true, name: true, primaryPhone: true, altPhone: true, email: true,
  source: true, sourceDetail: true, eventType: true, guestCount: true,
  eventDate: true, budgetMin: true, budgetMax: true, stageId: true,
  status: true, ownerId: true, score: true, scoreBand: true,
  lastContactAt: true, firstResponseAt: true, nextFollowUpAt: true,
  notes: true, lostReason: true, isArchived: true, createdAt: true, updatedAt: true,
  stage: { select: { id: true, name: true, key: true, color: true, isWon: true, isLost: true } },
  owner: { select: { id: true, name: true, avatarUrl: true } },
};

export async function getLeads(query: {
  page?: number; pageSize?: number; sort?: string; order?: string;
  stageId?: string; source?: string; ownerId?: string; status?: string;
  scoreBand?: string; eventType?: string; dateFrom?: string; dateTo?: string;
  search?: string;
}) {
  const { page = 1, pageSize = 20, sort = 'createdAt', order = 'desc' } = query;
  const skip = (page - 1) * pageSize;

  const where: Prisma.LeadWhereInput = { deletedAt: null };
  if (query.stageId)    where.stageId   = query.stageId;
  if (query.source)     where.source    = query.source as any;
  if (query.ownerId)    where.ownerId   = query.ownerId;
  if (query.status)     where.status    = query.status as any;
  if (query.scoreBand)  where.scoreBand = query.scoreBand as any;
  if (query.eventType)  where.eventType = query.eventType as any;
  if (query.dateFrom || query.dateTo) {
    where.createdAt = {};
    if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
    if (query.dateTo)   where.createdAt.lte = new Date(query.dateTo);
  }
  if (query.search) {
    where.OR = [
      { name:         { contains: query.search, mode: 'insensitive' } },
      { primaryPhone: { contains: query.search } },
      { email:        { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const validSorts: Record<string, any> = {
    score: { score: order || 'desc' },
    createdAt: { createdAt: order || 'desc' },
    lastContactAt: { lastContactAt: order || 'desc' },
    eventDate: { eventDate: order || 'asc' },
    name: { name: order || 'asc' },
  };
  const orderBy = validSorts[sort] || { createdAt: 'desc' };

  const [data, total] = await Promise.all([
    db.lead.findMany({ where, select: LEAD_SELECT, orderBy, skip, take: pageSize }),
    db.lead.count({ where }),
  ]);

  return { data, page, pageSize, total };
}

export async function getLead(id: string) {
  const lead = await db.lead.findUnique({
    where: { id, deletedAt: null },
    include: {
      stage: true,
      owner: { select: { id: true, name: true, avatarUrl: true, email: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 50 },
      calls: {
        orderBy: { createdAt: 'desc' },
        include: { summary: true, agent: { select: { id: true, name: true } } },
      },
      activities: { orderBy: { createdAt: 'desc' }, take: 50, include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      scoreEvents: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });
  if (!lead) throw new AppError(404, 'NOT_FOUND', 'Lead not found');
  return lead;
}

export async function createLead(data: any, createdByUserId?: string) {
  const phone = normalizeIndianPhone(data.primaryPhone);
  if (!phone) throw new AppError(400, 'INVALID_PHONE', 'Invalid Indian phone number');

  const dup = await checkDuplicate(phone);
  if (dup) return { lead: dup, isDuplicate: true };

  const defaultStage = await db.stage.findFirst({ where: { isDefault: true, deletedAt: null } });
  if (!defaultStage) throw new AppError(500, 'NO_DEFAULT_STAGE', 'No default stage configured');

  const lead = await db.lead.create({
    data: {
      name: data.name,
      primaryPhone: phone,
      altPhone: data.altPhone ? (normalizeIndianPhone(data.altPhone) || data.altPhone) : undefined,
      email: data.email,
      source: data.source || 'MANUAL',
      sourceDetail: data.sourceDetail,
      eventType: data.eventType,
      guestCount: data.guestCount,
      eventDate: data.eventDate ? new Date(data.eventDate) : undefined,
      budgetMin: data.budgetMin,
      budgetMax: data.budgetMax,
      stageId: data.stageId || defaultStage.id,
      ownerId: data.ownerId,
      notes: data.notes,
    },
    include: { stage: true, owner: { select: { id: true, name: true } } },
  });

  await db.activity.create({
    data: {
      leadId: lead.id,
      userId: createdByUserId,
      type: 'LEAD_CREATED',
      title: 'Lead created',
      description: `Enquiry received from ${data.source || 'MANUAL'}`,
    },
  });

  emitToAll('lead:created', lead);
  return { lead, isDuplicate: false };
}

export async function updateLead(id: string, data: any, userId?: string) {
  const existing = await db.lead.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Lead not found');

  if (data.primaryPhone) {
    const phone = normalizeIndianPhone(data.primaryPhone);
    if (!phone) throw new AppError(400, 'INVALID_PHONE', 'Invalid Indian phone number');
    data.primaryPhone = phone;
  }
  if (data.eventDate) data.eventDate = new Date(data.eventDate);

  const lead = await db.lead.update({
    where: { id },
    data,
    include: { stage: true, owner: { select: { id: true, name: true } } },
  });

  await db.activity.create({
    data: { leadId: id, userId, type: 'FIELD_UPDATED', title: 'Lead details updated' },
  });

  emitToAll('lead:updated', lead);
  emitToLead(id, 'lead:updated', lead);
  return lead;
}

export async function moveLead(id: string, toStageId: string, userId?: string) {
  const lead = await db.lead.findUnique({ where: { id }, include: { stage: true } });
  if (!lead) throw new AppError(404, 'NOT_FOUND', 'Lead not found');

  const toStage = await db.stage.findUnique({ where: { id: toStageId } });
  if (!toStage) throw new AppError(404, 'NOT_FOUND', 'Stage not found');

  const updated = await db.lead.update({
    where: { id },
    data: {
      stageId: toStageId,
      status: toStage.isWon ? 'WON' : toStage.isLost ? 'LOST' : 'OPEN',
      lastContactAt: new Date(),
    },
    include: { stage: true, owner: { select: { id: true, name: true } } },
  });

  await db.activity.create({
    data: {
      leadId: id, userId, type: 'STAGE_CHANGE',
      title: `Moved to ${toStage.name}`,
      meta: { fromStageId: lead.stageId, fromStageName: lead.stage.name, toStageId, toStageName: toStage.name },
    },
  });

  emitToAll('lead:stage_changed', { leadId: id, fromStageId: lead.stageId, toStageId });
  emitToLead(id, 'lead:stage_changed', updated);

  return { lead: updated, fromStage: lead.stage, toStage };
}

export async function changeSource(id: string, source: string, sourceDetail: string | undefined, userId?: string) {
  const existing = await db.lead.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Lead not found');

  const lead = await db.lead.update({ where: { id }, data: { source: source as any, sourceDetail } });

  await db.activity.create({
    data: {
      leadId: id, userId, type: 'SOURCE_CHANGE',
      title: `Source changed to ${source}`,
      meta: { fromSource: existing.source, toSource: source },
    },
  });

  emitToAll('lead:updated', lead);
  return lead;
}

export async function assignLead(id: string, ownerId: string | null, userId?: string) {
  const lead = await db.lead.update({
    where: { id },
    data: { ownerId },
    include: { owner: { select: { id: true, name: true } } },
  });

  await db.activity.create({
    data: {
      leadId: id, userId, type: 'ASSIGNMENT',
      title: ownerId ? `Assigned to ${lead.owner?.name}` : 'Assignment removed',
      meta: { ownerId },
    },
  });

  emitToAll('lead:assigned', { leadId: id, ownerId });
  return lead;
}

export async function updateStatus(id: string, status: string, lostReason?: string, userId?: string) {
  const lead = await db.lead.update({
    where: { id },
    data: { status: status as any, lostReason },
  });

  await db.activity.create({
    data: { leadId: id, userId, type: 'FIELD_UPDATED', title: `Status changed to ${status}`, meta: { status, lostReason } },
  });

  emitToAll('lead:updated', { leadId: id, status });
  return lead;
}

export async function addNote(id: string, content: string, userId?: string) {
  return db.activity.create({
    data: {
      leadId: id, userId,
      type: 'NOTE',
      title: 'Note added',
      description: content,
    },
  });
}

export async function getTimeline(id: string) {
  return db.activity.findMany({
    where: { leadId: id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

export async function checkDuplicate(phone: string) {
  return db.lead.findFirst({
    where: { primaryPhone: phone, deletedAt: null },
    include: { stage: true },
  });
}

export async function getPipelineBoard(pageSize = 15) {
  const stages = await db.stage.findMany({
    where: { deletedAt: null },
    orderBy: { order: 'asc' },
  });

  const columns = await Promise.all(stages.map(async (stage) => {
    const [leads, total] = await Promise.all([
      db.lead.findMany({
        where: { stageId: stage.id, deletedAt: null },
        select: LEAD_SELECT,
        orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
        take: pageSize,
      }),
      db.lead.count({ where: { stageId: stage.id, deletedAt: null } }),
    ]);
    return { stage, leads, total };
  }));

  return columns;
}
