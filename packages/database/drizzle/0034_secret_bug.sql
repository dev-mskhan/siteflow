CREATE TABLE IF NOT EXISTS "app"."schedule_of_value_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"revision_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"line_number" integer NOT NULL,
	"description" text NOT NULL,
	"cost_code_id" text NOT NULL,
	"phase_id" text,
	"boq_line_id" text,
	"scheduled_value" numeric(15, 2) NOT NULL,
	"completed_to_date" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"stored_materials" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"retainage_percent" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_of_value_lines_number_positive" CHECK ("app"."schedule_of_value_lines"."line_number" > 0),
	CONSTRAINT "schedule_of_value_lines_description_length" CHECK (char_length("app"."schedule_of_value_lines"."description") BETWEEN 1 AND 1000),
	CONSTRAINT "schedule_of_value_lines_value_nonnegative" CHECK ("app"."schedule_of_value_lines"."scheduled_value" > 0),
	CONSTRAINT "schedule_of_value_lines_progress_nonnegative" CHECK ("app"."schedule_of_value_lines"."completed_to_date" >= 0 AND "app"."schedule_of_value_lines"."stored_materials" >= 0 AND "app"."schedule_of_value_lines"."completed_to_date" + "app"."schedule_of_value_lines"."stored_materials" <= "app"."schedule_of_value_lines"."scheduled_value"),
	CONSTRAINT "schedule_of_value_lines_retainage_range" CHECK ("app"."schedule_of_value_lines"."retainage_percent" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."schedule_of_value_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"schedule_of_values_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"contract_value" numeric(15, 2) NOT NULL,
	"currency_code" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"created_by" text NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp with time zone,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_of_value_revisions_status_check" CHECK ("app"."schedule_of_value_revisions"."status" IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SUPERSEDED')),
	CONSTRAINT "schedule_of_value_revisions_value_positive" CHECK ("app"."schedule_of_value_revisions"."contract_value" > 0),
	CONSTRAINT "schedule_of_value_revisions_currency_check" CHECK ("app"."schedule_of_value_revisions"."currency_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "schedule_of_value_revisions_number_positive" CHECK ("app"."schedule_of_value_revisions"."revision_number" > 0),
	CONSTRAINT "schedule_of_value_revisions_submission_metadata_check" CHECK ("app"."schedule_of_value_revisions"."status" NOT IN ('PENDING_APPROVAL', 'APPROVED', 'SUPERSEDED') OR ("app"."schedule_of_value_revisions"."submitted_by" IS NOT NULL AND "app"."schedule_of_value_revisions"."submitted_at" IS NOT NULL)),
	CONSTRAINT "schedule_of_value_revisions_approval_metadata_check" CHECK ("app"."schedule_of_value_revisions"."status" NOT IN ('APPROVED', 'SUPERSEDED') OR ("app"."schedule_of_value_revisions"."approved_by" IS NOT NULL AND "app"."schedule_of_value_revisions"."approved_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."schedule_of_values" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"current_revision_number" integer DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_of_values_revision_positive" CHECK ("app"."schedule_of_values"."current_revision_number" > 0),
	CONSTRAINT "schedule_of_values_version_positive" CHECK ("app"."schedule_of_values"."version" > 0)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."schedule_of_value_lines" ADD CONSTRAINT "schedule_of_value_lines_cost_code_id_project_cost_codes_id_fk" FOREIGN KEY ("cost_code_id") REFERENCES "app"."project_cost_codes"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."schedule_of_value_lines" ADD CONSTRAINT "schedule_of_value_lines_phase_id_project_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "app"."project_phases"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "schedule_of_value_revisions_id_scope_unique" ON "app"."schedule_of_value_revisions" USING btree ("id","organization_id","project_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."schedule_of_value_lines" ADD CONSTRAINT "schedule_of_value_lines_revision_scope_fk" FOREIGN KEY ("revision_id","organization_id","project_id") REFERENCES "app"."schedule_of_value_revisions"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."schedule_of_value_revisions" ADD CONSTRAINT "schedule_of_value_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."schedule_of_value_revisions" ADD CONSTRAINT "schedule_of_value_revisions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."schedule_of_value_revisions" ADD CONSTRAINT "schedule_of_value_revisions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "schedule_of_values_id_scope_unique" ON "app"."schedule_of_values" USING btree ("id","organization_id","project_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."schedule_of_value_revisions" ADD CONSTRAINT "schedule_of_value_revisions_parent_scope_fk" FOREIGN KEY ("schedule_of_values_id","organization_id","project_id") REFERENCES "app"."schedule_of_values"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."schedule_of_values" ADD CONSTRAINT "schedule_of_values_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."schedule_of_values" ADD CONSTRAINT "schedule_of_values_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "schedule_of_values_id_scope_unique" ON "app"."schedule_of_values" USING btree ("id","organization_id","project_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."schedule_of_values" ADD CONSTRAINT "schedule_of_values_project_org_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "app"."projects"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "schedule_of_value_lines_number_unique" ON "app"."schedule_of_value_lines" USING btree ("revision_id","line_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_of_value_lines_project_code_idx" ON "app"."schedule_of_value_lines" USING btree ("organization_id","project_id","cost_code_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_of_value_lines_project_phase_idx" ON "app"."schedule_of_value_lines" USING btree ("organization_id","project_id","phase_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "schedule_of_value_revisions_number_unique" ON "app"."schedule_of_value_revisions" USING btree ("schedule_of_values_id","revision_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_of_value_revisions_status_idx" ON "app"."schedule_of_value_revisions" USING btree ("organization_id","project_id","status","revision_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "schedule_of_values_project_unique" ON "app"."schedule_of_values" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_of_values_org_project_idx" ON "app"."schedule_of_values" USING btree ("organization_id","project_id","updated_at" DESC NULLS LAST);