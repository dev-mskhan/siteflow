import { sql } from 'drizzle-orm';
import { check, date, index, integer, numeric, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { appSchema, users } from './auth.schema';
import { organizations } from './org.schema';
import { projects } from './project.schema';
import { materials } from './procurement.schema';

export const materialRateVersions = appSchema.table(
  'material_rate_versions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    materialId: text('material_id')
      .notNull()
      .references(() => materials.id, { onDelete: 'restrict' }),
    scope: text('scope').notNull(),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    unitCode: text('unit_code').notNull(),
    unitPrice: numeric('unit_price', { precision: 15, scale: 4 }).notNull(),
    currencyCode: text('currency_code').notNull(),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    status: text('status').notNull().default('DRAFT'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    approvedBy: text('approved_by').references(() => users.id, { onDelete: 'restrict' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('material_rate_versions_version_unique').on(
      t.organizationId,
      t.materialId,
      t.scope,
      t.projectId,
      t.versionNumber,
    ),
    index('material_rate_versions_lookup_idx').on(t.organizationId, t.materialId, t.scope, t.status),
    check('material_rate_versions_price_gte_0', sql`${t.unitPrice} >= 0`),
    check(
      'material_rate_versions_period_valid',
      sql`${t.effectiveTo} IS NULL OR ${t.effectiveTo} > ${t.effectiveFrom}`,
    ),
    check(
      'material_rate_versions_scope_valid',
      sql`(${t.scope} = 'ORGANIZATION' AND ${t.projectId} IS NULL) OR (${t.scope} = 'PROJECT' AND ${t.projectId} IS NOT NULL)`,
    ),
    check(
      'material_rate_versions_status_valid',
      sql`${t.status} IN ('DRAFT', 'APPROVED', 'RETIRED')`,
    ),
  ],
);

export type MaterialRateVersion = typeof materialRateVersions.$inferSelect;
export type MaterialRateScope = 'ORGANIZATION' | 'PROJECT';
export type MaterialRateStatus = 'DRAFT' | 'APPROVED' | 'RETIRED';
