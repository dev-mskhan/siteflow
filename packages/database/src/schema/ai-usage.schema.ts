// packages/database/src/schema/ai-usage.schema.ts
// Phase 11.1 — AI Usage Tracking & Billing Limits
// Daily aggregation table for AI agent token consumption tracking per organization.
// Aligned with SaaS subscription billing cycles for rate limiting and analytics.

import {
  pgSchema,
  text,
  boolean,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { organizations } from './org.schema';

const appSchema = pgSchema('app');

// ── AI Usage Daily Aggregation ───────────────────────────────────────────────

export const agentUsageDaily = appSchema.table(
  'agent_usage_daily',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Date partition (YYYY-MM-DD UTC)
    usageDate: text('usage_date').notNull(),

    // Billing context for fast monthly aggregation
    periodMonth: text('period_month').notNull(), // YYYY-MM format

    // Trial tracking for analytics (Q2 decision: track separately)
    isTrialUsage: boolean('is_trial_usage').notNull().default(false),

    // Aggregated token metrics
    totalTokensIn: integer('total_tokens_in').notNull().default(0),
    totalTokensOut: integer('total_tokens_out').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),

    // Cost tracking (6 decimal precision for USD microcents)
    totalCostUsd: text('total_cost_usd').notNull().default('0.000000'),

    // Run statistics
    runCount: integer('run_count').notNull().default(0),
    successfulRuns: integer('successful_runs').notNull().default(0),
    failedRuns: integer('failed_runs').notNull().default(0),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    // Unique constraint: one row per org per day
    uniqueIndex('agent_usage_daily_org_date_unique').on(t.organizationId, t.usageDate),

    // Fast monthly aggregation query (Q1 decision: hard reset at billing cycle)
    index('agent_usage_daily_org_period_idx').on(t.organizationId, t.periodMonth),

    // Trial usage analytics (Q2 decision: track separately)
    index('agent_usage_daily_trial_idx').on(t.isTrialUsage),

    // Date range queries for usage history
    index('agent_usage_daily_date_idx').on(t.usageDate),
  ],
);

// ── TypeScript Types ──────────────────────────────────────────────────────────

export type AgentUsageDaily = typeof agentUsageDaily.$inferSelect;
export type NewAgentUsageDaily = typeof agentUsageDaily.$inferInsert;
