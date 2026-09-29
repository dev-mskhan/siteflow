CREATE TYPE "app"."project_subcontractor_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "app"."subcontractor_status" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."project_subcontractors" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"subcontractor_id" text NOT NULL,
	"status" "app"."project_subcontractor_status" DEFAULT 'ACTIVE' NOT NULL,
	"scope_description" text,
	"contract_value" numeric(15, 2),
	"currency_code" text,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_subcontractors_dates_check" CHECK ("app"."project_subcontractors"."start_date" IS NULL OR "app"."project_subcontractors"."end_date" IS NULL OR "app"."project_subcontractors"."end_date" >= "app"."project_subcontractors"."start_date"),
	CONSTRAINT "project_subcontractors_currency_length" CHECK ("app"."project_subcontractors"."currency_code" IS NULL OR char_length("app"."project_subcontractors"."currency_code") = 3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."subcontractor_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"subcontractor_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"email" text,
	"phone" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."subcontractor_task_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"subcontractor_id" text NOT NULL,
	"task_id" text NOT NULL,
	"assignment_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."subcontractors" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"legal_name" text NOT NULL,
	"display_name" text NOT NULL,
	"trade" text,
	"registration_reference" text,
	"tax_reference" text,
	"status" "app"."subcontractor_status" DEFAULT 'ACTIVE' NOT NULL,
	"primary_email" text,
	"primary_phone" text,
	"address" text,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."project_subcontractors" ADD CONSTRAINT "project_subcontractors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."project_subcontractors" ADD CONSTRAINT "project_subcontractors_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."project_subcontractors" ADD CONSTRAINT "project_subcontractors_subcontractor_id_subcontractors_id_fk" FOREIGN KEY ("subcontractor_id") REFERENCES "app"."subcontractors"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."subcontractor_contacts" ADD CONSTRAINT "subcontractor_contacts_subcontractor_id_subcontractors_id_fk" FOREIGN KEY ("subcontractor_id") REFERENCES "app"."subcontractors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."subcontractor_contacts" ADD CONSTRAINT "subcontractor_contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."subcontractor_task_assignments" ADD CONSTRAINT "subcontractor_task_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."subcontractor_task_assignments" ADD CONSTRAINT "subcontractor_task_assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."subcontractor_task_assignments" ADD CONSTRAINT "subcontractor_task_assignments_subcontractor_id_subcontractors_id_fk" FOREIGN KEY ("subcontractor_id") REFERENCES "app"."subcontractors"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."subcontractor_task_assignments" ADD CONSTRAINT "subcontractor_task_assignments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "app"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."subcontractors" ADD CONSTRAINT "subcontractors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."subcontractors" ADD CONSTRAINT "subcontractors_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_subcontractors_project_idx" ON "app"."project_subcontractors" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_subcontractors_org_idx" ON "app"."project_subcontractors" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_subcontractors_sub_idx" ON "app"."project_subcontractors" USING btree ("subcontractor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_subcontractors_project_sub_idx" ON "app"."project_subcontractors" USING btree ("project_id","subcontractor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subcontractor_contacts_sub_idx" ON "app"."subcontractor_contacts" USING btree ("subcontractor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subcontractor_contacts_org_idx" ON "app"."subcontractor_contacts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sub_task_assignments_project_idx" ON "app"."subcontractor_task_assignments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sub_task_assignments_sub_idx" ON "app"."subcontractor_task_assignments" USING btree ("subcontractor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sub_task_assignments_task_idx" ON "app"."subcontractor_task_assignments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sub_task_assignments_sub_task_idx" ON "app"."subcontractor_task_assignments" USING btree ("subcontractor_id","task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subcontractors_org_idx" ON "app"."subcontractors" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subcontractors_org_status_idx" ON "app"."subcontractors" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subcontractors_org_created_at_idx" ON "app"."subcontractors" USING btree ("organization_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subcontractor_contacts_primary_unique" ON "app"."subcontractor_contacts" ("subcontractor_id") WHERE is_primary = true;
