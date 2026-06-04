import { db } from '../../lib/db';
import { getWhatsAppProvider } from '../../integrations/whatsapp';
import { emitToLead, emitToAll } from '../../lib/socket';
import { logger } from '../../lib/logger';

function renderTemplate(body: string, lead: any): string {
  return body
    .replace(/\{Name\}/g, lead.name || 'Guest')
    .replace(/\{Date\}/g, lead.eventDate ? new Date(lead.eventDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'your event date')
    .replace(/\{GuestCount\}/g, lead.guestCount ? String(lead.guestCount) : 'your guest count')
    .replace(/\{EventType\}/g, formatEventType(lead.eventType))
    .replace(/\{VenueName\}/g, 'Nahata Lawns')
    .replace(/\{OwnerName\}/g, lead.owner?.name || 'our team');
}

function formatEventType(et?: string): string {
  if (!et) return 'event';
  return et.charAt(0) + et.slice(1).toLowerCase();
}

export async function sendWhatsApp(leadId: string, opts: {
  templateId?: string;
  body?: string;
  variables?: Record<string, string>;
  trigger?: string;
  userId?: string;
}): Promise<any> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: { owner: { select: { name: true } } },
  });
  if (!lead) throw new Error('Lead not found');

  let renderedBody = opts.body || '';
  let templateId = opts.templateId;

  if (templateId) {
    const tpl = await db.template.findUnique({ where: { id: templateId } });
    if (!tpl) throw new Error('Template not found');
    renderedBody = renderTemplate(tpl.body, lead);
  }

  if (!renderedBody) throw new Error('No message body');

  const provider = getWhatsAppProvider();
  let providerMessageId: string;

  try {
    const result = await provider.sendText(lead.primaryPhone, renderedBody);
    providerMessageId = result.providerMessageId;
  } catch (err) {
    logger.error({ err, leadId }, 'WhatsApp send failed');
    providerMessageId = 'FAILED';
  }

  const message = await db.message.create({
    data: {
      leadId,
      userId: opts.userId,
      direction: 'OUTBOUND',
      channel: 'WHATSAPP',
      status: providerMessageId === 'FAILED' ? 'FAILED' : 'SENT',
      body: renderedBody,
      templateId,
      trigger: opts.trigger as any,
      providerMessageId,
      sentAt: new Date(),
    },
  });

  await db.lead.update({ where: { id: leadId }, data: { lastContactAt: new Date() } });

  await db.activity.create({
    data: {
      leadId,
      userId: opts.userId,
      type: 'WHATSAPP_SENT',
      title: 'WhatsApp message sent',
      description: renderedBody.slice(0, 120),
    },
  });

  emitToLead(leadId, 'message:status', message);
  emitToAll('kpi:tick', { event: 'whatsapp_sent' });

  return message;
}

export async function fireLeadCreatedAutomation(leadId: string) {
  try {
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      include: { stage: { include: { messageBinding: { include: { template: true } } } } },
    });
    if (!lead) return;

    // Send the stage binding template (New Lead stage)
    const binding = lead.stage.messageBinding;
    if (binding?.enabled && binding.template) {
      await sendWhatsApp(leadId, { templateId: binding.templateId, trigger: 'LEAD_CREATED' });
    }

    // Enroll in the "New Enquiry Nurture" sequence
    const seq = await db.sequence.findFirst({ where: { name: 'New Enquiry Nurture', isActive: true } });
    if (seq) {
      await enrollInSequence(leadId, seq.id);
    }

    // Update firstResponseAt
    await db.lead.update({ where: { id: leadId }, data: { firstResponseAt: new Date() } });
  } catch (err) {
    logger.error({ err, leadId }, 'Lead created automation failed');
  }
}

export async function fireStageAutomation(leadId: string, toStageId: string) {
  try {
    const binding = await db.stageMessageBinding.findUnique({
      where: { stageId: toStageId },
      include: { template: true },
    });

    if (binding?.enabled && binding.template) {
      await sendWhatsApp(leadId, { templateId: binding.templateId, trigger: 'STAGE_CHANGED' });
    }
  } catch (err) {
    logger.error({ err, leadId, toStageId }, 'Stage automation failed');
  }
}

export async function enrollInSequence(leadId: string, sequenceId: string) {
  const existing = await db.sequenceEnrollment.findFirst({
    where: { leadId, sequenceId, status: 'active' },
  });
  if (existing) return existing;

  const seq = await db.sequence.findUnique({ where: { id: sequenceId }, include: { steps: { orderBy: { order: 'asc' } } } });
  if (!seq || !seq.isActive) return null;

  const enrollment = await db.sequenceEnrollment.create({
    data: { leadId, sequenceId, status: 'active', currentStepOrder: 0, enrolledAt: new Date() },
  });

  // Schedule all steps
  for (const step of seq.steps) {
    const scheduledFor = new Date(Date.now() + step.delayMinutes * 60 * 1000);
    await db.scheduledMessage.create({
      data: {
        leadId,
        enrollmentId: enrollment.id,
        templateId: step.templateId,
        channel: 'WHATSAPP',
        scheduledFor,
        status: 'PENDING',
      },
    });
  }

  await db.activity.create({
    data: {
      leadId,
      type: 'FOLLOWUP_SCHEDULED',
      title: `Enrolled in sequence: ${seq.name}`,
      description: `${seq.steps.length} follow-up steps scheduled`,
    },
  });

  return enrollment;
}

export async function stopEnrollment(enrollmentId: string, reason: string) {
  const enrollment = await db.sequenceEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment || enrollment.status !== 'active') return;

  await db.sequenceEnrollment.update({
    where: { id: enrollmentId },
    data: { status: 'stopped', stoppedAt: new Date(), stopReason: reason },
  });

  // Cancel pending scheduled messages
  await db.scheduledMessage.updateMany({
    where: { enrollmentId, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  });
}

export async function stopAllEnrollmentsForLead(leadId: string, reason: string) {
  const enrollments = await db.sequenceEnrollment.findMany({
    where: { leadId, status: 'active' },
  });
  for (const e of enrollments) {
    await stopEnrollment(e.id, reason);
  }
}

export async function getConversation(leadId: string) {
  return db.message.findMany({
    where: { leadId },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
}
