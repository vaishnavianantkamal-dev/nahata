import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { query, queryOne, queryMany } from '../../lib/db';
import { logger } from '../../lib/logger';
import { env } from '../../config/env';

// ── Parse incoming message from Meta webhook ───────────────────────────────
export async function handleIncomingMessages(
  webhookValue: any,
  contacts: any[]
) {
  try {
    const messages = webhookValue.messages || [];

    for (const message of messages) {
      const senderWaId = message.from;
      const messageId = message.id;
      const timestamp = message.timestamp;
      const contact = contacts.find(c => c.wa_id === senderWaId) || {};
      const contactName = contact.profile?.name || 'Unknown';

      // Skip if already processed (idempotency check)
      const existing = await queryOne(
        'SELECT id FROM "Message" WHERE "providerMessageId" = $1',
        [messageId]
      );
      if (existing) {
        logger.debug({ messageId }, 'Message already processed, skipping');
        continue;  // Skip this message, process the next one in the array
      }

      // Extract message content based on type
      let messageText = '';
      let messageType = message.type; // text, interactive, image, etc.

      if (message.type === 'text' && message.text?.body) {
        messageText = message.text.body;
      } else if (message.type === 'interactive' && message.interactive?.list_reply?.title) {
        messageText = message.interactive.list_reply.title;
      } else if (message.type === 'interactive' && message.interactive?.button_reply?.title) {
        messageText = message.interactive.button_reply.title;
      } else if (message.type === 'interactive' && message.interactive?.nfm_reply?.response_json) {
        // Flow response - will be handled separately
        messageText = '[Flow Response]';
      } else {
        messageText = `[${message.type}]`;
      }

      // Normalize phone number (remove spaces, ensure +91 prefix for India)
      const normalizedPhone = normalizePhoneNumber(senderWaId);

      // Find or create lead - exact match only to avoid cross-country collisions
      let lead = await queryOne(
        'SELECT * FROM "Lead" WHERE "primaryPhone" = $1',
        [normalizedPhone]
      );

      const isNewLead = !lead;

      if (!lead) {
        // Create new lead
        const leadId = uuidv4();
        const newStage = await queryOne<{ id: string }>(
          'SELECT id FROM "Stage" WHERE key = $1',
          ['new']
        );

        const now = new Date();
        await query(
          `INSERT INTO "Lead" (
            id, name, "primaryPhone", source, "eventType", "stageId", status,
            "scoreBand", "lastContactAt", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            leadId,
            contactName || 'New Lead',
            normalizedPhone,
            'WHATSAPP_INBOUND',
            'OTHER',
            newStage?.id || '',
            'OPEN',
            'UNSCORED',
            now,
            now,
            now,
          ]
        );

        lead = { id: leadId };
        logger.info({ leadId, phone: normalizedPhone }, '✅ New lead created from WhatsApp');
      } else {
        // Update last contact time
        await query(
          'UPDATE "Lead" SET "lastContactAt" = $1, "updatedAt" = $2 WHERE id = $3',
          [new Date(), new Date(), lead.id]
        );
      }

      // Store message
      const now = new Date();
      const messageRecord = {
        id: uuidv4(),
        leadId: lead.id,
        direction: 'INBOUND',
        channel: 'WHATSAPP',
        status: 'RECEIVED',
        body: messageText,
        providerMessageId: messageId,
        receivedAt: new Date(parseInt(timestamp) * 1000),
        createdAt: now,
        updatedAt: now,
      };

      await query(
        `INSERT INTO "Message" (
          id, "leadId", direction, channel, status, body,
          "providerMessageId", "receivedAt", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          messageRecord.id,
          messageRecord.leadId,
          messageRecord.direction,
          messageRecord.channel,
          messageRecord.status,
          messageRecord.body,
          messageRecord.providerMessageId,
          messageRecord.receivedAt,
          messageRecord.createdAt,
          messageRecord.updatedAt,
        ]
      );

      logger.info({ leadId: lead.id, messageId }, '💬 Message stored');

      // Handle Flow responses
      if (message.type === 'interactive' && message.interactive?.nfm_reply?.response_json) {
        await handleFlowCompletion(lead.id, message.interactive.nfm_reply.response_json);
      }

      // Send auto-reply for new leads
      if (isNewLead) {
        await sendAutoReply(lead.id, contactName);
      }
    }
  } catch (error) {
    logger.error({ error }, 'Error handling incoming messages');
    throw error;
  }
}

// ── Handle Flow completion (collect lead details from WhatsApp Flow) ────────
async function handleFlowCompletion(leadId: string, responseJson: string) {
  try {
    let response: any = {};
    try {
      response = JSON.parse(responseJson);
    } catch (parseErr) {
      logger.warn({ leadId, responseJson, error: parseErr }, 'Invalid Flow response JSON');
      return;  // Exit gracefully, don't crash webhook
    }
    const fields = response || {};

    // Map Flow fields to Lead columns via SourceIntegration config
    const sourceIntegration = await queryOne(
      'SELECT "fieldMapping" FROM "SourceIntegration" WHERE source = $1',
      ['WHATSAPP_INBOUND']
    );

    const mapping = sourceIntegration?.fieldMapping || {
      name_field: 'name',
      event_type_field: 'eventType',
      guests_field: 'guestCount',
      budget_min_field: 'budgetMin',
      budget_max_field: 'budgetMax',
      event_date_field: 'eventDate',
      location_field: 'notes',
    };

    const updates: Record<string, any> = {};
    const now = new Date();

    // Map Flow response fields to Lead
    if (fields[mapping.name_field]) {
      updates.name = fields[mapping.name_field];
    }
    if (fields[mapping.event_type_field]) {
      const eventType = fields[mapping.event_type_field].toUpperCase();
      if (['WEDDING', 'RECEPTION', 'ENGAGEMENT', 'SANGEET', 'BIRTHDAY', 'CORPORATE', 'OTHER'].includes(eventType)) {
        updates.eventType = eventType;
      }
    }
    if (fields[mapping.guests_field]) {
      updates.guestCount = parseInt(fields[mapping.guests_field], 10);
    }
    if (fields[mapping.budget_min_field]) {
      updates.budgetMin = parseInt(fields[mapping.budget_min_field], 10);
    }
    if (fields[mapping.budget_max_field]) {
      updates.budgetMax = parseInt(fields[mapping.budget_max_field], 10);
    }
    if (fields[mapping.event_date_field]) {
      updates.eventDate = new Date(fields[mapping.event_date_field]);
    }
    if (fields[mapping.location_field]) {
      updates.notes = fields[mapping.location_field];
    }

    // Build UPDATE query
    if (Object.keys(updates).length > 0) {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (key === 'notes') {
          // Append to notes rather than overwrite
          setClauses.push(
            `"notes" = CASE WHEN "notes" IS NULL OR "notes" = '' THEN $${paramIndex} ELSE "notes" || E'\\n' || $${paramIndex} END`
          );
        } else {
          setClauses.push(`"${key}" = $${paramIndex}`);
        }
        values.push(value);
        paramIndex++;
      }

      // Add updatedAt
      setClauses.push(`"updatedAt" = $${paramIndex}`);
      values.push(now);
      paramIndex++;

      await query(
        `UPDATE "Lead" SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
        [...values, leadId]
      );

      logger.info({ leadId, updated: Object.keys(updates) }, '📝 Lead updated from Flow');

      // Log activity
      await query(
        `INSERT INTO "Activity" (id, "leadId", type, title, description, meta, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          uuidv4(),
          leadId,
          'FIELD_UPDATED',
          'Lead details submitted via WhatsApp Flow',
          `Updated: ${Object.keys(updates).join(', ')}`,
          JSON.stringify({ fields, mapping }),
          now,
        ]
      );
    }
  } catch (error) {
    logger.error({ error, leadId }, 'Error handling Flow completion');
  }
}

// ── Handle message status updates (delivered, read, failed) ────────────────
export async function handleMessageStatuses(statuses: any[]) {
  try {
    for (const status of statuses) {
      const { id: messageId, status: statusValue, timestamp, errors } = status;

      const messageStatus = mapMetaStatus(statusValue);
      const updates: any = { status: messageStatus };

      if (statusValue === 'delivered') {
        updates.deliveredAt = new Date(parseInt(timestamp) * 1000);
      } else if (statusValue === 'read') {
        updates.readAt = new Date(parseInt(timestamp) * 1000);
      } else if (statusValue === 'failed') {
        updates.errorMessage = errors?.[0]?.message || 'Unknown error';
      }

      const setClause = Object.keys(updates)
        .map((key, i) => `"${key}" = $${i + 1}`)
        .join(', ');
      const values = Object.values(updates);

      await query(
        `UPDATE "Message" SET ${setClause}, "updatedAt" = $${values.length + 1}
         WHERE "providerMessageId" = $${values.length + 2}`,
        [...values, new Date(), messageId]
      );

      logger.debug({ messageId, status: messageStatus }, '📌 Message status updated');
    }
  } catch (error) {
    logger.error({ error }, 'Error handling message statuses');
  }
}

// ── Send auto-reply to new leads ───────────────────────────────────────────
async function sendAutoReply(leadId: string, contactName: string) {
  try {
    // Auto-reply is sent immediately after customer message (always within 24h window)
    // So no 24h check needed here - reply is always allowed
    if (env.LEAD_FORM_MODE === 'flow' && env.WHATSAPP_FLOW_ID) {
      // Send Flow
      await sendWhatsAppMessage(leadId, {
        type: 'interactive',
        interactive: {
          type: 'flow',
          flow: {
            token: env.WHATSAPP_FLOW_ID,
            action: 'navigate',
            navigate: {
              screen: 'initial_screen',
            },
          },
          action: {
            type: 'never',
          },
        },
      }, 'FLOW_PROMPT');
    } else {
      // Send text + CTA
      const message = `Namaste ${contactName} 🙏\n\nThank you for your interest in Nahata Lawns! We'd love to help plan your special event.\n\nPlease fill out our quick form to get started:`;

      await sendWhatsAppMessage(leadId, {
        type: 'interactive',
        interactive: {
          type: 'cta_url',
          cta_url: {
            display_text: 'Fill Event Details',
            url: env.LEAD_FORM_URL,
          },
          body: {
            text: message,
          },
        },
      }, 'LEAD_FORM_INVITE');
    }
  } catch (error) {
    logger.error({ error, leadId }, 'Error sending auto-reply');
    // Log but don't throw - auto-reply failure shouldn't break message ingestion
  }
}

// ── Send WhatsApp message via Meta Cloud API ───────────────────────────────
export async function sendWhatsAppMessage(
  leadId: string,
  messagePayload: any,
  templateName?: string
): Promise<boolean> {
  try {
    if (!env.META_WABA_PHONE_NUMBER_ID || !env.META_WABA_TOKEN) {
      logger.warn('WhatsApp credentials not configured');
      return false;
    }

    // Get lead's phone number
    const lead = await queryOne<{ primaryPhone: string }>(
      'SELECT "primaryPhone" FROM "Lead" WHERE id = $1',
      [leadId]
    );

    if (!lead) {
      logger.error({ leadId }, 'Lead not found');
      return false;
    }

    const phoneNumber = lead.primaryPhone.replace(/\D/g, ''); // Remove non-digits

    // Build Meta API request
    const url = `https://graph.facebook.com/${env.GRAPH_API_VERSION}/${env.META_WABA_PHONE_NUMBER_ID}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      ...messagePayload,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.META_WABA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = (await response.json()) as any;

    if (!response.ok) {
      logger.error({ status: response.status, error: responseData }, 'Meta API error');
      return false;
    }

    const messageId = responseData.messages?.[0]?.id;

    // Store outbound message
    const now = new Date();
    const messageText = messagePayload.text?.body ||
                       messagePayload.interactive?.body?.text ||
                       `[${messagePayload.type}]`;

    await query(
      `INSERT INTO "Message" (
        id, "leadId", direction, channel, status, body,
        "providerMessageId", "sentAt", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        uuidv4(),
        leadId,
        'OUTBOUND',
        'WHATSAPP',
        'SENT',
        messageText,
        messageId,
        now,
        now,
        now,
      ]
    );

    logger.info({ leadId, messageId, templateName }, '✉️ Message sent');
    return true;
  } catch (error) {
    logger.error({ error, leadId }, 'Error sending WhatsApp message');
    return false;
  }
}

// ── Fire automation when lead moves to a stage ──────────────────────────────
export async function fireStageAutomation(leadId: string, stageId: string) {
  try {
    // Stage automation is disabled by default - only enable via env var
    // This prevents unintended messages and protects against Meta's 24h window limit
    if (!env.WHATSAPP_STAGE_AUTOMATION_ENABLED) {
      logger.debug({ leadId, stageId }, 'Stage automation disabled (set WHATSAPP_STAGE_AUTOMATION_ENABLED=true to enable)');
      return;
    }

    // Get stage and lead
    const stage = await queryOne<{ name: string }>(
      'SELECT name FROM "Stage" WHERE id = $1',
      [stageId]
    );

    if (!stage) return;

    // Get stage message binding
    const binding = await queryOne<{ templateId: string }>(
      'SELECT "templateId" FROM "StageMessageBinding" WHERE "stageId" = $1 AND enabled = true',
      [stageId]
    );

    if (!binding) return;

    // Get template
    const template = await queryOne<{ body: string }>(
      'SELECT body FROM "Template" WHERE id = $1',
      [binding.templateId]
    );

    if (!template) return;

    // Check 24h window: get last inbound message from customer
    const lastInbound = await queryOne<{ receivedAt: string }>(
      'SELECT "receivedAt" FROM "Message" WHERE "leadId" = $1 AND direction = $2 ORDER BY "receivedAt" DESC LIMIT 1',
      [leadId, 'INBOUND']
    );

    if (lastInbound) {
      const lastMessageTime = new Date(lastInbound.receivedAt);
      const now = new Date();
      const hoursSince = (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60);

      if (hoursSince > 24) {
        logger.warn(
          { leadId, hoursSince: Math.round(hoursSince), stage: stage.name },
          'Stage automation skipped: no customer message in last 24h (Meta requires HSM template outside 24h window)'
        );
        return;
      }
    }

    // Get lead for personalization
    const lead = await queryOne<{ name: string }>(
      'SELECT name FROM "Lead" WHERE id = $1',
      [leadId]
    );

    // Render template (replace {Name} with actual name)
    const messageText = template.body.replace('{Name}', lead?.name || 'Lead');

    // Send message
    const success = await sendWhatsAppMessage(leadId, {
      type: 'text',
      text: { body: messageText },
    }, `stage-${stage.name}`);

    if (!success) {
      logger.warn({ leadId, stageId, stage: stage.name }, 'Stage automation message failed to send (may be outside 24h window)');
    }
  } catch (error) {
    logger.error({ error, leadId, stageId }, 'Error firing stage automation');
  }
}

// ── Helper: Normalize phone number ─────────────────────────────────────────
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let normalized = phone.replace(/\D/g, '');

  // If 10 digits (Indian number without country code), add +91
  if (normalized.length === 10) {
    normalized = '91' + normalized;
  }

  // Add + prefix if not present
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }

  return normalized;
}

// ── Helper: Map Meta status to our enum ────────────────────────────────────
function mapMetaStatus(metaStatus: string): string {
  const map: Record<string, string> = {
    sent: 'SENT',
    delivered: 'DELIVERED',
    read: 'READ',
    failed: 'FAILED',
  };
  return map[metaStatus] || 'QUEUED';
}
