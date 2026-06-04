import { db } from '../../lib/db';
import { AppError } from '../../middleware/error';

export async function getStages() {
  const stages = await db.stage.findMany({
    where: { deletedAt: null },
    orderBy: { order: 'asc' },
    include: {
      _count: { select: { leads: { where: { status: 'OPEN', deletedAt: null } } } },
      messageBinding: {
        include: { template: { select: { id: true, name: true, body: true } } },
      },
    },
  });
  return stages.map(s => ({
    ...s,
    leadCount: s._count.leads,
  }));
}

export async function createStage(data: { name: string; color?: string; isWon?: boolean; isLost?: boolean; wipLimit?: number }) {
  const maxOrder = await db.stage.aggregate({ _max: { order: true }, where: { deletedAt: null } });
  return db.stage.create({
    data: {
      name: data.name,
      key: data.name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now(),
      order: (maxOrder._max.order ?? 0) + 1,
      color: data.color || '#64748b',
      isWon: data.isWon || false,
      isLost: data.isLost || false,
    },
  });
}

export async function updateStage(id: string, data: { name?: string; color?: string; isWon?: boolean; isLost?: boolean; wipLimit?: number }) {
  return db.stage.update({ where: { id }, data });
}

export async function reorderStages(orderedIds: string[]) {
  await Promise.all(orderedIds.map((id, idx) =>
    db.stage.update({ where: { id }, data: { order: idx + 1 } }),
  ));
}

export async function deleteStage(id: string) {
  const count = await db.lead.count({ where: { stageId: id, deletedAt: null } });
  if (count > 0) throw new AppError(400, 'STAGE_HAS_LEADS', `This stage has ${count} leads. Reassign them first.`);
  await db.stage.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function getStageBinding(stageId: string) {
  return db.stageMessageBinding.findUnique({
    where: { stageId },
    include: { template: true },
  });
}

export async function setStageBinding(stageId: string, templateId: string | null, enabled: boolean) {
  if (!templateId) {
    await db.stageMessageBinding.deleteMany({ where: { stageId } });
    return null;
  }
  return db.stageMessageBinding.upsert({
    where: { stageId },
    update: { templateId, enabled },
    create: { stageId, templateId, enabled },
    include: { template: true },
  });
}
