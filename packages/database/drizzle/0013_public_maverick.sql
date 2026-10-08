CREATE TYPE "app"."baseline_status" AS ENUM('DRAFT', 'ACTIVE', 'SUPERSEDED');--> statement-breakpoint
CREATE TYPE "app"."dependency_type" AS ENUM('FS', 'SS', 'FF', 'SF');--> statement-breakpoint
CREATE TYPE "app"."field_log_status" AS ENUM('DRAFT', 'SUBMITTED', 'LOCKED');--> statement-breakpoint
CREATE TYPE "app"."issue_status" AS ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "app"."schedule_source_type" AS ENUM('USER', 'ISSUE', 'RFI', 'CHANGE_ORDER', 'MATERIAL_DELAY', 'WEATHER', 'SYSTEM_CALCULATION');--> statement-breakpoint
CREATE TYPE "app"."schedule_status" AS ENUM('IDLE', 'CALCULATING', 'FAILED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."calendar_exceptions" (
	"id" text PRIMARY KEY NOT NULL,
	"calendar_id" text NOT NULL,
	"exception_date" date NOT NULL,
	"is_working_day" boolean NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."daily_field_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"log_date" date NOT NULL,
	"supervisor_id" text NOT NULL,
	"status" "app"."field_log_status" DEFAULT 'DRAFT' NOT NULL,
	"notes" text,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."field_log_task_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"log_id" text NOT NULL,
	"task_id" text NOT NULL,
	"completion_pct_recorded" integer NOT NULL,
	"quantity_completed" numeric(10, 2),
	"unit" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."issues" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "app"."issue_status" DEFAULT 'OPEN' NOT NULL,
	"reported_impact_days" integer DEFAULT 0 NOT NULL,
	"approved_impact_days" integer DEFAULT 0 NOT NULL,
	"assigned_to" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."project_calendars" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"name" text DEFAULT 'Standard Construction Calendar' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"work_days" jsonb NOT NULL,
	"hours_per_day" numeric(4, 2) DEFAULT '8.00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_calendars_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."project_schedule_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"total_tasks" integer DEFAULT 0 NOT NULL,
	"completed_tasks" integer DEFAULT 0 NOT NULL,
	"critical_task_count" integer DEFAULT 0 NOT NULL,
	"schedule_revision" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_schedule_metrics_org_project_unique" ON "app"."project_schedule_metrics" ("organization_id", "project_id");
CREATE INDEX IF NOT EXISTS "project_schedule_metrics_project_idx" ON "app"."project_schedule_metrics" USING btree ("project_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."schedule_baseline_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"baseline_id" text NOT NULL,
	"task_id" text NOT NULL,
	"baseline_start_date" date NOT NULL,
	"baseline_finish_date" date NOT NULL,
	"baseline_duration_days" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."schedule_baselines" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "app"."baseline_status" DEFAULT 'DRAFT' NOT NULL,
	"activated_at" timestamp with time zone,
	"activated_by" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."schedule_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"task_id" text NOT NULL,
	"source_type" "app"."schedule_source_type" NOT NULL,
	"source_id" text,
	"old_start_date" date,
	"old_finish_date" date,
	"new_start_date" date,
	"new_finish_date" date,
	"reason" text,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."task_dependencies" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"task_id" text NOT NULL,
	"predecessor_id" text NOT NULL,
	"dependency_type" "app"."dependency_type" DEFAULT 'FS' NOT NULL,
	"lag_days" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_dep_no_self_ref" CHECK ("app"."task_dependencies"."task_id" != "app"."task_dependencies"."predecessor_id")
);
--> statement-breakpoint
ALTER TABLE "app"."projects" ADD COLUMN "schedule_status" "app"."schedule_status" DEFAULT 'IDLE' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."calendar_exceptions" ADD CONSTRAINT "calendar_exceptions_calendar_id_project_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "app"."project_calendars"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."daily_field_logs" ADD CONSTRAINT "daily_field_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."daily_field_logs" ADD CONSTRAINT "daily_field_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."daily_field_logs" ADD CONSTRAINT "daily_field_logs_supervisor_id_users_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."daily_field_logs" ADD CONSTRAINT "daily_field_logs_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."field_log_task_entries" ADD CONSTRAINT "field_log_task_entries_log_id_daily_field_logs_id_fk" FOREIGN KEY ("log_id") REFERENCES "app"."daily_field_logs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."field_log_task_entries" ADD CONSTRAINT "field_log_task_entries_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "app"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."issues" ADD CONSTRAINT "issues_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."issues" ADD CONSTRAINT "issues_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."issues" ADD CONSTRAINT "issues_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."issues" ADD CONSTRAINT "issues_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."project_calendars" ADD CONSTRAINT "project_calendars_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."project_calendars" ADD CONSTRAINT "project_calendars_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."project_schedule_metrics" ADD CONSTRAINT "project_schedule_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."schedule_baseline_tasks" ADD CONSTRAINT "schedule_baseline_tasks_baseline_id_schedule_baselines_id_fk" FOREIGN KEY ("baseline_id") REFERENCES "app"."schedule_baselines"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."schedule_baseline_tasks" ADD CONSTRAINT "schedule_baseline_tasks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "app"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."schedule_baselines" ADD CONSTRAINT "schedule_baselines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."schedule_baselines" ADD CONSTRAINT "schedule_baselines_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."schedule_baselines" ADD CONSTRAINT "schedule_baselines_activated_by_users_id_fk" FOREIGN KEY ("activated_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."schedule_baselines" ADD CONSTRAINT "schedule_baselines_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."schedule_changes" ADD CONSTRAINT "schedule_changes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."schedule_changes" ADD CONSTRAINT "schedule_changes_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "app"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."schedule_changes" ADD CONSTRAINT "schedule_changes_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."task_dependencies" ADD CONSTRAINT "task_dependencies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."task_dependencies" ADD CONSTRAINT "task_dependencies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "app"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."task_dependencies" ADD CONSTRAINT "task_dependencies_predecessor_id_tasks_id_fk" FOREIGN KEY ("predecessor_id") REFERENCES "app"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cal_exc_date_unique" ON "app"."calendar_exceptions" USING btree ("calendar_id","exception_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cal_exc_calendar_idx" ON "app"."calendar_exceptions" USING btree ("calendar_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "daily_field_logs_date_unique" ON "app"."daily_field_logs" USING btree ("project_id","log_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_field_logs_project_idx" ON "app"."daily_field_logs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_field_logs_org_project_idx" ON "app"."daily_field_logs" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_field_logs_supervisor_idx" ON "app"."daily_field_logs" USING btree ("supervisor_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "field_log_task_entries_unique" ON "app"."field_log_task_entries" USING btree ("log_id","task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "field_log_task_entries_log_idx" ON "app"."field_log_task_entries" USING btree ("log_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "field_log_task_entries_task_idx" ON "app"."field_log_task_entries" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issues_project_idx" ON "app"."issues" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issues_org_project_idx" ON "app"."issues" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issues_status_idx" ON "app"."issues" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_calendars_org_idx" ON "app"."project_calendars" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_schedule_metrics_org_idx" ON "app"."project_schedule_metrics" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "baseline_task_unique" ON "app"."schedule_baseline_tasks" USING btree ("baseline_id","task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_baseline_tasks_baseline_idx" ON "app"."schedule_baseline_tasks" USING btree ("baseline_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_baselines_project_idx" ON "app"."schedule_baselines" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_baselines_org_project_idx" ON "app"."schedule_baselines" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_baselines_status_idx" ON "app"."schedule_baselines" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_changes_project_idx" ON "app"."schedule_changes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_changes_task_idx" ON "app"."schedule_changes" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_changes_source_idx" ON "app"."schedule_changes" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "task_dependencies_unique" ON "app"."task_dependencies" USING btree ("task_id","predecessor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_dependencies_project_idx" ON "app"."task_dependencies" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_dependencies_predecessor_idx" ON "app"."task_dependencies" USING btree ("predecessor_id");