import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  jsonb,
  numeric,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { appSchema, users } from './auth.schema';
import { organizations } from './org.schema';
import { projects } from './project.schema';

export type CommercialJsonValue =
  null | boolean | number | string | CommercialJsonValue[] | { [key: string]: CommercialJsonValue };

export const commercialIdempotencyKeys = appSchema.table(
  'commercial_idempotency_keys',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    operation: text('operation').notNull(),
    keyHash: text('key_hash').notNull(),
    requestHash: text('request_hash').notNull(),
    responseBody: jsonb('response_body').$type<CommercialJsonValue>(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('commercial_idempotency_scope_unique').on(t.organizationId, t.operation, t.keyHash),
    index('commercial_idempotency_created_idx').on(t.createdAt),
    check(
      'commercial_idempotency_operation_length',
      sql`char_length(${t.operation}) BETWEEN 1 AND 128`,
    ),
    check('commercial_idempotency_key_hash_length', sql`char_length(${t.keyHash}) = 64`),
    check('commercial_idempotency_request_hash_length', sql`char_length(${t.requestHash}) = 64`),
  ],
);

export const financialAuditEvents = appSchema.table(
  'financial_audit_events',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id').notNull(),
    actorUserId: text('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    previousState: jsonb('previous_state').$type<Record<string, unknown> | null>(),
    newState: jsonb('new_state').$type<Record<string, unknown> | null>(),
    amount: numeric('amount', { precision: 15, scale: 2 }),
    currencyCode: text('currency_code'),
    reason: text('reason'),
    requestId: text('request_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'financial_audit_project_org_fk',
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('restrict'),
    index('financial_audit_org_project_created_idx').on(
      t.organizationId,
      t.projectId,
      t.createdAt,
      t.id,
    ),
    index('financial_audit_entity_idx').on(
      t.organizationId,
      t.projectId,
      t.entityType,
      t.entityId,
      t.createdAt,
    ),
    index('financial_audit_actor_idx').on(t.actorUserId, t.createdAt),
    check(
      'financial_audit_currency_length',
      sql`${t.currencyCode} IS NULL OR char_length(${t.currencyCode}) = 3`,
    ),
    check(
      'financial_audit_amount_requires_currency',
      sql`${t.amount} IS NULL OR ${t.currencyCode} IS NOT NULL`,
    ),
    check('financial_audit_action_nonempty', sql`char_length(${t.action}) > 0`),
    check('financial_audit_entity_type_nonempty', sql`char_length(${t.entityType}) > 0`),
    check('financial_audit_entity_id_nonempty', sql`char_length(${t.entityId}) > 0`),
    check('financial_audit_request_id_nonempty', sql`char_length(${t.requestId}) > 0`),
  ],
);

export type CommercialIdempotencyKey = typeof commercialIdempotencyKeys.$inferSelect;
export type NewCommercialIdempotencyKey = typeof commercialIdempotencyKeys.$inferInsert;
export type FinancialAuditEvent = typeof financialAuditEvents.$inferSelect;
export type NewFinancialAuditEvent = typeof financialAuditEvents.$inferInsert;
