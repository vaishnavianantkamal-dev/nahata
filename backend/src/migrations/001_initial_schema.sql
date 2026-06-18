-- Create ENUM types
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'AGENT');
CREATE TYPE "LeadSource" AS ENUM ('WEDMEGOOD', 'JUSTDIAL', 'GOOGLE_MAPS', 'WEBSITE', 'MANUAL', 'WHATSAPP_INBOUND', 'IVR_INBOUND', 'REFERRAL', 'OTHER');
CREATE TYPE "ScoreBand" AS ENUM ('HOT', 'WARM', 'COLD', 'UNSCORED');
CREATE TYPE "LeadStatus" AS ENUM ('OPEN', 'WON', 'LOST');
CREATE TYPE "EventType" AS ENUM ('WEDDING', 'RECEPTION', 'ENGAGEMENT', 'SANGEET', 'BIRTHDAY', 'CORPORATE', 'OTHER');
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP', 'SMS');
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'RECEIVED');
CREATE TYPE "CallDirection" AS ENUM ('OUTBOUND', 'INBOUND');
CREATE TYPE "CallStatus" AS ENUM ('INITIATED', 'RINGING', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'FAILED', 'NO_ANSWER', 'BUSY');
CREATE TYPE "AutomationTrigger" AS ENUM ('LEAD_CREATED', 'STAGE_CHANGED', 'NO_REPLY', 'MANUAL');
CREATE TYPE "SequenceStepStatus" AS ENUM ('PENDING', 'SENT', 'SKIPPED', 'CANCELLED');
CREATE TYPE "ActivityType" AS ENUM ('NOTE', 'STAGE_CHANGE', 'SOURCE_CHANGE', 'ASSIGNMENT', 'CALL_LOGGED', 'WHATSAPP_SENT', 'WHATSAPP_RECEIVED', 'SCORE_UPDATED', 'FOLLOWUP_SCHEDULED', 'FOLLOWUP_SENT', 'LEAD_CREATED', 'FIELD_UPDATED');
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'INVOICED');

-- Create tables
CREATE TABLE "User" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  "passwordHash" TEXT NOT NULL,
  role "Role" NOT NULL DEFAULT 'AGENT',
  "avatarUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP
);
CREATE INDEX idx_user_email ON "User"(email);
CREATE INDEX idx_user_role ON "User"(role);

CREATE TABLE "Stage" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  "order" INT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b',
  "isWon" BOOLEAN NOT NULL DEFAULT false,
  "isLost" BOOLEAN NOT NULL DEFAULT false,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "wipLimit" INT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP
);
CREATE INDEX idx_stage_order ON "Stage"("order");

CREATE TABLE "Lead" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "primaryPhone" TEXT NOT NULL,
  "altPhone" TEXT,
  email TEXT,
  source "LeadSource" NOT NULL,
  "sourceDetail" TEXT,
  "eventType" "EventType" NOT NULL,
  "guestCount" INT,
  "eventDate" TIMESTAMP,
  "budgetMin" INT,
  "budgetMax" INT,
  "stageId" TEXT NOT NULL,
  status "LeadStatus" NOT NULL DEFAULT 'OPEN',
  "ownerId" TEXT,
  score INT,
  "scoreBand" "ScoreBand" NOT NULL DEFAULT 'UNSCORED',
  "lastContactAt" TIMESTAMP,
  "firstResponseAt" TIMESTAMP,
  "nextFollowUpAt" TIMESTAMP,
  notes TEXT,
  "lostReason" TEXT,
  "externalRef" TEXT,
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP,
  FOREIGN KEY ("stageId") REFERENCES "Stage"(id),
  FOREIGN KEY ("ownerId") REFERENCES "User"(id)
);
CREATE INDEX idx_lead_stageId ON "Lead"("stageId");
CREATE INDEX idx_lead_ownerId ON "Lead"("ownerId");
CREATE INDEX idx_lead_source ON "Lead"(source);
CREATE INDEX idx_lead_status ON "Lead"(status);
CREATE INDEX idx_lead_scoreBand ON "Lead"("scoreBand");
CREATE INDEX idx_lead_eventDate ON "Lead"("eventDate");
CREATE INDEX idx_lead_createdAt ON "Lead"("createdAt");
CREATE INDEX idx_lead_primaryPhone ON "Lead"("primaryPhone");

CREATE TABLE "TemplateGroup" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  "order" INT NOT NULL DEFAULT 0,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP
);

CREATE TABLE "Template" (
  id TEXT PRIMARY KEY,
  "groupId" TEXT NOT NULL,
  name TEXT NOT NULL,
  channel "MessageChannel" NOT NULL DEFAULT 'WHATSAPP',
  body TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  "providerTemplateName" TEXT,
  "providerTemplateStatus" TEXT,
  variables JSONB,
  "order" INT NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP,
  FOREIGN KEY ("groupId") REFERENCES "TemplateGroup"(id)
);
CREATE INDEX idx_template_groupId_order ON "Template"("groupId", "order");

CREATE TABLE "StageMessageBinding" (
  id TEXT PRIMARY KEY,
  "stageId" TEXT NOT NULL UNIQUE,
  "templateId" TEXT NOT NULL,
  channel "MessageChannel" NOT NULL DEFAULT 'WHATSAPP',
  enabled BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("stageId") REFERENCES "Stage"(id),
  FOREIGN KEY ("templateId") REFERENCES "Template"(id)
);

CREATE TABLE "Sequence" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  trigger "AutomationTrigger" NOT NULL DEFAULT 'LEAD_CREATED',
  "stopOnReply" BOOLEAN NOT NULL DEFAULT true,
  "stopOnStageChange" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "SequenceStep" (
  id TEXT PRIMARY KEY,
  "sequenceId" TEXT NOT NULL,
  "order" INT NOT NULL,
  "delayMinutes" INT NOT NULL DEFAULT 0,
  "templateId" TEXT NOT NULL,
  condition JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("sequenceId") REFERENCES "Sequence"(id) ON DELETE CASCADE,
  FOREIGN KEY ("templateId") REFERENCES "Template"(id)
);

CREATE TABLE "SequenceEnrollment" (
  id TEXT PRIMARY KEY,
  "leadId" TEXT NOT NULL,
  "sequenceId" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  "currentStepOrder" INT NOT NULL DEFAULT 0,
  "enrolledAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "stoppedAt" TIMESTAMP,
  "stopReason" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("leadId") REFERENCES "Lead"(id),
  FOREIGN KEY ("sequenceId") REFERENCES "Sequence"(id),
  UNIQUE ("leadId", "sequenceId", status)
);

CREATE TABLE "ScheduledMessage" (
  id TEXT PRIMARY KEY,
  "leadId" TEXT NOT NULL,
  "enrollmentId" TEXT,
  "templateId" TEXT,
  channel "MessageChannel" NOT NULL DEFAULT 'WHATSAPP',
  "scheduledFor" TIMESTAMP NOT NULL,
  status "SequenceStepStatus" NOT NULL DEFAULT 'PENDING',
  "renderedBody" TEXT,
  "sentMessageId" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("leadId") REFERENCES "Lead"(id),
  FOREIGN KEY ("enrollmentId") REFERENCES "SequenceEnrollment"(id),
  FOREIGN KEY ("templateId") REFERENCES "Template"(id)
);
CREATE INDEX idx_scheduled_message_scheduledFor_status ON "ScheduledMessage"("scheduledFor", status);

CREATE TABLE "Message" (
  id TEXT PRIMARY KEY,
  "leadId" TEXT NOT NULL,
  "userId" TEXT,
  direction "MessageDirection" NOT NULL,
  channel "MessageChannel" NOT NULL,
  status "MessageStatus" NOT NULL DEFAULT 'QUEUED',
  body TEXT NOT NULL,
  "templateId" TEXT,
  trigger "AutomationTrigger",
  "providerMessageId" TEXT,
  "providerStatusRaw" JSONB,
  "errorMessage" TEXT,
  "sentAt" TIMESTAMP,
  "deliveredAt" TIMESTAMP,
  "readAt" TIMESTAMP,
  "receivedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("leadId") REFERENCES "Lead"(id),
  FOREIGN KEY ("templateId") REFERENCES "Template"(id)
);
CREATE INDEX idx_message_leadId_createdAt ON "Message"("leadId", "createdAt");
CREATE INDEX idx_message_status ON "Message"(status);
CREATE INDEX idx_message_direction ON "Message"(direction);

CREATE TABLE "Call" (
  id TEXT PRIMARY KEY,
  "leadId" TEXT,
  "userId" TEXT,
  direction "CallDirection" NOT NULL,
  status "CallStatus" NOT NULL DEFAULT 'INITIATED',
  "fromNumber" TEXT NOT NULL,
  "toNumber" TEXT NOT NULL,
  "providerCallId" TEXT,
  "ivrFlow" JSONB,
  "startedAt" TIMESTAMP,
  "answeredAt" TIMESTAMP,
  "endedAt" TIMESTAMP,
  "durationSec" INT,
  "recordingUrl" TEXT,
  "recordingStorageKey" TEXT,
  "consentPlayed" BOOLEAN NOT NULL DEFAULT true,
  transcript TEXT,
  "transcriptLang" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("leadId") REFERENCES "Lead"(id),
  FOREIGN KEY ("userId") REFERENCES "User"(id)
);
CREATE INDEX idx_call_leadId_createdAt ON "Call"("leadId", "createdAt");
CREATE INDEX idx_call_direction ON "Call"(direction);
CREATE INDEX idx_call_status ON "Call"(status);

CREATE TABLE "CallSummary" (
  id TEXT PRIMARY KEY,
  "callId" TEXT NOT NULL UNIQUE,
  "leadId" TEXT NOT NULL,
  summary TEXT NOT NULL,
  event TEXT,
  guests INT,
  "eventDate" TEXT,
  sentiment TEXT,
  objections TEXT,
  "nextAction" TEXT NOT NULL,
  "rawModelOutput" JSONB,
  model TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("callId") REFERENCES "Call"(id),
  FOREIGN KEY ("leadId") REFERENCES "Lead"(id)
);

CREATE TABLE "LeadScoreEvent" (
  id TEXT PRIMARY KEY,
  "leadId" TEXT NOT NULL,
  "callId" TEXT,
  score INT NOT NULL,
  band "ScoreBand" NOT NULL,
  factors JSONB,
  rationale TEXT NOT NULL,
  "suggestedAction" TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'CALL',
  model TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("leadId") REFERENCES "Lead"(id),
  FOREIGN KEY ("callId") REFERENCES "Call"(id)
);
CREATE INDEX idx_leadscoreevent_leadId_createdAt ON "LeadScoreEvent"("leadId", "createdAt");

CREATE TABLE "Activity" (
  id TEXT PRIMARY KEY,
  "leadId" TEXT NOT NULL,
  "userId" TEXT,
  type "ActivityType" NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  meta JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("leadId") REFERENCES "Lead"(id),
  FOREIGN KEY ("userId") REFERENCES "User"(id)
);
CREATE INDEX idx_activity_leadId_createdAt ON "Activity"("leadId", "createdAt");

CREATE TABLE "SourceIntegration" (
  id TEXT PRIMARY KEY,
  source "LeadSource" NOT NULL UNIQUE,
  "displayName" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "webhookSecret" TEXT,
  "fieldMapping" JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Setting" (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "RefreshToken" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP NOT NULL,
  "isRevoked" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);
CREATE INDEX idx_refreshtoken_userId ON "RefreshToken"("userId");

CREATE TABLE "AuditLog" (
  id TEXT PRIMARY KEY,
  "userId" TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  "entityId" TEXT,
  meta JSONB,
  ip TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User"(id)
);
CREATE INDEX idx_auditlog_userId ON "AuditLog"("userId");
CREATE INDEX idx_auditlog_entity_entityId ON "AuditLog"(entity, "entityId");
CREATE INDEX idx_auditlog_createdAt ON "AuditLog"("createdAt");

CREATE TABLE "Quotation" (
  id TEXT PRIMARY KEY,
  "quoteNumber" TEXT NOT NULL UNIQUE,
  "leadId" TEXT,
  "clientName" TEXT NOT NULL,
  "clientPhone" TEXT,
  "projectDetails" TEXT,
  "quoteDate" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validityDays" INT NOT NULL DEFAULT 15,
  "advancePct" INT NOT NULL DEFAULT 50,
  subtotal FLOAT NOT NULL DEFAULT 0,
  "discountPct" FLOAT NOT NULL DEFAULT 0,
  "discountAmt" FLOAT NOT NULL DEFAULT 0,
  "gstPct" FLOAT NOT NULL DEFAULT 0,
  "grandTotal" FLOAT NOT NULL DEFAULT 0,
  "estCost" FLOAT NOT NULL DEFAULT 0,
  notes TEXT,
  "termsText" TEXT,
  status "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
  "pdfPath" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("leadId") REFERENCES "Lead"(id),
  FOREIGN KEY ("createdById") REFERENCES "User"(id)
);
CREATE INDEX idx_quotation_leadId ON "Quotation"("leadId");
CREATE INDEX idx_quotation_status ON "Quotation"(status);
CREATE INDEX idx_quotation_createdAt ON "Quotation"("createdAt");

CREATE TABLE "QuotationItem" (
  id TEXT PRIMARY KEY,
  "quotationId" TEXT NOT NULL,
  "order" INT NOT NULL,
  description TEXT NOT NULL,
  notes TEXT,
  length FLOAT NOT NULL DEFAULT 0,
  width FLOAT NOT NULL DEFAULT 0,
  "areaQty" FLOAT NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'Sq.ft',
  rate FLOAT NOT NULL DEFAULT 0,
  amount FLOAT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("quotationId") REFERENCES "Quotation"(id) ON DELETE CASCADE
);

CREATE TABLE "QuotationAddlWork" (
  id TEXT PRIMARY KEY,
  "quotationId" TEXT NOT NULL,
  "order" INT NOT NULL,
  item TEXT NOT NULL,
  qty FLOAT NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'Nos',
  rate FLOAT NOT NULL DEFAULT 0,
  amount FLOAT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("quotationId") REFERENCES "Quotation"(id) ON DELETE CASCADE
);
