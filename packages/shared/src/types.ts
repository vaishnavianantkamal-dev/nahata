import {
  Role, LeadSource, ScoreBand, LeadStatus, EventType,
  MessageDirection, MessageChannel, MessageStatus,
  CallDirection, CallStatus, AutomationTrigger, ActivityType,
  SequenceStepStatus,
} from './enums';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  avatarUrl?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Stage {
  id: string;
  name: string;
  key: string;
  order: number;
  color: string;
  isWon: boolean;
  isLost: boolean;
  isDefault: boolean;
  wipLimit?: number;
  leadCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  name: string;
  primaryPhone: string;
  altPhone?: string;
  email?: string;
  source: LeadSource;
  sourceDetail?: string;
  eventType: EventType;
  guestCount?: number;
  eventDate?: string;
  budgetMin?: number;
  budgetMax?: number;
  stageId: string;
  stage?: Stage;
  status: LeadStatus;
  ownerId?: string;
  owner?: User;
  score?: number;
  scoreBand: ScoreBand;
  lastContactAt?: string;
  firstResponseAt?: string;
  nextFollowUpAt?: string;
  notes?: string;
  lostReason?: string;
  externalRef?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateGroup {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  order: number;
  isSystem: boolean;
  templates?: Template[];
  _count?: { templates: number };
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  groupId: string;
  group?: TemplateGroup;
  name: string;
  channel: MessageChannel;
  body: string;
  language: string;
  providerTemplateName?: string;
  providerTemplateStatus?: string;
  variables?: Record<string, string>;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  leadId: string;
  userId?: string;
  direction: MessageDirection;
  channel: MessageChannel;
  status: MessageStatus;
  body: string;
  templateId?: string;
  trigger?: AutomationTrigger;
  providerMessageId?: string;
  errorMessage?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  receivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Call {
  id: string;
  leadId?: string;
  userId?: string;
  direction: CallDirection;
  status: CallStatus;
  fromNumber: string;
  toNumber: string;
  providerCallId?: string;
  startedAt?: string;
  answeredAt?: string;
  endedAt?: string;
  durationSec?: number;
  recordingUrl?: string;
  consentPlayed: boolean;
  transcript?: string;
  summary?: CallSummary;
  createdAt: string;
  updatedAt: string;
}

export interface CallSummary {
  id: string;
  callId: string;
  leadId: string;
  summary: string;
  event?: string;
  guests?: number;
  eventDate?: string;
  sentiment?: string;
  objections?: string;
  nextAction: string;
  model: string;
  promptVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadScoreEvent {
  id: string;
  leadId: string;
  callId?: string;
  score: number;
  band: ScoreBand;
  factors?: Record<string, number>;
  rationale: string;
  suggestedAction: string;
  source: 'CALL' | 'MANUAL' | 'RULE';
  model?: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  leadId: string;
  userId?: string;
  user?: Pick<User, 'id' | 'name' | 'avatarUrl'>;
  type: ActivityType;
  title: string;
  description?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface Sequence {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  trigger: AutomationTrigger;
  stopOnReply: boolean;
  stopOnStageChange: boolean;
  steps?: SequenceStep[];
  createdAt: string;
  updatedAt: string;
}

export interface SequenceStep {
  id: string;
  sequenceId: string;
  order: number;
  delayMinutes: number;
  templateId: string;
  template?: Template;
  condition?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SequenceEnrollment {
  id: string;
  leadId: string;
  sequenceId: string;
  status: 'active' | 'completed' | 'stopped';
  currentStepOrder: number;
  enrolledAt: string;
  stoppedAt?: string;
  stopReason?: string;
}

// API response types
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface KpiData {
  newLeads: number;
  siteVisits: number;
  bookings: number;
  winRate: number;
  totalEnquiries: number;
  inPipeline: number;
  confirmed: number;
  whatsappSent: number;
  deltas: {
    newLeads: number;
    siteVisits: number;
    bookings: number;
    winRate: number;
  };
}

export interface AnalyticsSourceData {
  source: LeadSource;
  label: string;
  count: number;
  percentage: number;
  bookings: number;
  winRate: number;
}

export interface FunnelStage {
  stageId: string;
  stageName: string;
  count: number;
  dropoffPercent: number;
}

export interface CallIntelligence {
  summary: string;
  event?: string;
  guests?: number;
  eventDate?: string;
  sentiment?: string;
  objections?: string;
  nextAction: string;
  score: number;
  band: ScoreBand;
  factors: {
    buyingIntent: number;
    budgetSignals: number;
    eventDateClose: number;
    engagement: number;
    sentiment: number;
    objections: number;
    callLength: number;
  };
  rationale: string;
}
