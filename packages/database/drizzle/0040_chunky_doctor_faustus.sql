CREATE TABLE IF NOT EXISTS "app"."estimate_line_resources" (
	"id" text PRIMARY KEY NOT NULL,
	"estimate_line_id" text NOT NULL,
	"revision_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"resource_number" integer NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"unit" text NOT NULL,
	"quantity_per_line_unit" numeric(15, 6) NOT NULL,
	"unit_rate" numeric(15, 2) NOT NULL,
	"waste_percent" numeric(7, 4) DEFAULT '0' NOT NULL,
	"rate_source" text,
	"extended_amount" numeric(15, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estimate_line_resources_number_positive" CHECK ("app"."estimate_line_resources"."resource_number" > 0),
	CONSTRAINT "estimate_line_resources_category_check" CHECK ("app"."estimate_line_resources"."category" IN ('MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTOR', 'OTHER')),
	CONSTRAINT "estimate_line_resources_description_length" CHECK (char_length("app"."estimate_line_resources"."description") BETWEEN 1 AND 500),
	CONSTRAINT "estimate_line_resources_unit_length" CHECK (char_length("app"."estimate_line_resources"."unit") BETWEEN 1 AND 32),
	CONSTRAINT "estimate_line_resources_quantity_check" CHECK ("app"."estimate_line_resources"."quantity_per_line_unit" > 0),
	CONSTRAINT "estimate_line_resources_rate_check" CHECK ("app"."estimate_line_resources"."unit_rate" >= 0),
	CONSTRAINT "estimate_line_resources_waste_check" CHECK ("app"."estimate_line_resources"."waste_percent" BETWEEN 0 AND 100),
	CONSTRAINT "estimate_line_resources_source_length" CHECK ("app"."estimate_line_resources"."rate_source" IS NULL OR char_length("app"."estimate_line_resources"."rate_source") <= 500),
	CONSTRAINT "estimate_line_resources_amount_check" CHECK ("app"."estimate_line_resources"."extended_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."estimate_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"revision_id" text NOT NULL,
	"section_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"cost_code_id" text,
	"line_number" integer NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"specification" text,
	"quantity" numeric(15, 3) NOT NULL,
	"unit" text NOT NULL,
	"unit_rate" numeric(15, 2),
	"direct_amount" numeric(15, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estimate_lines_number_positive" CHECK ("app"."estimate_lines"."line_number" > 0),
	CONSTRAINT "estimate_lines_category_check" CHECK ("app"."estimate_lines"."category" IN ('MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTOR', 'OTHER')),
	CONSTRAINT "estimate_lines_description_length" CHECK (char_length("app"."estimate_lines"."description") BETWEEN 1 AND 500),
	CONSTRAINT "estimate_lines_specification_length" CHECK ("app"."estimate_lines"."specification" IS NULL OR char_length("app"."estimate_lines"."specification") <= 2000),
	CONSTRAINT "estimate_lines_quantity_check" CHECK ("app"."estimate_lines"."quantity" > 0),
	CONSTRAINT "estimate_lines_unit_length" CHECK (char_length("app"."estimate_lines"."unit") BETWEEN 1 AND 32),
	CONSTRAINT "estimate_lines_unit_rate_check" CHECK ("app"."estimate_lines"."unit_rate" IS NULL OR "app"."estimate_lines"."unit_rate" >= 0),
	CONSTRAINT "estimate_lines_direct_amount_check" CHECK ("app"."estimate_lines"."direct_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."estimate_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"estimate_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"currency_code" text NOT NULL,
	"calculation_version" text DEFAULT 'estimate-v1' NOT NULL,
	"overhead_percent" numeric(7, 4) DEFAULT '0' NOT NULL,
	"contingency_percent" numeric(7, 4) DEFAULT '0' NOT NULL,
	"markup_mode" text DEFAULT 'NONE' NOT NULL,
	"markup_percent" numeric(7, 4) DEFAULT '0' NOT NULL,
	"discount_percent" numeric(7, 4) DEFAULT '0' NOT NULL,
	"tax_percent" numeric(7, 4) DEFAULT '0' NOT NULL,
	"tax_source" text,
	"direct_cost_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"overhead_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"contingency_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"markup_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"taxable_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"created_by" text NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp with time zone,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"rejected_by" text,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estimate_revisions_number_positive" CHECK ("app"."estimate_revisions"."revision_number" > 0),
	CONSTRAINT "estimate_revisions_status_check" CHECK ("app"."estimate_revisions"."status" IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
	CONSTRAINT "estimate_revisions_currency_check" CHECK ("app"."estimate_revisions"."currency_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "estimate_revisions_calculation_version_check" CHECK (char_length("app"."estimate_revisions"."calculation_version") BETWEEN 1 AND 64),
	CONSTRAINT "estimate_revisions_overhead_percent_check" CHECK ("app"."estimate_revisions"."overhead_percent" BETWEEN 0 AND 100),
	CONSTRAINT "estimate_revisions_contingency_percent_check" CHECK ("app"."estimate_revisions"."contingency_percent" BETWEEN 0 AND 100),
	CONSTRAINT "estimate_revisions_markup_mode_check" CHECK ("app"."estimate_revisions"."markup_mode" IN ('NONE', 'MARKUP', 'TARGET_MARGIN')),
	CONSTRAINT "estimate_revisions_markup_percent_check" CHECK ("app"."estimate_revisions"."markup_percent" >= 0 AND ("app"."estimate_revisions"."markup_mode" <> 'TARGET_MARGIN' OR "app"."estimate_revisions"."markup_percent" < 100)),
	CONSTRAINT "estimate_revisions_discount_percent_check" CHECK ("app"."estimate_revisions"."discount_percent" BETWEEN 0 AND 100),
	CONSTRAINT "estimate_revisions_tax_percent_check" CHECK ("app"."estimate_revisions"."tax_percent" BETWEEN 0 AND 100),
	CONSTRAINT "estimate_revisions_tax_source_check" CHECK ("app"."estimate_revisions"."tax_percent" = 0 OR ("app"."estimate_revisions"."tax_source" IS NOT NULL AND char_length("app"."estimate_revisions"."tax_source") BETWEEN 1 AND 500)),
	CONSTRAINT "estimate_revisions_amounts_nonnegative_check" CHECK ("app"."estimate_revisions"."direct_cost_total" >= 0 AND "app"."estimate_revisions"."overhead_amount" >= 0 AND "app"."estimate_revisions"."contingency_amount" >= 0 AND "app"."estimate_revisions"."markup_amount" >= 0 AND "app"."estimate_revisions"."discount_amount" >= 0 AND "app"."estimate_revisions"."taxable_amount" >= 0 AND "app"."estimate_revisions"."tax_amount" >= 0 AND "app"."estimate_revisions"."total_amount" >= 0),
	CONSTRAINT "estimate_revisions_approval_metadata_check" CHECK ("app"."estimate_revisions"."status" <> 'APPROVED' OR ("app"."estimate_revisions"."approved_by" IS NOT NULL AND "app"."estimate_revisions"."approved_at" IS NOT NULL)),
	CONSTRAINT "estimate_revisions_rejection_metadata_check" CHECK ("app"."estimate_revisions"."status" <> 'REJECTED' OR ("app"."estimate_revisions"."rejected_by" IS NOT NULL AND "app"."estimate_revisions"."rejected_at" IS NOT NULL AND char_length("app"."estimate_revisions"."rejection_reason") >= 10))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."estimate_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"revision_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"section_number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estimate_sections_number_positive" CHECK ("app"."estimate_sections"."section_number" > 0),
	CONSTRAINT "estimate_sections_title_length" CHECK (char_length("app"."estimate_sections"."title") BETWEEN 1 AND 160),
	CONSTRAINT "estimate_sections_description_length" CHECK ("app"."estimate_sections"."description" IS NULL OR char_length("app"."estimate_sections"."description") <= 2000)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."estimates" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"current_revision_number" integer DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp with time zone,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"rejected_by" text,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estimates_title_length" CHECK (char_length("app"."estimates"."title") BETWEEN 1 AND 160),
	CONSTRAINT "estimates_description_length" CHECK ("app"."estimates"."description" IS NULL OR char_length("app"."estimates"."description") <= 5000),
	CONSTRAINT "estimates_status_check" CHECK ("app"."estimates"."status" IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
	CONSTRAINT "estimates_revision_positive" CHECK ("app"."estimates"."current_revision_number" > 0),
	CONSTRAINT "estimates_version_positive" CHECK ("app"."estimates"."version" > 0),
	CONSTRAINT "estimates_approval_metadata_check" CHECK ("app"."estimates"."status" <> 'APPROVED' OR ("app"."estimates"."approved_by" IS NOT NULL AND "app"."estimates"."approved_at" IS NOT NULL)),
	CONSTRAINT "estimates_rejection_metadata_check" CHECK ("app"."estimates"."status" <> 'REJECTED' OR ("app"."estimates"."rejected_by" IS NOT NULL AND "app"."estimates"."rejected_at" IS NOT NULL AND char_length("app"."estimates"."rejection_reason") >= 10))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "estimates_id_scope_unique" ON "app"."estimates" USING btree ("id","organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_cost_codes_id_org_project_unique" ON "app"."project_cost_codes" USING btree ("id","organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "estimate_revisions_id_scope_unique" ON "app"."estimate_revisions" USING btree ("id","organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "estimate_lines_id_scope_unique" ON "app"."estimate_lines" USING btree ("id","revision_id","organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "estimate_sections_id_scope_unique" ON "app"."estimate_sections" USING btree ("id","revision_id","organization_id","project_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."estimate_line_resources" ADD CONSTRAINT "estimate_line_resources_line_scope_fk" FOREIGN KEY ("estimate_line_id","revision_id","organization_id","project_id") REFERENCES "app"."estimate_lines"("id","revision_id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."estimate_lines" ADD CONSTRAINT "estimate_lines_revision_scope_fk" FOREIGN KEY ("revision_id","organization_id","project_id") REFERENCES "app"."estimate_revisions"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."estimate_lines" ADD CONSTRAINT "estimate_lines_section_scope_fk" FOREIGN KEY ("section_id","revision_id","organization_id","project_id") REFERENCES "app"."estimate_sections"("id","revision_id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."estimate_lines" ADD CONSTRAINT "estimate_lines_cost_code_scope_fk" FOREIGN KEY ("cost_code_id","organization_id","project_id") REFERENCES "app"."project_cost_codes"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."estimate_revisions" ADD CONSTRAINT "estimate_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."estimate_revisions" ADD CONSTRAINT "estimate_revisions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."estimate_revisions" ADD CONSTRAINT "estimate_revisions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."estimate_revisions" ADD CONSTRAINT "estimate_revisions_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."estimate_revisions" ADD CONSTRAINT "estimate_revisions_estimate_scope_fk" FOREIGN KEY ("estimate_id","organization_id","project_id") REFERENCES "app"."estimates"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."estimate_sections" ADD CONSTRAINT "estimate_sections_revision_scope_fk" FOREIGN KEY ("revision_id","organization_id","project_id") REFERENCES "app"."estimate_revisions"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."estimates" ADD CONSTRAINT "estimates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."estimates" ADD CONSTRAINT "estimates_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."estimates" ADD CONSTRAINT "estimates_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."estimates" ADD CONSTRAINT "estimates_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."estimates" ADD CONSTRAINT "estimates_project_org_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "app"."projects"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "estimate_line_resources_number_unique" ON "app"."estimate_line_resources" USING btree ("estimate_line_id","resource_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "estimate_line_resources_revision_idx" ON "app"."estimate_line_resources" USING btree ("organization_id","project_id","revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "estimate_lines_number_unique" ON "app"."estimate_lines" USING btree ("section_id","line_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "estimate_lines_org_project_cost_code_idx" ON "app"."estimate_lines" USING btree ("organization_id","project_id","cost_code_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "estimate_lines_revision_idx" ON "app"."estimate_lines" USING btree ("organization_id","project_id","revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "estimate_revisions_number_unique" ON "app"."estimate_revisions" USING btree ("estimate_id","revision_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "estimate_revisions_project_status_idx" ON "app"."estimate_revisions" USING btree ("organization_id","project_id","status","revision_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "estimate_sections_number_unique" ON "app"."estimate_sections" USING btree ("revision_id","section_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "estimate_sections_org_project_revision_idx" ON "app"."estimate_sections" USING btree ("organization_id","project_id","revision_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "estimates_org_project_created_idx" ON "app"."estimates" USING btree ("organization_id","project_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "estimates_org_project_status_idx" ON "app"."estimates" USING btree ("organization_id","project_id","status","updated_at" DESC NULLS LAST);
