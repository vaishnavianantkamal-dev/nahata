import { query, queryOne, queryMany, transaction } from '../../lib/db';
import { getTelephonyProvider } from '../../integrations/telephony';
import { getSttProvider } from '../../integrations/stt';
import { getLlmProvider } from '../../integrations/llm';
import { AppError } from '../../middleware/error';
import { emitToLead, emitToAll } from '../../lib/socket';
import { logger } from '../../lib/logger';
import { INDIAN_PHONE_REGEX } from '../../lib/helpers';
import { v4 as uuidv4 } from 'uuid';

export async function clickToCall(leadId: string, userId: string) {
  const lead = await queryOne<any>(
    'SELECT * FROM "Lead" WHERE id = $1',
    [leadId]
  );
  if (!lead) throw new AppError(404, 'NOT_FOUND', 'Lead not found');

  if (!INDIAN_PHONE_REGEX.test(lead.primaryPhone)) {
    throw new AppError(400, 'INVALID_PHONE', 'Click-to-call is for Indian (+91) numbers only');
  }

  const user = await queryOne<any>(
    'SELECT * FROM "User" WHERE id = $1',
    [userId]
  );
  const agentNumber = user?.phone || process.env.EXOTEL_CALLER_ID || '+914044444444';

  const provider = getTelephonyProvider();
  const { providerCallId } = await provider.clickToCall(agentNumber, lead.primaryPhone);

  const callId = uuidv4();
  const now = new Date();

  await query(
    `INSERT INTO "Call" (id, "leadId", "userId", direction, status, "fromNumber", "toNumber", "providerCallId", "consentPlayed", "startedAt", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [callId, leadId, userId, 'OUTBOUND', 'INITIATED', agentNumber, lead.primaryPhone, providerCallId, true, now, now, now]
  );

  await query(
    `INSERT INTO "Activity" (id, "leadId", "userId", type, title, "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [uuidv4(), leadId, userId, 'CALL_LOGGED', 'Outbound call initiated', now]
  );

  emitToLead(leadId, 'call:status', { callId, status: 'INITIATED' });

  return queryOne<any>('SELECT * FROM "Call" WHERE id = $1', [callId]);
}

export async function processCallRecording(callId: string) {
  const call = await queryOne<any>(
    'SELECT * FROM "Call" WHERE id = $1',
    [callId]
  );
  if (!call || !call.leadId) return;

  try {
    const lead = await queryOne<any>(
      'SELECT * FROM "Lead" WHERE id = $1',
      [call.leadId]
    );

    // Step 1: Get recording
    const provider = getTelephonyProvider();
    const { url: recordingUrl } = await provider.fetchRecording(call.providerCallId || callId);

    await query(
      'UPDATE "Call" SET "recordingUrl" = $1, "updatedAt" = $2 WHERE id = $3',
      [recordingUrl, new Date(), callId]
    );

    // Step 2: Transcribe
    const stt = getSttProvider();
    const { text: transcript, lang } = await stt.transcribe(recordingUrl);

    await query(
      'UPDATE "Call" SET transcript = $1, "transcriptLang" = $2, "updatedAt" = $3 WHERE id = $4',
      [transcript, lang, new Date(), callId]
    );

    // Step 3: LLM summarise & score
    const llm = getLlmProvider();
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
    const now = new Date();
    await transaction(async () => {
      await query(
        `INSERT INTO "CallSummary" (id, "callId", "leadId", summary, event, guests, "eventDate", sentiment, objections, "nextAction", "rawModelOutput", model, "promptVersion", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          uuidv4(), callId, lead.id, intelligence.summary, intelligence.event, intelligence.guests,
          intelligence.eventDate, intelligence.sentiment, intelligence.objections, intelligence.nextAction,
          JSON.stringify(intelligence), 'mock-scorer-v1', process.env.LLM_PROMPT_VERSION || 'v1', now, now,
        ]
      );

      await query(
        `INSERT INTO "LeadScoreEvent" (id, "leadId", "callId", score, band, factors, rationale, "suggestedAction", source, model, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          uuidv4(), lead.id, callId, intelligence.score, intelligence.band, JSON.stringify(intelligence.factors),
          intelligence.rationale, intelligence.nextAction, 'CALL', 'mock-scorer-v1', now,
        ]
      );

      await query(
        'UPDATE "Lead" SET score = $1, "scoreBand" = $2, "updatedAt" = $3 WHERE id = $4',
        [intelligence.score, intelligence.band, now, lead.id]
      );
    });

    await query(
      `INSERT INTO "Activity" (id, "leadId", type, title, description, meta, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        uuidv4(), lead.id, 'SCORE_UPDATED',
        `Lead scored ${intelligence.score}/100 – ${intelligence.band}`,
        intelligence.nextAction,
        JSON.stringify({ score: intelligence.score, band: intelligence.band }),
        now,
      ]
    );

    emitToLead(lead.id, 'call:summary_ready', { callId, score: intelligence.score, band: intelligence.band });
    emitToAll('lead:scored', { leadId: lead.id, score: intelligence.score, band: intelligence.band });

    logger.info({ callId, leadId: lead.id, score: intelligence.score, band: intelligence.band }, 'Call AI pipeline complete');
  } catch (err) {
    logger.error({ err, callId }, 'Call AI pipeline failed');
  }
}

export async function getCalls(queryParams: { leadId?: string; direction?: string; status?: string }) {
  let conditions = [];
  let params: any[] = [];
  let paramIndex = 1;

  if (queryParams.leadId) {
    conditions.push(`c."leadId" = $${paramIndex++}`);
    params.push(queryParams.leadId);
  }
  if (queryParams.direction) {
    conditions.push(`c.direction = $${paramIndex++}`);
    params.push(queryParams.direction);
  }
  if (queryParams.status) {
    conditions.push(`c.status = $${paramIndex++}`);
    params.push(queryParams.status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return queryMany<any>(
    `SELECT c.*, cs.id as "summary.id", cs.summary, cs.event, cs.guests, cs."eventDate", cs.sentiment, cs.objections, cs."nextAction",
            u.id as "agent.id", u.name as "agent.name",
            l.id as "lead.id", l.name as "lead.name"
     FROM "Call" c
     LEFT JOIN "CallSummary" cs ON c.id = cs."callId"
     LEFT JOIN "User" u ON c."userId" = u.id
     LEFT JOIN "Lead" l ON c."leadId" = l.id
     ${whereClause}
     ORDER BY c."createdAt" DESC
     LIMIT 100`,
    params
  );
}

export async function getCall(id: string) {
  const call = await queryOne<any>(
    `SELECT c.*, cs.id as "summary.id", cs.summary, cs.event, cs.guests, cs."eventDate", cs.sentiment, cs.objections, cs."nextAction",
            u.id as "agent.id", u.name as "agent.name",
            l.id as "lead.id", l.name as "lead.name"
     FROM "Call" c
     LEFT JOIN "CallSummary" cs ON c.id = cs."callId"
     LEFT JOIN "User" u ON c."userId" = u.id
     LEFT JOIN "Lead" l ON c."leadId" = l.id
     WHERE c.id = $1`,
    [id]
  );

  if (!call) return null;

  const scoreEvents = await queryMany<any>(
    'SELECT * FROM "LeadScoreEvent" WHERE "callId" = $1 ORDER BY "createdAt" DESC',
    [id]
  );

  return {
    ...call,
    summary: call['summary.id'] ? {
      id: call['summary.id'],
      summary: call.summary,
      event: call.event,
      guests: call.guests,
      eventDate: call.eventDate,
      sentiment: call.sentiment,
      objections: call.objections,
      nextAction: call.nextAction,
    } : null,
    agent: call['agent.id'] ? { id: call['agent.id'], name: call['agent.name'] } : null,
    lead: call['lead.id'] ? { id: call['lead.id'], name: call['lead.name'] } : null,
    scoreEvents,
  };
}
