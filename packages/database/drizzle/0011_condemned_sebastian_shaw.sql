-- Migration: Phase 2 — Project Core schema
-- Adds project-related enums, tables, and audit_logs.project_id column

-- ── New Enums ──────────────────────────────────────────────────────────────────
CREATE TYPE "app"."project_status" AS ENUM('DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "app"."project_type" AS ENUM('COMMERCIAL', 'RESIDENTIAL', 'INDUSTRIAL', 'INFRASTRUCTURE', 'OTHER');--> statement-breakpoint
CREATE TYPE "app"."project_role" AS ENUM('PROJECT_MANAGER', 'SITE_SUPERVISOR', 'PROJECT_MEMBER', 'FINANCE', 'PROCUREMENT', 'SUBCONTRACTOR', 'CLIENT');--> statement-breakpoint
CREATE TYPE "app"."project_member_status" AS ENUM('ACTIVE', 'REMOVED');--> statement-breakpoint
CREATE TYPE "app"."project_phase_status" AS ENUM('ACTIVE', 'ARCHIVED');--> statement-breakpoint

-- ── projects ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "app"."projects" (
  "id"                 text PRIMARY KEY NOT NULL,
  "organization_id"    text NOT NULL,
  "project_number"     text NOT NULL,
  "name"               text NOT NULL,
  "description"        text,
  "status"             "app"."project_status" NOT NULL DEFAULT 'DRAFT',
  "project_type"       "app"."project_type",
  "contract_value"     numeric(15, 2),
  "currency"           text NOT NULL,
  "planned_start_date" date,
  "planned_end_date"   date,
  "actual_start_date"  date,
  "actual_end_date"    date,
  "version"            integer NOT NULL DEFAULT 1,
  "created_by"         text,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "projects_currency_length" CHECK (char_length("currency") = 3)
);--> statement-breakpoint
ALTER TABLE "app"."projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "app"."projects" ADD CONSTRAINT "projects_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_org_idx" ON "app"."projects" ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_org_status_idx" ON "app"."projects" ("organization_id", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_org_created_at_idx" ON "app"."projects" ("organization_id", "created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "projects_org_number_unique" ON "app"."projects" ("organization_id", "project_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "projects_id_org_unique" ON "app"."projects" ("id", "organization_id");--> statement-breakpoint

-- ── project_settings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "app"."project_settings" (
  "id"             text PRIMARY KEY NOT NULL,
  "project_id"     text NOT NULL UNIQUE,
  "organization_id" text NOT NULL,
  "timezone"       text,
  "locale"         text,
  "date_format"    "app"."date_format",
  "time_format"    "app"."time_format",
  "unit_system"    "app"."unit_system",
  "week_starts_on" integer,
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "project_settings_week_starts_on_range"
    CHECK ("week_starts_on" IS NULL OR ("week_starts_on" >= 0 AND "week_starts_on" <= 6))
);--> statement-breakpoint
ALTER TABLE "app"."project_settings" ADD CONSTRAINT "project_settings_project_id_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app"."project_settings" ADD CONSTRAINT "project_settings_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE RESTRICT;--> statement-breakpoint

-- ── project_members ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "app"."project_members" (
  "id"              text PRIMARY KEY NOT NULL,
  "project_id"      text NOT NULL,
  "organization_id" text NOT NULL,
  "user_id"         text NOT NULL,
  "role"            "app"."project_role" NOT NULL,
  "status"          "app"."project_member_status" NOT NULL DEFAULT 'ACTIVE',
  "added_by"        text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint
ALTER TABLE "app"."project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app"."project_members" ADD CONSTRAINT "project_members_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "app"."project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app"."project_members" ADD CONSTRAINT "project_members_added_by_users_id_fk"
  FOREIGN KEY ("added_by") REFERENCES "app"."users"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_members_project_user_unique" ON "app"."project_members" ("project_id", "user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_members_org_user_idx" ON "app"."project_members" ("organization_id", "user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_members_project_status_idx" ON "app"."project_members" ("project_id", "status");--> statement-breakpoint

-- ── project_phases ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "app"."project_phases" (
  "id"              text PRIMARY KEY NOT NULL,
  "project_id"      text NOT NULL,
  "organization_id" text NOT NULL,
  "name"            text NOT NULL,
  "description"     text,
  "status"          "app"."project_phase_status" NOT NULL DEFAULT 'ACTIVE',
  "sort_order"      integer NOT NULL DEFAULT 0,
  "starts_at"       date,
  "ends_at"         date,
  "created_by"      text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint
ALTER TABLE "app"."project_phases" ADD CONSTRAINT "project_phases_project_id_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app"."project_phases" ADD CONSTRAINT "project_phases_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "app"."project_phases" ADD CONSTRAINT "project_phases_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_phases_project_sort_idx" ON "app"."project_phases" ("project_id", "sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_phases_org_project_idx" ON "app"."project_phases" ("organization_id", "project_id");--> statement-breakpoint

-- ── project_cost_codes ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "app"."project_cost_codes" (
  "id"              text PRIMARY KEY NOT NULL,
  "project_id"      text NOT NULL,
  "organization_id" text NOT NULL,
  "code"            text NOT NULL,
  "description"     text,
  "is_active"       boolean NOT NULL DEFAULT true,
  "created_by"      text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint
ALTER TABLE "app"."project_cost_codes" ADD CONSTRAINT "project_cost_codes_project_id_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app"."project_cost_codes" ADD CONSTRAINT "project_cost_codes_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "app"."project_cost_codes" ADD CONSTRAINT "project_cost_codes_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_cost_codes_project_code_unique" ON "app"."project_cost_codes" ("project_id", "code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_cost_codes_org_project_idx" ON "app"."project_cost_codes" ("organization_id", "project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_cost_codes_project_active_idx" ON "app"."project_cost_codes" ("project_id", "is_active");--> statement-breakpoint

-- ── audit_logs: add project_id column ────────────────────────────────────────
ALTER TABLE "app"."audit_logs" ADD COLUMN IF NOT EXISTS "project_id" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_project_idx" ON "app"."audit_logs" ("project_id");
