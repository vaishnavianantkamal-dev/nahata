import { z } from 'zod';
import { Role, LeadSource, EventType, LeadStatus, ScoreBand, MessageChannel } from './enums';

export const phoneSchema = z.string().regex(/^\+91[6-9]\d{9}$/, 'Must be a valid Indian mobile number (+91XXXXXXXXXX)');

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: phoneSchema.optional(),
  role: z.nativeEnum(Role),
  password: z.string().min(8),
});

export const createLeadSchema = z.object({
  name: z.string().min(2).max(200),
  primaryPhone: phoneSchema,
  altPhone: phoneSchema.optional(),
  email: z.string().email().optional(),
  source: z.nativeEnum(LeadSource).default(LeadSource.MANUAL),
  sourceDetail: z.string().optional(),
  eventType: z.nativeEnum(EventType),
  guestCount: z.number().int().min(1).optional(),
  eventDate: z.string().optional(),
  budgetMin: z.number().int().min(0).optional(),
  budgetMax: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  stageId: z.string().optional(),
  ownerId: z.string().optional(),
});

export const updateLeadSchema = createLeadSchema.partial();

export const moveLeadStageSchema = z.object({
  stageId: z.string().min(1),
});

export const changeLeadSourceSchema = z.object({
  source: z.nativeEnum(LeadSource),
  sourceDetail: z.string().optional(),
});

export const assignLeadSchema = z.object({
  ownerId: z.string().nullable(),
});

export const updateLeadStatusSchema = z.object({
  status: z.nativeEnum(LeadStatus),
  lostReason: z.string().optional(),
});

export const addNoteSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const createStageSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
  wipLimit: z.number().int().min(1).optional(),
});

export const updateStageSchema = createStageSchema.partial();

export const reorderStagesSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
});

export const createTemplateGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export const createTemplateSchema = z.object({
  groupId: z.string().min(1),
  name: z.string().min(1).max(200),
  channel: z.nativeEnum(MessageChannel).default(MessageChannel.WHATSAPP),
  body: z.string().min(1).max(4096),
  language: z.string().default('en'),
  providerTemplateName: z.string().optional(),
  variables: z.record(z.string()).optional(),
});

export const updateTemplateSchema = createTemplateSchema.partial().omit({ groupId: true });

export const sendWhatsappSchema = z.object({
  leadId: z.string().min(1),
  templateId: z.string().optional(),
  body: z.string().optional(),
  variables: z.record(z.string()).optional(),
}).refine(d => d.templateId || d.body, { message: 'Either templateId or body must be provided' });

export const clickToCallSchema = z.object({
  leadId: z.string().min(1),
});

export const createSequenceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  trigger: z.string().optional(),
  stopOnReply: z.boolean().default(true),
  stopOnStageChange: z.boolean().default(true),
  steps: z.array(z.object({
    order: z.number().int().min(1),
    delayMinutes: z.number().int().min(0),
    templateId: z.string().min(1),
    condition: z.record(z.unknown()).optional(),
  })).optional(),
});

export const updateStagBindingSchema = z.object({
  templateId: z.string().nullable(),
  enabled: z.boolean(),
});

export const pipelineMoveSchema = z.object({
  leadId: z.string().min(1),
  toStageId: z.string().min(1),
  position: z.number().int().min(0).optional(),
});

export const analyticsRangeSchema = z.object({
  range: z.enum(['7d', '30d', 'this_month', 'custom']).default('this_month'),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type CreateSequenceInput = z.infer<typeof createSequenceSchema>;
