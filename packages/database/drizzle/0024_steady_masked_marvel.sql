CREATE TYPE "app"."rfi_priority" AS ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TYPE "app"."rfi_status" AS ENUM('DRAFT', 'OPEN', 'UNDER_REVIEW', 'ANSWERED', 'CLOSED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."rfis" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"rfi_number" text NOT NULL,
	"title" text NOT NULL,
	"question" text NOT NULL,
	"discipline" text,
	"status" "app"."rfi_status" DEFAULT 'DRAFT' NOT NULL,
	"priority" "app"."rfi_priority" DEFAULT 'NORMAL' NOT NULL,
	"submitted_by" text,
	"recipient_name" text,
	"due_date" date,
	"response" text,
	"responded_by" text,
	"responded_at" timestamp with time zone,
	"schedule_impact_days" integer DEFAULT 0 NOT NULL,
	"cost_impact" numeric(15, 2),
	"linked_task_id" text,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."rfis" ADD CONSTRAINT "rfis_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."rfis" ADD CONSTRAINT "rfis_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."rfis" ADD CONSTRAINT "rfis_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."rfis" ADD CONSTRAINT "rfis_responded_by_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."rfis" ADD CONSTRAINT "rfis_linked_task_id_tasks_id_fk" FOREIGN KEY ("linked_task_id") REFERENCES "app"."tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."rfis" ADD CONSTRAINT "rfis_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rfis_project_number_unique" ON "app"."rfis" USING btree ("project_id","rfi_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfis_org_project_idx" ON "app"."rfis" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfis_project_status_created_idx" ON "app"."rfis" USING btree ("project_id","status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfis_project_priority_created_idx" ON "app"."rfis" USING btree ("project_id","priority","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfis_task_idx" ON "app"."rfis" USING btree ("linked_task_id") WHERE "app"."rfis"."linked_task_id" IS NOT NULL;