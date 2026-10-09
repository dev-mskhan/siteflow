import { z } from 'zod';

/**
 * Catalog of domain event names supported across SiteFlow workflows (mapped in 08-F0-AUDIT.md).
 */
export const DomainEventNameSchema = z.enum([
  'TaskCompleted',
  'TaskDelayed',
  'TaskDateChanged',
  'MaterialOrdered',
  'MaterialDelayed',
  'MaterialDelivered',
  'IssueCreated',
  'IssueResolved',
  'RfiCreated',
  'RfiOverdue',
  'SubmittalSubmitted',
  'SubmittalRejected',
  'InspectionScheduled',
  'InspectionFailed',
  'ChangeOrderCreated',
  'ChangeOrderApproved',
  'PaymentApplicationSubmitted',
  'PaymentOverdue',
  'DocumentExpiring',
  'SafetyIncidentCreated',
]);

export type DomainEventName = z.infer<typeof DomainEventNameSchema>;

export const ActorSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['USER', 'SYSTEM', 'API']).default('USER'),
  email: z.string().email().optional(),
});

export type Actor = z.infer<typeof ActorSchema>;

/**
 * Standard versioned domain event envelope contract (F.1).
 */
export const DomainEventEnvelopeSchema = z.object({
  id: z.string().min(1),
  name: DomainEventNameSchema,
  version: z.number().int().positive().default(1),
  occurredAt: z.string().datetime().or(z.date()),
  organizationId: z.string().min(1, 'organizationId is mandatory for tenant scoping'),
  projectId: z.string().optional().nullable(),
  actor: ActorSchema.optional().nullable(),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  correlationId: z.string().optional().nullable(),
  causationId: z.string().optional().nullable(),
  payload: z.record(z.unknown()),
});

export type DomainEventEnvelope = z.infer<typeof DomainEventEnvelopeSchema>;

export function parseDomainEvent(data: unknown): DomainEventEnvelope {
  return DomainEventEnvelopeSchema.parse(data);
}

export function safeParseDomainEvent(data: unknown) {
  return DomainEventEnvelopeSchema.safeParse(data);
}
