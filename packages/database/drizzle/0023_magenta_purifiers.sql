CREATE TYPE "app"."compliance_inspection_result" AS ENUM('PASS', 'PASS_WITH_CONDITIONS', 'FAIL', 'INCONCLUSIVE');--> statement-breakpoint
CREATE TYPE "app"."compliance_inspection_status" AS ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED');--> statement-breakpoint
CREATE TYPE "app"."compliance_status" AS ENUM('PENDING', 'ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'CANCELLED', 'VERIFIED');--> statement-breakpoint
CREATE TYPE "app"."permit_status" AS ENUM('PENDING', 'APPLIED', 'ISSUED', 'ACTIVE', 'EXPIRED', 'REVOKED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."compliance_inspections" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"permit_id" text,
	"inspection_type" text NOT NULL,
	"scheduled_date" date,
	"performed_date" date,
	"inspector_name" text,
	"responsible_member_id" text,
	"status" "app"."compliance_inspection_status" DEFAULT 'SCHEDULED' NOT NULL,
	"result" "app"."compliance_inspection_result",
	"findings" text,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."compliance_records" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"requirement_type" text NOT NULL,
	"subject_type" text,
	"subject_id" text,
	"responsible_member_id" text,
	"status" "app"."compliance_status" DEFAULT 'PENDING' NOT NULL,
	"effective_date" date,
	"expiry_date" date,
	"expires_notified" boolean DEFAULT false NOT NULL,
	"verification_ref" text,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."permits" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"permit_type" text NOT NULL,
	"reference_number" text,
	"issuing_authority" text,
	"responsible_member_id" text,
	"status" "app"."permit_status" DEFAULT 'PENDING' NOT NULL,
	"issue_date" date,
	"effective_date" date,
	"expiry_date" date,
	"expires_notified" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."compliance_inspections" ADD CONSTRAINT "compliance_inspections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."compliance_inspections" ADD CONSTRAINT "compliance_inspections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."compliance_inspections" ADD CONSTRAINT "compliance_inspections_permit_id_permits_id_fk" FOREIGN KEY ("permit_id") REFERENCES "app"."permits"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."compliance_inspections" ADD CONSTRAINT "compliance_inspections_responsible_member_id_project_members_id_fk" FOREIGN KEY ("responsible_member_id") REFERENCES "app"."project_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."compliance_inspections" ADD CONSTRAINT "compliance_inspections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."compliance_records" ADD CONSTRAINT "compliance_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."compliance_records" ADD CONSTRAINT "compliance_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."compliance_records" ADD CONSTRAINT "compliance_records_responsible_member_id_project_members_id_fk" FOREIGN KEY ("responsible_member_id") REFERENCES "app"."project_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."compliance_records" ADD CONSTRAINT "compliance_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."permits" ADD CONSTRAINT "permits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."permits" ADD CONSTRAINT "permits_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."permits" ADD CONSTRAINT "permits_responsible_member_id_project_members_id_fk" FOREIGN KEY ("responsible_member_id") REFERENCES "app"."project_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."permits" ADD CONSTRAINT "permits_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_inspections_org_project_idx" ON "app"."compliance_inspections" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_inspections_project_status_idx" ON "app"."compliance_inspections" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_inspections_permit_idx" ON "app"."compliance_inspections" USING btree ("permit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_inspections_responsible_member_idx" ON "app"."compliance_inspections" USING btree ("responsible_member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_inspections_created_by_idx" ON "app"."compliance_inspections" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_records_org_project_idx" ON "app"."compliance_records" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_records_project_status_idx" ON "app"."compliance_records" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_records_expiry_partial_idx" ON "app"."compliance_records" USING btree ("expiry_date","expires_notified") WHERE "app"."compliance_records"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_records_responsible_member_idx" ON "app"."compliance_records" USING btree ("responsible_member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_records_created_by_idx" ON "app"."compliance_records" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_records_subject_idx" ON "app"."compliance_records" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permits_org_project_idx" ON "app"."permits" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permits_project_status_expiry_idx" ON "app"."permits" USING btree ("project_id","status","expiry_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permits_expiry_partial_idx" ON "app"."permits" USING btree ("expiry_date","expires_notified") WHERE "app"."permits"."status" IN ('ISSUED', 'ACTIVE');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permits_responsible_member_idx" ON "app"."permits" USING btree ("responsible_member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permits_created_by_idx" ON "app"."permits" USING btree ("created_by");