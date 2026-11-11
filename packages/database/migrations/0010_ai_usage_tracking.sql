-- Migration: 0010_ai_usage_tracking.sql
-- Phase 11.1 — AI Usage Tracking & Billing Limits
-- Creates daily aggregation table for AI token consumption tracking per organization.
-- Aligned with SaaS subscription billing cycles for rate limiting and analytics.

-- ── AI Usage Daily Aggregation Table ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app.agent_usage_daily (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  
  -- Date partition (YYYY-MM-DD UTC)
  usage_date TEXT NOT NULL,
  
  -- Billing context for fast monthly aggregation (YYYY-MM format)
  -- Q1 Decision: Hard reset at currentPeriodStart (aligns with Stripe billing)
  period_month TEXT NOT NULL,
  
  -- Trial tracking for analytics
  -- Q2 Decision: Track trial AI usage separately for analytics
  is_trial_usage BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Aggregated token metrics
  total_tokens_in INTEGER NOT NULL DEFAULT 0,
  total_tokens_out INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  
  -- Cost tracking (6 decimal precision for USD microcents)
  total_cost_usd TEXT NOT NULL DEFAULT '0.000000',
  
  -- Run statistics
  run_count INTEGER NOT NULL DEFAULT 0,
  successful_runs INTEGER NOT NULL DEFAULT 0,
  failed_runs INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Unique constraint: one row per org per day
CREATE UNIQUE INDEX IF NOT EXISTS agent_usage_daily_org_date_unique 
  ON app.agent_usage_daily(organization_id, usage_date);

-- Fast monthly aggregation query (for rate limiting checks)
-- Q1 Decision: Hard reset at billing cycle, so we query by period_month
CREATE INDEX IF NOT EXISTS agent_usage_daily_org_period_idx 
  ON app.agent_usage_daily(organization_id, period_month);

-- Trial usage analytics
-- Q2 Decision: Track trial usage separately
CREATE INDEX IF NOT EXISTS agent_usage_daily_trial_idx 
  ON app.agent_usage_daily(is_trial_usage);

-- Date range queries for usage history dashboard
CREATE INDEX IF NOT EXISTS agent_usage_daily_date_idx 
  ON app.agent_usage_daily(usage_date);

-- ── Comments ──────────────────────────────────────────────────────────────────

COMMENT ON TABLE app.agent_usage_daily IS 
  'Daily AI usage aggregation for billing rate limits and analytics. One row per organization per day.';

COMMENT ON COLUMN app.agent_usage_daily.usage_date IS 
  'Date in YYYY-MM-DD format (UTC timezone).';

COMMENT ON COLUMN app.agent_usage_daily.period_month IS 
  'Billing month in YYYY-MM format (UTC), aligned with currentPeriodStart from saas_subscriptions.';

COMMENT ON COLUMN app.agent_usage_daily.is_trial_usage IS 
  'True if this usage occurred during a trial period (Q2: track separately for analytics).';

COMMENT ON COLUMN app.agent_usage_daily.total_tokens IS 
  'Sum of total_tokens_in + total_tokens_out for convenience.';

COMMENT ON COLUMN app.agent_usage_daily.total_cost_usd IS 
  'Cumulative USD cost for this day (6 decimal precision).';
