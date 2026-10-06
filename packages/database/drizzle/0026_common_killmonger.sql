CREATE TYPE "app"."corrective_action_status" AS ENUM('OPEN', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "app"."deficiency_severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "app"."deficiency_status" AS ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'DISPUTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "app"."quality_inspection_status" AS ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "app"."quality_result" AS ENUM('PASS', 'PASS_WITH_CONDITIONS', 'FAIL');--> statement-breakpoint
CREATE TYPE "app"."safety_event_status" AS ENUM('REPORTED', 'UNDER_INVESTIGATION', 'CORRECTIVE_ACTION_REQUIRED', 'CORRECTIVE_ACTION_IN_PROGRESS', 'CLOSED');--> statement-breakpoint
CREATE TYPE "app"."safety_event_type" AS ENUM('INCIDENT', 'NEAR_MISS', 'UNSAFE_CONDITION', 'UNSAFE_ACT', 'FIRST_AID');--> statement-breakpoint
CREATE TYPE "app"."safety_severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'FATALITY');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."corrective_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"assigned_to" text,
	"status" "app"."corrective_action_status" DEFAULT 'OPEN' NOT NULL,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"verified_by" text,
	"verified_at" timestamp with time zone,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "corrective_actions_verified_fields_check" CHECK (("app"."corrective_actions"."status" = 'VERIFIED' AND "app"."corrective_actions"."verified_by" IS NOT NULL AND "app"."corrective_actions"."verified_at" IS NOT NULL)
        OR "app"."corrective_actions"."status" <> 'VERIFIED')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."quality_deficiencies" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"inspection_id" text,
	"deficiency_number" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"severity" "app"."deficiency_severity" DEFAULT 'MEDIUM' NOT NULL,
	"status" "app"."deficiency_status" DEFAULT 'OPEN' NOT NULL,
	"responsible_member_id" text,
	"due_date" date,
	"location" text,
	"notes" text,
	"closed_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."quality_inspections" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"inspection_number" text NOT NULL,
	"inspection_type" text NOT NULL,
	"scheduled_date" date,
	"performed_date" date,
	"inspector_member_id" text,
	"status" "app"."quality_inspection_status" DEFAULT 'SCHEDULED' NOT NULL,
	"result" "app"."quality_result",
	"findings" text,
	"location" text,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."safety_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"event_number" text NOT NULL,
	"event_type" "app"."safety_event_type" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" "app"."safety_event_status" DEFAULT 'REPORTED' NOT NULL,
	"severity" "app"."safety_severity" DEFAULT 'LOW' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"location" text,
	"involved_parties" text,
	"reported_by" text,
	"assigned_to" text,
	"root_cause" text,
	"immediate_action" text,
	"closed_at" timestamp with time zone,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."safety_meetings" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"meeting_number" text NOT NULL,
	"meeting_type" text NOT NULL,
	"title" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"conducted_at" timestamp with time zone,
	"facilitator_id" text,
	"attendee_count" integer,
	"topics_covered" text,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."corrective_actions" ADD CONSTRAINT "corrective_actions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."corrective_actions" ADD CONSTRAINT "corrective_actions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."corrective_actions" ADD CONSTRAINT "corrective_actions_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."corrective_actions" ADD CONSTRAINT "corrective_actions_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."corrective_actions" ADD CONSTRAINT "corrective_actions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."quality_deficiencies" ADD CONSTRAINT "quality_deficiencies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."quality_deficiencies" ADD CONSTRAINT "quality_deficiencies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."quality_deficiencies" ADD CONSTRAINT "quality_deficiencies_inspection_id_quality_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "app"."quality_inspections"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."quality_deficiencies" ADD CONSTRAINT "quality_deficiencies_responsible_member_id_project_members_id_fk" FOREIGN KEY ("responsible_member_id") REFERENCES "app"."project_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."quality_deficiencies" ADD CONSTRAINT "quality_deficiencies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."quality_inspections" ADD CONSTRAINT "quality_inspections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."quality_inspections" ADD CONSTRAINT "quality_inspections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."quality_inspections" ADD CONSTRAINT "quality_inspections_inspector_member_id_project_members_id_fk" FOREIGN KEY ("inspector_member_id") REFERENCES "app"."project_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."quality_inspections" ADD CONSTRAINT "quality_inspections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."safety_events" ADD CONSTRAINT "safety_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."safety_events" ADD CONSTRAINT "safety_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."safety_events" ADD CONSTRAINT "safety_events_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."safety_events" ADD CONSTRAINT "safety_events_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."safety_events" ADD CONSTRAINT "safety_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."safety_meetings" ADD CONSTRAINT "safety_meetings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."safety_meetings" ADD CONSTRAINT "safety_meetings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."safety_meetings" ADD CONSTRAINT "safety_meetings_facilitator_id_users_id_fk" FOREIGN KEY ("facilitator_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."safety_meetings" ADD CONSTRAINT "safety_meetings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "corrective_actions_org_project_idx" ON "app"."corrective_actions" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "corrective_actions_project_status_created_idx" ON "app"."corrective_actions" USING btree ("project_id","status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "corrective_actions_source_idx" ON "app"."corrective_actions" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "corrective_actions_assigned_to_idx" ON "app"."corrective_actions" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "corrective_actions_created_by_idx" ON "app"."corrective_actions" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "corrective_actions_verified_by_idx" ON "app"."corrective_actions" USING btree ("verified_by");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quality_deficiencies_project_number_unique" ON "app"."quality_deficiencies" USING btree ("project_id","deficiency_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quality_deficiencies_org_project_idx" ON "app"."quality_deficiencies" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quality_deficiencies_project_status_created_idx" ON "app"."quality_deficiencies" USING btree ("project_id","status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quality_deficiencies_inspection_idx" ON "app"."quality_deficiencies" USING btree ("inspection_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quality_deficiencies_responsible_idx" ON "app"."quality_deficiencies" USING btree ("responsible_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quality_inspections_project_number_unique" ON "app"."quality_inspections" USING btree ("project_id","inspection_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quality_inspections_org_project_idx" ON "app"."quality_inspections" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quality_inspections_project_status_date_idx" ON "app"."quality_inspections" USING btree ("project_id","status","scheduled_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quality_inspections_inspector_idx" ON "app"."quality_inspections" USING btree ("inspector_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "safety_events_project_number_unique" ON "app"."safety_events" USING btree ("project_id","event_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "safety_events_org_project_idx" ON "app"."safety_events" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "safety_events_project_status_severity_idx" ON "app"."safety_events" USING btree ("project_id","status","severity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "safety_events_assigned_to_idx" ON "app"."safety_events" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "safety_events_reported_by_idx" ON "app"."safety_events" USING btree ("reported_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "safety_events_created_by_idx" ON "app"."safety_events" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "safety_meetings_project_number_unique" ON "app"."safety_meetings" USING btree ("project_id","meeting_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "safety_meetings_org_project_idx" ON "app"."safety_meetings" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "safety_meetings_project_scheduled_idx" ON "app"."safety_meetings" USING btree ("project_id","scheduled_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "safety_meetings_facilitator_idx" ON "app"."safety_meetings" USING btree ("facilitator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "safety_meetings_created_by_idx" ON "app"."safety_meetings" USING btree ("created_by");