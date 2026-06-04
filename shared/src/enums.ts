export enum Role {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  AGENT = 'AGENT',
}

export enum LeadSource {
  WEDMEGOOD = 'WEDMEGOOD',
  JUSTDIAL = 'JUSTDIAL',
  GOOGLE_MAPS = 'GOOGLE_MAPS',
  WEBSITE = 'WEBSITE',
  MANUAL = 'MANUAL',
  WHATSAPP_INBOUND = 'WHATSAPP_INBOUND',
  IVR_INBOUND = 'IVR_INBOUND',
  REFERRAL = 'REFERRAL',
  OTHER = 'OTHER',
}

export enum ScoreBand {
  HOT = 'HOT',
  WARM = 'WARM',
  COLD = 'COLD',
  UNSCORED = 'UNSCORED',
}

export enum LeadStatus {
  OPEN = 'OPEN',
  WON = 'WON',
  LOST = 'LOST',
}

export enum EventType {
  WEDDING = 'WEDDING',
  RECEPTION = 'RECEPTION',
  ENGAGEMENT = 'ENGAGEMENT',
  SANGEET = 'SANGEET',
  BIRTHDAY = 'BIRTHDAY',
  CORPORATE = 'CORPORATE',
  OTHER = 'OTHER',
}

export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum MessageChannel {
  WHATSAPP = 'WHATSAPP',
  SMS = 'SMS',
}

export enum MessageStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
  RECEIVED = 'RECEIVED',
}

export enum CallDirection {
  OUTBOUND = 'OUTBOUND',
  INBOUND = 'INBOUND',
}

export enum CallStatus {
  INITIATED = 'INITIATED',
  RINGING = 'RINGING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  MISSED = 'MISSED',
  FAILED = 'FAILED',
  NO_ANSWER = 'NO_ANSWER',
  BUSY = 'BUSY',
}

export enum AutomationTrigger {
  LEAD_CREATED = 'LEAD_CREATED',
  STAGE_CHANGED = 'STAGE_CHANGED',
  NO_REPLY = 'NO_REPLY',
  MANUAL = 'MANUAL',
}

export enum SequenceStepStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  SKIPPED = 'SKIPPED',
  CANCELLED = 'CANCELLED',
}

export enum ActivityType {
  NOTE = 'NOTE',
  STAGE_CHANGE = 'STAGE_CHANGE',
  SOURCE_CHANGE = 'SOURCE_CHANGE',
  ASSIGNMENT = 'ASSIGNMENT',
  CALL_LOGGED = 'CALL_LOGGED',
  WHATSAPP_SENT = 'WHATSAPP_SENT',
  WHATSAPP_RECEIVED = 'WHATSAPP_RECEIVED',
  SCORE_UPDATED = 'SCORE_UPDATED',
  FOLLOWUP_SCHEDULED = 'FOLLOWUP_SCHEDULED',
  FOLLOWUP_SENT = 'FOLLOWUP_SENT',
  LEAD_CREATED = 'LEAD_CREATED',
  FIELD_UPDATED = 'FIELD_UPDATED',
}

export const SOURCE_LABELS: Record<LeadSource, string> = {
  [LeadSource.WEDMEGOOD]: 'WedMeGood',
  [LeadSource.JUSTDIAL]: 'JustDial',
  [LeadSource.GOOGLE_MAPS]: 'Google Maps',
  [LeadSource.WEBSITE]: 'Website',
  [LeadSource.MANUAL]: 'Manual',
  [LeadSource.WHATSAPP_INBOUND]: 'WhatsApp',
  [LeadSource.IVR_INBOUND]: 'IVR Call',
  [LeadSource.REFERRAL]: 'Referral',
  [LeadSource.OTHER]: 'Other',
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  [EventType.WEDDING]: 'Wedding',
  [EventType.RECEPTION]: 'Reception',
  [EventType.ENGAGEMENT]: 'Engagement',
  [EventType.SANGEET]: 'Sangeet',
  [EventType.BIRTHDAY]: 'Birthday',
  [EventType.CORPORATE]: 'Corporate',
  [EventType.OTHER]: 'Other',
};

export const SCORE_BAND_LABELS: Record<ScoreBand, string> = {
  [ScoreBand.HOT]: '🔥 Hot',
  [ScoreBand.WARM]: '🤗 Warm',
  [ScoreBand.COLD]: '❄️ Cold',
  [ScoreBand.UNSCORED]: 'Unscored',
};
