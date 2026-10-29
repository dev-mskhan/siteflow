-- 0062_ai_chat_and_approvals.sql
-- Add multi-provider, channel, conversation fields to agent_runs
-- Add exact-action binding columns to agent_approvals
-- Create agent_conversations and agent_messages tables
-- Seed AI permissions for default roles

ALTER TABLE "app"."agent_runs" ADD COLUMN IF NOT EXISTS "provider" text;
ALTER TABLE "app"."agent_runs" ADD COLUMN IF NOT EXISTS "model" text;
ALTER TABLE "app"."agent_runs" ADD COLUMN IF NOT EXISTS "channel" text;
ALTER TABLE "app"."agent_runs" ADD COLUMN IF NOT EXISTS "conversation_id" text;
ALTER TABLE "app"."agent_runs" ADD COLUMN IF NOT EXISTS "parent_run_id" text;
ALTER TABLE "app"."agent_runs" ADD COLUMN IF NOT EXISTS "prompt_version" text;

ALTER TABLE "app"."agent_approvals" ADD COLUMN IF NOT EXISTS "approved_tool_name" text;
ALTER TABLE "app"."agent_approvals" ADD COLUMN IF NOT EXISTS "approved_args_hash" text;

CREATE TABLE IF NOT EXISTS "app"."agent_conversations" (
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL,
  "project_id" text,
  "created_by" text NOT NULL,
  "agent" text NOT NULL,
  "title" text,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "agent_conversations_org_idx" ON "app"."agent_conversations" ("organization_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "agent_conversations_user_idx" ON "app"."agent_conversations" ("created_by");
CREATE INDEX IF NOT EXISTS "agent_conversations_project_idx" ON "app"."agent_conversations" ("project_id");

CREATE TABLE IF NOT EXISTS "app"."agent_messages" (
  "id" text PRIMARY KEY,
  "conversation_id" text NOT NULL,
  "organization_id" text NOT NULL,
  "role" text NOT NULL,
  "channel" text NOT NULL,
  "content" text NOT NULL,
  "run_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "agent_messages_conv_idx" ON "app"."agent_messages" ("conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "agent_messages_run_idx" ON "app"."agent_messages" ("run_id");

-- Seed AI permissions
INSERT INTO "app"."permissions" ("id", "key", "description") VALUES
  ('perm_ai_runs_create', 'ai.runs.create', 'Trigger new AI agent runs'),
  ('perm_ai_runs_read', 'ai.runs.read', 'Read AI agent runs and tool executions'),
  ('perm_ai_runs_cancel', 'ai.runs.cancel', 'Cancel queued or running AI agent runs'),
  ('perm_ai_approvals_decide', 'ai.approvals.decide', 'Approve or reject AI agent binding actions')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "app"."role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "app"."roles" r
CROSS JOIN "app"."permissions" p
WHERE r."is_system" = true
  AND (
    (r."name" IN ('Organization Admin', 'Finance')
      AND p."key" IN ('ai.runs.create', 'ai.runs.read', 'ai.runs.cancel', 'ai.approvals.decide'))
    OR (r."name" = 'Project Manager'
      AND p."key" IN ('ai.runs.create', 'ai.runs.read', 'ai.runs.cancel'))
  )
ON CONFLICT DO NOTHING;
