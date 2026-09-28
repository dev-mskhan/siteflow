CREATE TYPE "app"."constraint_type" AS ENUM('ASAP', 'START_NO_EARLIER_THAN', 'FINISH_NO_LATER_THAN');--> statement-breakpoint
CREATE TYPE "app"."task_priority" AS ENUM('LOW', 'NORMAL', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "app"."task_status" AS ENUM('NOT_STARTED', 'READY', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "app"."task_type" AS ENUM('TASK', 'MILESTONE', 'SUMMARY');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."task_document_links" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"task_id" text NOT NULL,
	"document_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"phase_id" text,
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
	"assigned_to" text,
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
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_progress_percent_range" CHECK ("app"."tasks"."progress_percent" >= 0 AND "app"."tasks"."progress_percent" <= 100)
);
--> statement-breakpoint
ALTER TABLE "app"."projects" ADD COLUMN "schedule_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."task_document_links" ADD CONSTRAINT "task_document_links_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "app"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."tasks" ADD CONSTRAINT "tasks_phase_id_project_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "app"."project_phases"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "task_doc_unique" ON "app"."task_document_links" USING btree ("task_id","document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_doc_links_task_idx" ON "app"."task_document_links" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tasks_project_code_unique" ON "app"."tasks" USING btree ("project_id","task_code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tasks_id_org_unique" ON "app"."tasks" USING btree ("id","organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_project_idx" ON "app"."tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_org_project_idx" ON "app"."tasks" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_project_parent_idx" ON "app"."tasks" USING btree ("project_id","parent_task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_project_status_idx" ON "app"."tasks" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_project_type_idx" ON "app"."tasks" USING btree ("project_id","task_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_project_critical_idx" ON "app"."tasks" USING btree ("project_id","is_critical");