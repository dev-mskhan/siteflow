import { z } from 'zod';

const idSchema = z.string().min(1).max(128);
const textField = (max = 5000) => z.string().trim().max(max).nullable().optional();
const dateTimeSchema = z.string().datetime({ offset: true }).transform((value) => new Date(value));
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
});

export const createSafetyEventSchema = z.object({
  eventType: z.enum(['INCIDENT', 'NEAR_MISS', 'UNSAFE_CONDITION', 'UNSAFE_ACT', 'FIRST_AID']),
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().min(1).max(10000),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'FATALITY']).optional(),
  occurredAt: dateTimeSchema,
  location: textField(500),
  involvedParties: textField(5000),
  assignedTo: idSchema.nullable().optional(),
  immediateAction: textField(),
  notes: textField(),
});

export const updateSafetyEventSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().min(1).max(10000).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'FATALITY']).optional(),
  location: textField(500),
  involvedParties: textField(5000),
  assignedTo: idSchema.nullable().optional(),
  rootCause: textField(),
  immediateAction: textField(),
  notes: textField(),
  status: z.literal('CORRECTIVE_ACTION_REQUIRED').optional(),
}).refine((input) => Object.keys(input).length > 0, 'At least one field must be provided');

export const investigateSafetyEventSchema = z.object({
  rootCause: textField(),
  immediateAction: textField(),
});

export const closeSafetyEventSchema = z.object({
  notes: z.string().trim().min(1).max(5000),
});

export const createSafetyCorrectiveActionSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: textField(),
  assignedTo: idSchema.nullable().optional(),
  dueDate: dateSchema.nullable().optional(),
  notes: textField(),
});

export const createSafetyMeetingSchema = z.object({
  meetingType: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(500),
  scheduledAt: dateTimeSchema,
  conductedAt: dateTimeSchema.nullable().optional(),
  facilitatorId: idSchema.nullable().optional(),
  attendeeCount: z.number().int().min(0).max(10000).nullable().optional(),
  topicsCovered: textField(10000),
  notes: textField(),
});

export const listSafetyEventsQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum([
    'REPORTED',
    'UNDER_INVESTIGATION',
    'CORRECTIVE_ACTION_REQUIRED',
    'CORRECTIVE_ACTION_IN_PROGRESS',
    'CLOSED',
  ]).optional(),
  eventType: z.enum(['INCIDENT', 'NEAR_MISS', 'UNSAFE_CONDITION', 'UNSAFE_ACT', 'FIRST_AID']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'FATALITY']).optional(),
});

export const listSafetyMeetingsQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreateSafetyEventInput = z.infer<typeof createSafetyEventSchema>;
export type UpdateSafetyEventInput = z.infer<typeof updateSafetyEventSchema>;
export type InvestigateSafetyEventInput = z.infer<typeof investigateSafetyEventSchema>;
export type CloseSafetyEventInput = z.infer<typeof closeSafetyEventSchema>;
export type CreateSafetyCorrectiveActionInput = z.infer<typeof createSafetyCorrectiveActionSchema>;
export type CreateSafetyMeetingInput = z.infer<typeof createSafetyMeetingSchema>;
export type ListSafetyEventsQuery = z.infer<typeof listSafetyEventsQuerySchema>;
export type ListSafetyMeetingsQuery = z.infer<typeof listSafetyMeetingsQuerySchema>;
