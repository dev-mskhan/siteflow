-- Migration 0057: AI module tables
-- agent_runs, agent_tool_calls, agent_approvals, agent_usage_daily
-- All tables live in the 'app' schema, consistent with the rest of the monolith.

-- ── Enums ──────────────────────────────────────────────────────────────────────

CREATE TYPE app.agent_run_status AS ENUM (
  'QUEUED',
  'RUNNING',
  'AWAITING_APPROVAL',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE app.agent_run_trigger AS ENUM (
  'USER',
  'EVENT',
  'SCHEDULE'
);

CREATE TYPE app.agent_tool_call_status AS ENUM (
  'SUCCESS',
  'ERROR',
  'SKIPPED'
);

CREATE TYPE app.agent_risk_tier AS ENUM (
  'READ',
  'DRAFT',
  'BINDING'
);

CREATE TYPE app.agent_approval_status AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED'
);

-- ── agent_runs ─────────────────────────────────────────────────────────────────

CREATE TABLE app.agent_runs (
  id                  text        PRIMARY KEY,
  organization_id     text        NOT NULL,
  project_id          text,
  agent               text        NOT NULL,
  trigger             app.agent_run_trigger NOT NULL,
  trigger_ref         text,
  status              app.agent_run_status  NOT NULL DEFAULT 'QUEUED',
  input_snapshot      jsonb       NOT NULL DEFAULT '{}',
  output              jsonb,
  error               text,
  tokens_in           integer     NOT NULL DEFAULT 0,
  tokens_out          integer     NOT NULL DEFAULT 0,
  cost_usd            numeric(10,6) NOT NULL DEFAULT 0,
  trace_id            text,
  correlation_id      text,
  created_by          text        NOT NULL,
  started_at          timestamptz,
  finished_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT agent_runs_tokens_in_nonneg  CHECK (tokens_in  >= 0),
  CONSTRAINT agent_runs_tokens_out_nonneg CHECK (tokens_out >= 0),
  CONSTRAINT agent_runs_cost_nonneg       CHECK (cost_usd   >= 0),
  CONSTRAINT agent_runs_started_at_check
    CHECK (started_at  IS NULL OR status <> 'QUEUED'),
  CONSTRAINT agent_runs_finished_at_check
    CHECK (finished_at IS NULL OR status IN ('SUCCEEDED', 'FAILED', 'CANCELLED'))
);

CREATE INDEX agent_runs_org_status_created_idx ON app.agent_runs (organization_id, status, created_at DESC);
CREATE INDEX agent_runs_org_project_idx        ON app.agent_runs (organization_id, project_id);
CREATE INDEX agent_runs_org_agent_idx          ON app.agent_runs (organization_id, agent);
CREATE INDEX agent_runs_created_by_idx         ON app.agent_runs (created_by);
CREATE INDEX agent_runs_trace_id_idx           ON app.agent_runs (trace_id);

-- ── agent_tool_calls ───────────────────────────────────────────────────────────

CREATE TABLE app.agent_tool_calls (
  id              text        PRIMARY KEY,
  run_id          text        NOT NULL,
  organization_id text        NOT NULL,
  tool_name       text        NOT NULL,
  risk_tier       app.agent_risk_tier         NOT NULL,
  args_redacted   jsonb       NOT NULL DEFAULT '{}',
  result_summary  jsonb,
  status          app.agent_tool_call_status  NOT NULL,
  error_message   text,
  duration_ms     integer,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT agent_tool_calls_duration_nonneg
    CHECK (duration_ms IS NULL OR duration_ms >= 0)
);

CREATE INDEX agent_tool_calls_run_idx      ON app.agent_tool_calls (run_id, created_at);
CREATE INDEX agent_tool_calls_org_tool_idx ON app.agent_tool_calls (organization_id, tool_name);

-- ── agent_approvals ────────────────────────────────────────────────────────────

CREATE TABLE app.agent_approvals (
  id              text        PRIMARY KEY,
  run_id          text        NOT NULL,
  organization_id text        NOT NULL,
  proposal_type   text        NOT NULL,
  proposal        jsonb       NOT NULL,
  status          app.agent_approval_status NOT NULL DEFAULT 'PENDING',
  decided_by      text,
  decided_at      timestamptz,
  decision_note   text,
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT agent_approvals_decision_metadata_check
    CHECK (status = 'PENDING' OR (decided_by IS NOT NULL AND decided_at IS NOT NULL)),
  CONSTRAINT agent_approvals_expires_positive
    CHECK (expires_at > created_at)
);

-- Only one PENDING approval per run at a time
CREATE UNIQUE INDEX agent_approvals_run_pending_unique
  ON app.agent_approvals (run_id)
  WHERE status = 'PENDING';

CREATE INDEX agent_approvals_org_status_idx ON app.agent_approvals (organization_id, status, created_at DESC);
CREATE INDEX agent_approvals_run_idx        ON app.agent_approvals (run_id);
CREATE INDEX agent_approvals_expires_idx    ON app.agent_approvals (expires_at);

-- ── agent_usage_daily ──────────────────────────────────────────────────────────

CREATE TABLE app.agent_usage_daily (
  id              text        PRIMARY KEY,
  organization_id text        NOT NULL,
  day             date        NOT NULL,
  agent           text        NOT NULL,
  runs_count      integer     NOT NULL DEFAULT 0,
  tokens_in       integer     NOT NULL DEFAULT 0,
  tokens_out      integer     NOT NULL DEFAULT 0,
  cost_usd        numeric(10,6) NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT agent_usage_daily_runs_nonneg
    CHECK (runs_count >= 0),
  CONSTRAINT agent_usage_daily_tokens_nonneg
    CHECK (tokens_in >= 0 AND tokens_out >= 0),
  CONSTRAINT agent_usage_daily_cost_nonneg
    CHECK (cost_usd >= 0)
);

CREATE UNIQUE INDEX agent_usage_daily_org_day_agent_unique
  ON app.agent_usage_daily (organization_id, day, agent);

CREATE INDEX agent_usage_daily_org_day_idx ON app.agent_usage_daily (organization_id, day);
