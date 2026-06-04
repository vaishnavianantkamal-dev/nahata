import { db } from '../../lib/db';
import { getTelephonyProvider } from '../../integrations/telephony';
import { getSttProvider } from '../../integrations/stt';
import { getLlmProvider } from '../../integrations/llm';
import { AppError } from '../../middleware/error';
import { emitToLead, emitToAll } from '../../lib/socket';
import { logger } from '../../lib/logger';
import { INDIAN_PHONE_REGEX } from '@nahata/shared';

export async function clickToCall(leadId: string, userId: string) {
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new AppError(404, 'NOT_FOUND', 'Lead not found');

  // Enforce +91 only
  if (!INDIAN_PHONE_REGEX.test(lead.primaryPhone)) {
    throw new AppError(400, 'INVALID_PHONE', 'Click-to-call is for Indian (+91) numbers only');
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  const agentNumber = user?.phone || process.env.EXOTEL_CALLER_ID || '+914044444444';

  const provider = getTelephonyProvider();
  const { providerCallId } = await provider.clickToCall(agentNumber, lead.primaryPhone);

  const call = await db.call.create({
    data: {
      leadId,
      userId,
      direction: 'OUTBOUND',
      status: 'INITIATED',
      fromNumber: agentNumber,
      toNumber: lead.primaryPhone,
      providerCallId,
      consentPlayed: true,
      startedAt: new Date(),
    },
  });

  await db.activity.create({
    data: { leadId, userId, type: 'CALL_LOGGED', title: 'Outbound call initiated' },
  });

  emitToLead(leadId, 'call:status', { callId: call.id, status: 'INITIATED' });
  return call;
}

export async function processCallRecording(callId: string) {
  const call = await db.call.findUnique({ where: { id: callId }, include: { lead: true } });
  if (!call || !call.leadId) return;

  try {
    // Step 1: Get recording
    const provider = getTelephonyProvider();
    const { url: recordingUrl } = await provider.fetchRecording(call.providerCallId || callId);

    await db.call.update({ where: { id: callId }, data: { recordingUrl } });

    // Step 2: Transcribe
    const stt = getSttProvider();
    const { text: transcript, lang } = await stt.transcribe(recordingUrl);

    await db.call.update({ where: { id: callId }, data: { transcript, transcriptLang: lang } });

    // Step 3: LLM summarise & score
    const llm = getLlmProvider();
    const lead = call.lead!;
    const intelligence = await llm.summariseAndScore({
      transcript,
      lead: {
        name: lead.name,
        eventType: lead.eventType,
        guestCount: lead.guestCount || undefined,
        eventDate: lead.eventDate?.toISOString(),
        budgetMin: lead.budgetMin || undefined,
        budgetMax: lead.budgetMax || undefined,
      },
    });

    // Step 4: Persist summary + score atomically
    await db.$transaction([
      db.callSummary.create({
        data: {
          callId,
          leadId: lead.id,
          summary: intelligence.summary,
          event: intelligence.event,
          guests: intelligence.guests,
          eventDate: intelligence.eventDate,
          sentiment: intelligence.sentiment,
          objections: intelligence.objections,
          nextAction: intelligence.nextAction,
          rawModelOutput: intelligence as any,
          model: 'mock-scorer-v1',
          promptVersion: process.env.LLM_PROMPT_VERSION || 'v1',
        },
      }),
      db.leadScoreEvent.create({
        data: {
          leadId: lead.id,
          callId,
          score: intelligence.score,
          band: intelligence.band as any,
          factors: intelligence.factors as any,
          rationale: intelligence.rationale,
          suggestedAction: intelligence.nextAction,
          source: 'CALL',
          model: 'mock-scorer-v1',
        },
      }),
      db.lead.update({
        where: { id: lead.id },
        data: { score: intelligence.score, scoreBand: intelligence.band as any },
      }),
    ]);

    await db.activity.create({
      data: {
        leadId: lead.id,
        type: 'SCORE_UPDATED',
        title: `Lead scored ${intelligence.score}/100 – ${intelligence.band}`,
        description: intelligence.nextAction,
        meta: { score: intelligence.score, band: intelligence.band },
      },
    });

    emitToLead(lead.id, 'call:summary_ready', { callId, score: intelligence.score, band: intelligence.band });
    emitToAll('lead:scored', { leadId: lead.id, score: intelligence.score, band: intelligence.band });

    logger.info({ callId, leadId: lead.id, score: intelligence.score, band: intelligence.band }, 'Call AI pipeline complete');
  } catch (err) {
    logger.error({ err, callId }, 'Call AI pipeline failed');
  }
}

export async function getCalls(query: { leadId?: string; direction?: string; status?: string }) {
  return db.call.findMany({
    where: {
      leadId: query.leadId,
      direction: query.direction as any,
      status: query.status as any,
    },
    include: {
      summary: true,
      agent: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function getCall(id: string) {
  return db.call.findUnique({
    where: { id },
    include: {
      summary: true,
      scoreEvents: { orderBy: { createdAt: 'desc' } },
      agent: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true } },
    },
  });
}
