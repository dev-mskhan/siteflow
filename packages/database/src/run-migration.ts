// packages/database/src/run-migration.ts
import postgres from 'postgres';

const connectionString = process.env['DATABASE_URL'] ?? 'postgres://siteflow:siteflow@localhost:5434/siteflow';
const sql = postgres(connectionString);

async function run() {
  console.log('Applying Phase 1 Database Tables & Enums directly...');

  await sql.unsafe(`
    CREATE SCHEMA IF NOT EXISTS "app";

    DO $$ BEGIN
      CREATE TYPE "app"."user_status" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "app"."oauth_provider" AS ENUM('GOOGLE', 'GITHUB', 'MICROSOFT');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "app"."outbox_status" AS ENUM('PENDING', 'PROCESSED', 'FAILED');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "app"."org_status" AS ENUM('ACTIVE', 'SUSPENDED', 'ARCHIVED');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "app"."member_status" AS ENUM('ACTIVE', 'SUSPENDED', 'REMOVED');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "app"."invitation_status" AS ENUM('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "app"."users" (
      "id" text PRIMARY KEY NOT NULL,
      "email" text NOT NULL UNIQUE,
      "email_verified_at" timestamp with time zone,
      "password_hash" text,
      "first_name" text NOT NULL,
      "last_name" text,
      "status" "app"."user_status" DEFAULT 'ACTIVE' NOT NULL,
      "last_login_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "app"."oauth_accounts" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL REFERENCES "app"."users"("id") ON DELETE CASCADE,
      "provider" "app"."oauth_provider" NOT NULL,
      "provider_account_id" text NOT NULL,
      "email" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "oauth_provider_account_idx" ON "app"."oauth_accounts" ("provider", "provider_account_id");

    CREATE TABLE IF NOT EXISTS "app"."sessions" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL REFERENCES "app"."users"("id") ON DELETE CASCADE,
      "refresh_token_hash" text NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "revoked_at" timestamp with time zone,
      "last_used_at" timestamp with time zone,
      "ip_address" text,
      "user_agent" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "app"."email_verification_tokens" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL REFERENCES "app"."users"("id") ON DELETE CASCADE,
      "token_hash" text NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "used_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "app"."password_reset_tokens" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL REFERENCES "app"."users"("id") ON DELETE CASCADE,
      "token_hash" text NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "used_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "app"."outbox_events" (
      "id" text PRIMARY KEY NOT NULL,
      "organization_id" text,
      "event_type" text NOT NULL,
      "payload" jsonb NOT NULL,
      "status" "app"."outbox_status" DEFAULT 'PENDING' NOT NULL,
      "retry_count" integer DEFAULT 0 NOT NULL,
      "last_error" text,
      "processed_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "outbox_events_org_idx" ON "app"."outbox_events" ("organization_id");
    CREATE INDEX IF NOT EXISTS "outbox_events_status_idx" ON "app"."outbox_events" ("status", "created_at");

    CREATE TABLE IF NOT EXISTS "app"."organizations" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "slug" text NOT NULL,
      "status" "app"."org_status" DEFAULT 'ACTIVE' NOT NULL,
      "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "created_by" text NOT NULL REFERENCES "app"."users"("id"),
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_unique" ON "app"."organizations" ("slug");

    CREATE TABLE IF NOT EXISTS "app"."roles" (
      "id" text PRIMARY KEY NOT NULL,
      "organization_id" text NOT NULL REFERENCES "app"."organizations"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "description" text,
      "is_system" boolean DEFAULT false NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "roles_org_name_unique" ON "app"."roles" ("organization_id", "name");

    CREATE TABLE IF NOT EXISTS "app"."permissions" (
      "id" text PRIMARY KEY NOT NULL,
      "key" text NOT NULL UNIQUE,
      "description" text
    );

    CREATE TABLE IF NOT EXISTS "app"."role_permissions" (
      "role_id" text NOT NULL REFERENCES "app"."roles"("id") ON DELETE CASCADE,
      "permission_id" text NOT NULL REFERENCES "app"."permissions"("id") ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_unique" ON "app"."role_permissions" ("role_id", "permission_id");

    CREATE TABLE IF NOT EXISTS "app"."organization_memberships" (
      "id" text PRIMARY KEY NOT NULL,
      "organization_id" text NOT NULL REFERENCES "app"."organizations"("id") ON DELETE CASCADE,
      "user_id" text NOT NULL REFERENCES "app"."users"("id") ON DELETE CASCADE,
      "role_id" text NOT NULL REFERENCES "app"."roles"("id"),
      "status" "app"."member_status" DEFAULT 'ACTIVE' NOT NULL,
      "joined_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "memberships_org_user_unique" ON "app"."organization_memberships" ("organization_id", "user_id");
    CREATE INDEX IF NOT EXISTS "memberships_org_id_idx" ON "app"."organization_memberships" ("organization_id");
    CREATE INDEX IF NOT EXISTS "memberships_user_id_idx" ON "app"."organization_memberships" ("user_id");

    CREATE TABLE IF NOT EXISTS "app"."invitations" (
      "id" text PRIMARY KEY NOT NULL,
      "organization_id" text NOT NULL REFERENCES "app"."organizations"("id") ON DELETE CASCADE,
      "email" text NOT NULL,
      "role_id" text NOT NULL REFERENCES "app"."roles"("id"),
      "token_hash" text NOT NULL,
      "status" "app"."invitation_status" DEFAULT 'PENDING' NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "accepted_at" timestamp with time zone,
      "invited_by" text NOT NULL REFERENCES "app"."users"("id"),
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "invitations_token_hash_unique" ON "app"."invitations" ("token_hash");
    CREATE INDEX IF NOT EXISTS "invitations_email_org_idx" ON "app"."invitations" ("email", "organization_id");

    CREATE TABLE IF NOT EXISTS "app"."audit_logs" (
      "id" text PRIMARY KEY NOT NULL,
      "organization_id" text NOT NULL REFERENCES "app"."organizations"("id"),
      "actor_user_id" text REFERENCES "app"."users"("id"),
      "action" text NOT NULL,
      "resource_type" text,
      "resource_id" text,
      "metadata" jsonb DEFAULT '{}'::jsonb,
      "ip_address" text,
      "user_agent" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "audit_logs_org_idx" ON "app"."audit_logs" ("organization_id");
    CREATE INDEX IF NOT EXISTS "audit_logs_actor_idx" ON "app"."audit_logs" ("actor_user_id");

    -- Phase 2 & 3 Additions
    ALTER TABLE "app"."projects" ADD COLUMN IF NOT EXISTS "schedule_revision" integer DEFAULT 1 NOT NULL;

    DO $$ BEGIN
      CREATE TYPE "app"."task_type" AS ENUM('TASK', 'MILESTONE', 'SUMMARY');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "app"."task_status" AS ENUM('NOT_STARTED', 'READY', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "app"."task_priority" AS ENUM('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "app"."constraint_type" AS ENUM('ASAP', 'START_NO_EARLIER_THAN', 'FINISH_NO_LATER_THAN');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "app"."tasks" (
      "id" text PRIMARY KEY NOT NULL,
      "organization_id" text NOT NULL REFERENCES "app"."organizations"("id") ON DELETE RESTRICT,
      "project_id" text NOT NULL REFERENCES "app"."projects"("id") ON DELETE CASCADE,
      "phase_id" text REFERENCES "app"."project_phases"("id") ON DELETE SET NULL,
      "parent_task_id" text,
      "task_code" text NOT NULL,
      "external_reference" text,
      "name" text NOT NULL,
      "description" text,
      "task_type" "app"."task_type" DEFAULT 'TASK' NOT NULL,
      "status" "app"."task_status" DEFAULT 'NOT_STARTED' NOT NULL,
      "priority" "app"."task_priority" DEFAULT 'NORMAL' NOT NULL,
      "constraint_type" "app"."constraint_type" DEFAULT 'ASAP' NOT NULL,
      "constraint_date" date,
      "assigned_to" text REFERENCES "app"."users"("id") ON DELETE SET NULL,
      "subcontractor_id" text,
      "current_start_date" date,
      "current_finish_date" date,
      "current_duration_days" integer DEFAULT 1 NOT NULL,
      "actual_start_date" date,
      "actual_finish_date" date,
      "float_days" integer,
      "is_critical" boolean DEFAULT false NOT NULL,
      "progress_percent" integer DEFAULT 0 NOT NULL,
      "position" integer DEFAULT 0 NOT NULL,
      "version" integer DEFAULT 1 NOT NULL,
      "created_by" text REFERENCES "app"."users"("id") ON DELETE SET NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "tasks_progress_percent_range" CHECK ("progress_percent" >= 0 AND "progress_percent" <= 100)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "tasks_project_code_unique" ON "app"."tasks" ("project_id", "task_code");
    CREATE UNIQUE INDEX IF NOT EXISTS "tasks_id_org_unique" ON "app"."tasks" ("id", "organization_id");
    CREATE INDEX IF NOT EXISTS "tasks_project_idx" ON "app"."tasks" ("project_id");
    CREATE INDEX IF NOT EXISTS "tasks_org_project_idx" ON "app"."tasks" ("organization_id", "project_id");
    CREATE INDEX IF NOT EXISTS "tasks_project_parent_idx" ON "app"."tasks" ("project_id", "parent_task_id");
    CREATE INDEX IF NOT EXISTS "tasks_project_status_idx" ON "app"."tasks" ("project_id", "status");
    CREATE INDEX IF NOT EXISTS "tasks_project_type_idx" ON "app"."tasks" ("project_id", "task_type");
    CREATE INDEX IF NOT EXISTS "tasks_project_critical_idx" ON "app"."tasks" ("project_id", "is_critical");

    CREATE TABLE IF NOT EXISTS "app"."task_document_links" (
      "id" text PRIMARY KEY NOT NULL,
      "organization_id" text NOT NULL,
      "project_id" text NOT NULL,
      "task_id" text NOT NULL REFERENCES "app"."tasks"("id") ON DELETE CASCADE,
      "document_id" text NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "task_doc_unique" ON "app"."task_document_links" ("task_id", "document_id");
    CREATE INDEX IF NOT EXISTS "task_doc_links_task_idx" ON "app"."task_document_links" ("task_id");

    CREATE TABLE IF NOT EXISTS "app"."project_calendars" (
      "id" text PRIMARY KEY NOT NULL,
      "organization_id" text NOT NULL REFERENCES "app"."organizations"("id") ON DELETE RESTRICT,
      "project_id" text NOT NULL UNIQUE REFERENCES "app"."projects"("id") ON DELETE CASCADE,
      "name" text DEFAULT 'Standard Construction Calendar' NOT NULL,
      "timezone" text DEFAULT 'UTC' NOT NULL,
      "work_days" jsonb NOT NULL,
      "hours_per_day" numeric(4, 2) DEFAULT '8.00' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "project_calendars_org_idx" ON "app"."project_calendars" ("organization_id");

    CREATE TABLE IF NOT EXISTS "app"."calendar_exceptions" (
      "id" text PRIMARY KEY NOT NULL,
      "calendar_id" text NOT NULL REFERENCES "app"."project_calendars"("id") ON DELETE CASCADE,
      "exception_date" date NOT NULL,
      "is_working_day" boolean NOT NULL,
      "name" text NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "cal_exc_date_unique" ON "app"."calendar_exceptions" ("calendar_id", "exception_date");
    CREATE INDEX IF NOT EXISTS "cal_exc_calendar_idx" ON "app"."calendar_exceptions" ("calendar_id");

    -- Chunk 3.3: Task Dependencies
    DO $$ BEGIN
      CREATE TYPE "app"."dependency_type" AS ENUM('FS', 'SS', 'FF', 'SF');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "app"."task_dependencies" (
      "id" text PRIMARY KEY NOT NULL,
      "organization_id" text NOT NULL REFERENCES "app"."organizations"("id") ON DELETE RESTRICT,
      "project_id" text NOT NULL REFERENCES "app"."projects"("id") ON DELETE CASCADE,
      "task_id" text NOT NULL REFERENCES "app"."tasks"("id") ON DELETE CASCADE,
      "predecessor_id" text NOT NULL REFERENCES "app"."tasks"("id") ON DELETE CASCADE,
      "dependency_type" "app"."dependency_type" DEFAULT 'FS' NOT NULL,
      "lag_days" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "task_dep_no_self_ref" CHECK ("task_id" != "predecessor_id")
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "task_dependencies_unique" ON "app"."task_dependencies" ("task_id", "predecessor_id");
    CREATE INDEX IF NOT EXISTS "task_dependencies_project_idx" ON "app"."task_dependencies" ("project_id");
    CREATE INDEX IF NOT EXISTS "task_dependencies_predecessor_idx" ON "app"."task_dependencies" ("predecessor_id");

    -- Chunk 3.5: Schedule Baselines
    DO $$ BEGIN
      CREATE TYPE "app"."baseline_status" AS ENUM('DRAFT', 'ACTIVE', 'SUPERSEDED');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "app"."schedule_baselines" (
      "id" text PRIMARY KEY NOT NULL,
      "organization_id" text NOT NULL REFERENCES "app"."organizations"("id") ON DELETE RESTRICT,
      "project_id" text NOT NULL REFERENCES "app"."projects"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "description" text,
      "status" "app"."baseline_status" DEFAULT 'DRAFT' NOT NULL,
      "activated_at" timestamp with time zone,
      "activated_by" text REFERENCES "app"."users"("id") ON DELETE SET NULL,
      "created_by" text REFERENCES "app"."users"("id") ON DELETE SET NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "schedule_baselines_project_idx" ON "app"."schedule_baselines" ("project_id");
    CREATE INDEX IF NOT EXISTS "schedule_baselines_org_project_idx" ON "app"."schedule_baselines" ("organization_id", "project_id");
    CREATE INDEX IF NOT EXISTS "schedule_baselines_status_idx" ON "app"."schedule_baselines" ("project_id", "status");

    CREATE TABLE IF NOT EXISTS "app"."schedule_baseline_tasks" (
      "id" text PRIMARY KEY NOT NULL,
      "baseline_id" text NOT NULL REFERENCES "app"."schedule_baselines"("id") ON DELETE CASCADE,
      "task_id" text NOT NULL REFERENCES "app"."tasks"("id") ON DELETE CASCADE,
      "baseline_start_date" date NOT NULL,
      "baseline_finish_date" date NOT NULL,
      "baseline_duration_days" integer NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "baseline_task_unique" ON "app"."schedule_baseline_tasks" ("baseline_id", "task_id");
    CREATE INDEX IF NOT EXISTS "schedule_baseline_tasks_baseline_idx" ON "app"."schedule_baseline_tasks" ("baseline_id");

    -- Chunk 3.6: Daily Field Logs
    DO $$ BEGIN
      CREATE TYPE "app"."field_log_status" AS ENUM('DRAFT', 'SUBMITTED', 'LOCKED');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "app"."daily_field_logs" (
      "id" text PRIMARY KEY NOT NULL,
      "organization_id" text NOT NULL REFERENCES "app"."organizations"("id") ON DELETE RESTRICT,
      "project_id" text NOT NULL REFERENCES "app"."projects"("id") ON DELETE CASCADE,
      "log_date" date NOT NULL,
      "supervisor_id" text NOT NULL REFERENCES "app"."users"("id") ON DELETE RESTRICT,
      "status" "app"."field_log_status" DEFAULT 'DRAFT' NOT NULL,
      "notes" text,
      "locked_at" timestamp with time zone,
      "locked_by" text REFERENCES "app"."users"("id") ON DELETE SET NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "daily_field_logs_date_unique" ON "app"."daily_field_logs" ("project_id", "log_date");
    CREATE INDEX IF NOT EXISTS "daily_field_logs_project_idx" ON "app"."daily_field_logs" ("project_id");
    CREATE INDEX IF NOT EXISTS "daily_field_logs_org_project_idx" ON "app"."daily_field_logs" ("organization_id", "project_id");
    CREATE INDEX IF NOT EXISTS "daily_field_logs_supervisor_idx" ON "app"."daily_field_logs" ("supervisor_id");

    CREATE TABLE IF NOT EXISTS "app"."field_log_task_entries" (
      "id" text PRIMARY KEY NOT NULL,
      "log_id" text NOT NULL REFERENCES "app"."daily_field_logs"("id") ON DELETE CASCADE,
      "task_id" text NOT NULL REFERENCES "app"."tasks"("id") ON DELETE CASCADE,
      "completion_pct_recorded" integer NOT NULL,
      "quantity_completed" numeric(10, 2),
      "unit" text,
      "notes" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "field_log_task_entries_unique" ON "app"."field_log_task_entries" ("log_id", "task_id");
    CREATE INDEX IF NOT EXISTS "field_log_task_entries_log_idx" ON "app"."field_log_task_entries" ("log_id");
    CREATE INDEX IF NOT EXISTS "field_log_task_entries_task_idx" ON "app"."field_log_task_entries" ("task_id");

    -- Chunk 3.7: Issues
    DO $$ BEGIN
      CREATE TYPE "app"."issue_status" AS ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "app"."issues" (
      "id" text PRIMARY KEY NOT NULL,
      "organization_id" text NOT NULL REFERENCES "app"."organizations"("id") ON DELETE RESTRICT,
      "project_id" text NOT NULL REFERENCES "app"."projects"("id") ON DELETE CASCADE,
      "title" text NOT NULL,
      "description" text,
      "status" "app"."issue_status" DEFAULT 'OPEN' NOT NULL,
      "reported_impact_days" integer DEFAULT 0 NOT NULL,
      "approved_impact_days" integer DEFAULT 0 NOT NULL,
      "assigned_to" text REFERENCES "app"."users"("id") ON DELETE SET NULL,
      "created_by" text REFERENCES "app"."users"("id") ON DELETE SET NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "app"."issues" ADD COLUMN IF NOT EXISTS "created_by" text REFERENCES "app"."users"("id") ON DELETE SET NULL;
    ALTER TABLE "app"."issues" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

    CREATE INDEX IF NOT EXISTS "issues_project_idx" ON "app"."issues" ("project_id");
    CREATE INDEX IF NOT EXISTS "issues_org_project_idx" ON "app"."issues" ("organization_id", "project_id");

    -- Chunk 3.8: Schedule Changes
    DO $$ BEGIN
      CREATE TYPE "app"."schedule_source_type" AS ENUM('USER', 'ISSUE', 'RFI', 'CHANGE_ORDER', 'MATERIAL_DELAY', 'WEATHER', 'SYSTEM_CALCULATION');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "app"."schedule_changes" (
      "id" text PRIMARY KEY NOT NULL,
      "organization_id" text NOT NULL,
      "project_id" text NOT NULL REFERENCES "app"."projects"("id") ON DELETE CASCADE,
      "task_id" text NOT NULL REFERENCES "app"."tasks"("id") ON DELETE CASCADE,
      "source_type" "app"."schedule_source_type" NOT NULL,
      "source_id" text,
      "old_start_date" date,
      "old_finish_date" date,
      "new_start_date" date,
      "new_finish_date" date,
      "reason" text,
      "actor_user_id" text REFERENCES "app"."users"("id") ON DELETE SET NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "schedule_changes_project_idx" ON "app"."schedule_changes" ("project_id");
    CREATE INDEX IF NOT EXISTS "schedule_changes_task_idx" ON "app"."schedule_changes" ("task_id");

    -- Chunk 3.9: Project Schedule Metrics
    CREATE TABLE IF NOT EXISTS "app"."project_schedule_metrics" (
      "id" text PRIMARY KEY NOT NULL,
      "organization_id" text NOT NULL,
      "project_id" text NOT NULL REFERENCES "app"."projects"("id") ON DELETE CASCADE,
      "total_tasks" integer DEFAULT 0 NOT NULL,
      "completed_tasks" integer DEFAULT 0 NOT NULL,
      "critical_task_count" integer DEFAULT 0 NOT NULL,
      "schedule_revision" integer NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "project_schedule_metrics_org_project_unique" ON "app"."project_schedule_metrics" ("organization_id", "project_id");
    CREATE INDEX IF NOT EXISTS "project_schedule_metrics_project_idx" ON "app"."project_schedule_metrics" ("project_id");
  `);




  console.log('Migration successfully applied!');
  await sql.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
