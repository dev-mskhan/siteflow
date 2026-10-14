CREATE TABLE IF NOT EXISTS "app"."takeoff_measurement_inputs" (
	"id" text PRIMARY KEY NOT NULL,
	"measurement_id" text NOT NULL,
	"revision_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"variable_name" text NOT NULL,
	"value" numeric(18, 6) NOT NULL,
	"unit" text NOT NULL,
	"dimension" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "takeoff_measurement_inputs_dimension_check" CHECK ("app"."takeoff_measurement_inputs"."dimension" IN ('LENGTH', 'AREA', 'VOLUME', 'COUNT')),
	CONSTRAINT "takeoff_measurement_inputs_position_positive" CHECK ("app"."takeoff_measurement_inputs"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."takeoff_measurements" (
	"id" text PRIMARY KEY NOT NULL,
	"revision_id" text NOT NULL,
	"sheet_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"line_number" integer NOT NULL,
	"stable_key" text NOT NULL,
	"description" text NOT NULL,
	"dimension" text NOT NULL,
	"unit" text NOT NULL,
	"measurement_mode" text NOT NULL,
	"source_id" text,
	"formula_text" text,
	"manual_quantity" numeric(15, 3),
	"gross_quantity" numeric(15, 3) DEFAULT '0' NOT NULL,
	"deduction_quantity" numeric(15, 3) DEFAULT '0' NOT NULL,
	"waste_percent" numeric(7, 4) DEFAULT '0' NOT NULL,
	"result_quantity" numeric(15, 3) DEFAULT '0' NOT NULL,
	"boq_item_id" text,
	"cost_code_id" text,
	"notes" text,
	"calculation_version" text DEFAULT 'takeoff-v1' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "takeoff_measurements_dimension_check" CHECK ("app"."takeoff_measurements"."dimension" IN ('LENGTH', 'AREA', 'VOLUME', 'COUNT')),
	CONSTRAINT "takeoff_measurements_mode_check" CHECK ("app"."takeoff_measurements"."measurement_mode" IN ('MANUAL', 'FORMULA')),
	CONSTRAINT "takeoff_measurements_mode_input_check" CHECK (("app"."takeoff_measurements"."measurement_mode" = 'MANUAL' AND "app"."takeoff_measurements"."manual_quantity" IS NOT NULL AND "app"."takeoff_measurements"."formula_text" IS NULL)
        OR ("app"."takeoff_measurements"."measurement_mode" = 'FORMULA' AND "app"."takeoff_measurements"."formula_text" IS NOT NULL AND "app"."takeoff_measurements"."manual_quantity" IS NULL)),
	CONSTRAINT "takeoff_measurements_gross_nonnegative" CHECK ("app"."takeoff_measurements"."gross_quantity" >= 0),
	CONSTRAINT "takeoff_measurements_deduction_nonnegative" CHECK ("app"."takeoff_measurements"."deduction_quantity" >= 0),
	CONSTRAINT "takeoff_measurements_result_nonnegative" CHECK ("app"."takeoff_measurements"."result_quantity" >= 0),
	CONSTRAINT "takeoff_measurements_waste_range" CHECK ("app"."takeoff_measurements"."waste_percent" >= 0 AND "app"."takeoff_measurements"."waste_percent" <= 100),
	CONSTRAINT "takeoff_measurements_line_positive" CHECK ("app"."takeoff_measurements"."line_number" > 0),
	CONSTRAINT "takeoff_measurements_description_length" CHECK (char_length("app"."takeoff_measurements"."description") BETWEEN 1 AND 500)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."takeoff_sheet_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"sheet_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"calculation_version" text DEFAULT 'takeoff-v1' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "takeoff_sheet_revisions_number_positive" CHECK ("app"."takeoff_sheet_revisions"."revision_number" > 0),
	CONSTRAINT "takeoff_sheet_revisions_status_check" CHECK ("app"."takeoff_sheet_revisions"."status" IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."takeoff_sheets" (
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
	CONSTRAINT "takeoff_sheets_title_length" CHECK (char_length("app"."takeoff_sheets"."title") BETWEEN 1 AND 160),
	CONSTRAINT "takeoff_sheets_description_length" CHECK ("app"."takeoff_sheets"."description" IS NULL OR char_length("app"."takeoff_sheets"."description") <= 2000),
	CONSTRAINT "takeoff_sheets_status_check" CHECK ("app"."takeoff_sheets"."status" IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
	CONSTRAINT "takeoff_sheets_revision_positive" CHECK ("app"."takeoff_sheets"."current_revision_number" > 0),
	CONSTRAINT "takeoff_sheets_version_positive" CHECK ("app"."takeoff_sheets"."version" > 0),
	CONSTRAINT "takeoff_sheets_approval_metadata_check" CHECK ("app"."takeoff_sheets"."status" <> 'APPROVED' OR ("app"."takeoff_sheets"."approved_by" IS NOT NULL AND "app"."takeoff_sheets"."approved_at" IS NOT NULL)),
	CONSTRAINT "takeoff_sheets_rejection_metadata_check" CHECK ("app"."takeoff_sheets"."status" <> 'REJECTED' OR ("app"."takeoff_sheets"."rejected_by" IS NOT NULL AND "app"."takeoff_sheets"."rejected_at" IS NOT NULL AND char_length("app"."takeoff_sheets"."rejection_reason") >= 10))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."takeoff_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"revision_id" text NOT NULL,
	"sheet_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"document_id" text NOT NULL,
	"document_version_id" text NOT NULL,
	"page_reference" text NOT NULL,
	"region_label" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "takeoff_sources_page_length" CHECK (char_length("app"."takeoff_sources"."page_reference") BETWEEN 1 AND 64),
	CONSTRAINT "takeoff_sources_region_length" CHECK ("app"."takeoff_sources"."region_label" IS NULL OR char_length("app"."takeoff_sources"."region_label") <= 200)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "takeoff_measurement_inputs_name_unique" ON "app"."takeoff_measurement_inputs" USING btree ("measurement_id","variable_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "takeoff_measurement_inputs_revision_idx" ON "app"."takeoff_measurement_inputs" USING btree ("revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "takeoff_measurements_id_scope_unique" ON "app"."takeoff_measurements" USING btree ("id","revision_id","organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "takeoff_measurements_revision_line_unique" ON "app"."takeoff_measurements" USING btree ("revision_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "takeoff_measurements_revision_key_unique" ON "app"."takeoff_measurements" USING btree ("revision_id","stable_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "takeoff_measurements_sheet_order_idx" ON "app"."takeoff_measurements" USING btree ("sheet_id","line_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "takeoff_measurements_revision_boq_idx" ON "app"."takeoff_measurements" USING btree ("revision_id","boq_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "takeoff_measurements_revision_cost_code_idx" ON "app"."takeoff_measurements" USING btree ("revision_id","cost_code_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "takeoff_sheet_revisions_id_scope_unique" ON "app"."takeoff_sheet_revisions" USING btree ("id","sheet_id","organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "takeoff_sheet_revisions_sheet_number_unique" ON "app"."takeoff_sheet_revisions" USING btree ("sheet_id","revision_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "takeoff_sheet_revisions_org_project_idx" ON "app"."takeoff_sheet_revisions" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "takeoff_sheets_id_scope_unique" ON "app"."takeoff_sheets" USING btree ("id","organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "takeoff_sheets_org_project_created_idx" ON "app"."takeoff_sheets" USING btree ("organization_id","project_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "takeoff_sheets_org_project_status_idx" ON "app"."takeoff_sheets" USING btree ("organization_id","project_id","status","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "takeoff_sources_id_scope_unique" ON "app"."takeoff_sources" USING btree ("id","revision_id","organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "takeoff_sources_revision_version_page_unique" ON "app"."takeoff_sources" USING btree ("revision_id","document_version_id","page_reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "takeoff_sources_document_version_idx" ON "app"."takeoff_sources" USING btree ("document_version_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "takeoff_sources_org_project_idx" ON "app"."takeoff_sources" USING btree ("organization_id","project_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."takeoff_measurement_inputs" ADD CONSTRAINT "takeoff_measurement_inputs_measurement_scope_fk" FOREIGN KEY ("measurement_id","revision_id","organization_id","project_id") REFERENCES "app"."takeoff_measurements"("id","revision_id","organization_id","project_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."takeoff_measurements" ADD CONSTRAINT "takeoff_measurements_boq_item_id_boq_items_id_fk" FOREIGN KEY ("boq_item_id") REFERENCES "app"."boq_items"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."takeoff_measurements" ADD CONSTRAINT "takeoff_measurements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."takeoff_measurements" ADD CONSTRAINT "takeoff_measurements_revision_scope_fk" FOREIGN KEY ("revision_id","sheet_id","organization_id","project_id") REFERENCES "app"."takeoff_sheet_revisions"("id","sheet_id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."takeoff_measurements" ADD CONSTRAINT "takeoff_measurements_source_scope_fk" FOREIGN KEY ("source_id","revision_id","organization_id","project_id") REFERENCES "app"."takeoff_sources"("id","revision_id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."takeoff_measurements" ADD CONSTRAINT "takeoff_measurements_cost_code_scope_fk" FOREIGN KEY ("cost_code_id","organization_id","project_id") REFERENCES "app"."project_cost_codes"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."takeoff_sheet_revisions" ADD CONSTRAINT "takeoff_sheet_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."takeoff_sheet_revisions" ADD CONSTRAINT "takeoff_sheet_revisions_sheet_scope_fk" FOREIGN KEY ("sheet_id","organization_id","project_id") REFERENCES "app"."takeoff_sheets"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."takeoff_sheets" ADD CONSTRAINT "takeoff_sheets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."takeoff_sheets" ADD CONSTRAINT "takeoff_sheets_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."takeoff_sheets" ADD CONSTRAINT "takeoff_sheets_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."takeoff_sheets" ADD CONSTRAINT "takeoff_sheets_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."takeoff_sheets" ADD CONSTRAINT "takeoff_sheets_project_org_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "app"."projects"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."takeoff_sources" ADD CONSTRAINT "takeoff_sources_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "app"."documents"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."takeoff_sources" ADD CONSTRAINT "takeoff_sources_document_version_id_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "app"."document_versions"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."takeoff_sources" ADD CONSTRAINT "takeoff_sources_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."takeoff_sources" ADD CONSTRAINT "takeoff_sources_revision_scope_fk" FOREIGN KEY ("revision_id","sheet_id","organization_id","project_id") REFERENCES "app"."takeoff_sheet_revisions"("id","sheet_id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;