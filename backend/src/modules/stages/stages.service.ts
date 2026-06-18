import { query, queryOne, queryMany } from '../../lib/db';
import { AppError } from '../../middleware/error';
import { v4 as uuidv4 } from 'uuid';

export async function getStages() {
  const stages = await queryMany<any>(
    `SELECT s.*, COUNT(l.id) FILTER (WHERE l.status = 'OPEN' AND l."deletedAt" IS NULL) as "leadCount"
     FROM "Stage" s
     LEFT JOIN "Lead" l ON s.id = l."stageId"
     WHERE s."deletedAt" IS NULL
     GROUP BY s.id
     ORDER BY s."order" ASC`
  );

  return await Promise.all(stages.map(async (s) => {
    const binding = await queryOne<any>(
      `SELECT smb.*, t.id as "template.id", t.name as "template.name", t.body as "template.body"
       FROM "StageMessageBinding" smb
       LEFT JOIN "Template" t ON smb."templateId" = t.id
       WHERE smb."stageId" = $1`,
      [s.id]
    );
    return {
      ...s,
      messageBinding: binding ? {
        id: binding.id,
        stageId: binding.stageId,
        templateId: binding.templateId,
        channel: binding.channel,
        enabled: binding.enabled,
        createdAt: binding.createdAt,
        updatedAt: binding.updatedAt,
        template: binding['template.id'] ? {
          id: binding['template.id'],
          name: binding['template.name'],
          body: binding['template.body'],
        } : null,
      } : null,
    };
  }));
}

export async function createStage(data: { name: string; color?: string; isWon?: boolean; isLost?: boolean; wipLimit?: number }) {
  const maxOrderResult = await queryOne<{ max_order: number | null }>(
    'SELECT MAX("order") as max_order FROM "Stage" WHERE "deletedAt" IS NULL'
  );
  const maxOrder = maxOrderResult?.max_order ?? 0;

  const id = uuidv4();
  const key = data.name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
  const now = new Date();

  await query(
    `INSERT INTO "Stage" (id, name, key, "order", color, "isWon", "isLost", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, data.name, key, maxOrder + 1, data.color || '#64748b', data.isWon || false, data.isLost || false, now, now]
  );

  return queryOne('SELECT * FROM "Stage" WHERE id = $1', [id]);
}

export async function updateStage(id: string, data: { name?: string; color?: string; isWon?: boolean; isLost?: boolean; wipLimit?: number }) {
  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    params.push(data.name);
  }
  if (data.color !== undefined) {
    updates.push(`color = $${paramIndex++}`);
    params.push(data.color);
  }
  if (data.isWon !== undefined) {
    updates.push(`"isWon" = $${paramIndex++}`);
    params.push(data.isWon);
  }
  if (data.isLost !== undefined) {
    updates.push(`"isLost" = $${paramIndex++}`);
    params.push(data.isLost);
  }
  if (data.wipLimit !== undefined) {
    updates.push(`"wipLimit" = $${paramIndex++}`);
    params.push(data.wipLimit);
  }

  updates.push(`"updatedAt" = $${paramIndex++}`);
  params.push(new Date());
  params.push(id);

  if (updates.length > 1) {
    await query(
      `UPDATE "Stage" SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      params
    );
  }

  return queryOne('SELECT * FROM "Stage" WHERE id = $1', [id]);
}

export async function reorderStages(orderedIds: string[]) {
  await Promise.all(orderedIds.map((id, idx) =>
    query(
      `UPDATE "Stage" SET "order" = $1, "updatedAt" = $2 WHERE id = $3`,
      [idx + 1, new Date(), id]
    )
  ));
}

export async function deleteStage(id: string) {
  const countResult = await queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM "Lead" WHERE "stageId" = $1 AND "deletedAt" IS NULL',
    [id]
  );
  const count = countResult?.count || 0;
  if (count > 0) throw new AppError(400, 'STAGE_HAS_LEADS', `This stage has ${count} leads. Reassign them first.`);

  await query(
    `UPDATE "Stage" SET "deletedAt" = $1 WHERE id = $2`,
    [new Date(), id]
  );
}

export async function getStageBinding(stageId: string) {
  return queryOne<any>(
    `SELECT smb.*, t.* as template
     FROM "StageMessageBinding" smb
     LEFT JOIN "Template" t ON smb."templateId" = t.id
     WHERE smb."stageId" = $1`,
    [stageId]
  );
}

export async function setStageBinding(stageId: string, templateId: string | null, enabled: boolean) {
  if (!templateId) {
    await query('DELETE FROM "StageMessageBinding" WHERE "stageId" = $1', [stageId]);
    return null;
  }

  const existing = await queryOne<any>(
    'SELECT * FROM "StageMessageBinding" WHERE "stageId" = $1',
    [stageId]
  );

  if (existing) {
    await query(
      `UPDATE "StageMessageBinding" SET "templateId" = $1, enabled = $2, "updatedAt" = $3 WHERE "stageId" = $4`,
      [templateId, enabled, new Date(), stageId]
    );
  } else {
    const id = uuidv4();
    const now = new Date();
    await query(
      `INSERT INTO "StageMessageBinding" (id, "stageId", "templateId", enabled, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, stageId, templateId, enabled, now, now]
    );
  }

  return queryOne<any>(
    `SELECT smb.*, t.* FROM "StageMessageBinding" smb
     LEFT JOIN "Template" t ON smb."templateId" = t.id
     WHERE smb."stageId" = $1`,
    [stageId]
  );
}
