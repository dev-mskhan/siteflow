CREATE TABLE IF NOT EXISTS "app"."boq_import_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"boq_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"status" text DEFAULT 'PREVIEWED' NOT NULL,
	"source_file_name" text NOT NULL,
	"source_file_sha256" text NOT NULL,
	"source_byte_size" integer NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"idempotency_key_hash" text NOT NULL,
	"error_summary" jsonb,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"committed_at" timestamp with time zone,
	CONSTRAINT "boq_import_runs_status_check" CHECK ("app"."boq_import_runs"."status" IN ('PREVIEWED', 'COMMITTED', 'REJECTED')),
	CONSTRAINT "boq_import_runs_committed_metadata_check" CHECK ("app"."boq_import_runs"."status" <> 'COMMITTED' OR "app"."boq_import_runs"."committed_at" IS NOT NULL),
	CONSTRAINT "boq_import_runs_file_name_length" CHECK (char_length("app"."boq_import_runs"."source_file_name") BETWEEN 1 AND 255),
	CONSTRAINT "boq_import_runs_sha256_check" CHECK ("app"."boq_import_runs"."source_file_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "boq_import_runs_byte_size_check" CHECK ("app"."boq_import_runs"."source_byte_size" BETWEEN 1 AND 2097152),
	CONSTRAINT "boq_import_runs_row_count_check" CHECK ("app"."boq_import_runs"."row_count" BETWEEN 0 AND 2000),
	CONSTRAINT "boq_import_runs_key_hash_check" CHECK ("app"."boq_import_runs"."idempotency_key_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."boq_items" (
	"id" text PRIMARY KEY NOT NULL,
	"revision_id" text NOT NULL,
	"section_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"item_key" text NOT NULL,
	"sort_order" integer NOT NULL,
	"description" text NOT NULL,
	"specification" text,
	"unit" text NOT NULL,
	"quantity" numeric(15, 3) NOT NULL,
	"unit_rate" numeric(15, 2),
	"amount" numeric(15, 2) NOT NULL,
	"currency_code" text NOT NULL,
	"cost_code_id" text,
	"provenance" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "boq_items_key_length" CHECK (char_length("app"."boq_items"."item_key") BETWEEN 1 AND 64),
	CONSTRAINT "boq_items_description_length" CHECK (char_length("app"."boq_items"."description") BETWEEN 1 AND 500),
	CONSTRAINT "boq_items_specification_length" CHECK ("app"."boq_items"."specification" IS NULL OR char_length("app"."boq_items"."specification") <= 2000),
	CONSTRAINT "boq_items_unit_length" CHECK (char_length("app"."boq_items"."unit") BETWEEN 1 AND 32),
	CONSTRAINT "boq_items_order_positive" CHECK ("app"."boq_items"."sort_order" > 0),
	CONSTRAINT "boq_items_quantity_positive" CHECK ("app"."boq_items"."quantity" > 0),
	CONSTRAINT "boq_items_unit_rate_nonnegative" CHECK ("app"."boq_items"."unit_rate" IS NULL OR "app"."boq_items"."unit_rate" >= 0),
	CONSTRAINT "boq_items_amount_nonnegative" CHECK ("app"."boq_items"."amount" >= 0),
	CONSTRAINT "boq_items_currency_check" CHECK ("app"."boq_items"."currency_code" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."boq_mappings" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"revision_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"target_type" text NOT NULL,
	"cost_code_id" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"reason" text,
	"mapped_by" text NOT NULL,
	"mapped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_by" text,
	"superseded_at" timestamp with time zone,
	CONSTRAINT "boq_mappings_target_type_check" CHECK ("app"."boq_mappings"."target_type" IN ('COST_CODE')),
	CONSTRAINT "boq_mappings_status_check" CHECK ("app"."boq_mappings"."status" IN ('ACTIVE', 'SUPERSEDED')),
	CONSTRAINT "boq_mappings_target_presence_check" CHECK (("app"."boq_mappings"."target_type" = 'COST_CODE' AND "app"."boq_mappings"."cost_code_id" IS NOT NULL)),
	CONSTRAINT "boq_mappings_reason_length" CHECK ("app"."boq_mappings"."reason" IS NULL OR char_length("app"."boq_mappings"."reason") <= 500),
	CONSTRAINT "boq_mappings_superseded_metadata_check" CHECK ("app"."boq_mappings"."status" <> 'SUPERSEDED' OR ("app"."boq_mappings"."superseded_by" IS NOT NULL AND "app"."boq_mappings"."superseded_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."boq_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"boq_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"source_import_run_id" text,
	"created_by" text NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"locked_by" text,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "boq_revisions_number_positive" CHECK ("app"."boq_revisions"."revision_number" > 0),
	CONSTRAINT "boq_revisions_status_check" CHECK ("app"."boq_revisions"."status" IN ('DRAFT', 'IN_REVIEW', 'APPROVED', 'LOCKED', 'SUPERSEDED')),
	CONSTRAINT "boq_revisions_approval_metadata_check" CHECK ("app"."boq_revisions"."status" NOT IN ('APPROVED', 'LOCKED', 'SUPERSEDED') OR ("app"."boq_revisions"."approved_by" IS NOT NULL AND "app"."boq_revisions"."approved_at" IS NOT NULL)),
	CONSTRAINT "boq_revisions_lock_metadata_check" CHECK ("app"."boq_revisions"."status" <> 'LOCKED' OR ("app"."boq_revisions"."locked_by" IS NOT NULL AND "app"."boq_revisions"."locked_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."boq_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"revision_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"section_key" text NOT NULL,
	"parent_section_id" text,
	"sort_order" integer NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "boq_sections_key_length" CHECK (char_length("app"."boq_sections"."section_key") BETWEEN 1 AND 64),
	CONSTRAINT "boq_sections_title_length" CHECK (char_length("app"."boq_sections"."title") BETWEEN 1 AND 160),
	CONSTRAINT "boq_sections_order_positive" CHECK ("app"."boq_sections"."sort_order" > 0),
	CONSTRAINT "boq_sections_depth_range" CHECK ("app"."boq_sections"."depth" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."boq_transfer_records" (
	"id" text PRIMARY KEY NOT NULL,
	"boq_id" text NOT NULL,
	"boq_revision_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"operation" text DEFAULT 'BUDGET_TRANSFER' NOT NULL,
	"status" text DEFAULT 'PREVIEWED' NOT NULL,
	"idempotency_key_hash" text NOT NULL,
	"budget_id" text,
	"budget_revision_id" text,
	"line_count" integer DEFAULT 0 NOT NULL,
	"total_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"result_summary" jsonb,
	"failure_reason" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "boq_transfer_records_operation_check" CHECK ("app"."boq_transfer_records"."operation" IN ('BUDGET_TRANSFER')),
	CONSTRAINT "boq_transfer_records_status_check" CHECK ("app"."boq_transfer_records"."status" IN ('PREVIEWED', 'COMPLETED', 'FAILED')),
	CONSTRAINT "boq_transfer_records_completed_metadata_check" CHECK ("app"."boq_transfer_records"."status" <> 'COMPLETED' OR ("app"."boq_transfer_records"."completed_at" IS NOT NULL AND "app"."boq_transfer_records"."budget_id" IS NOT NULL AND "app"."boq_transfer_records"."budget_revision_id" IS NOT NULL)),
	CONSTRAINT "boq_transfer_records_line_count_check" CHECK ("app"."boq_transfer_records"."line_count" >= 0),
	CONSTRAINT "boq_transfer_records_total_check" CHECK ("app"."boq_transfer_records"."total_amount" >= 0),
	CONSTRAINT "boq_transfer_records_key_hash_check" CHECK ("app"."boq_transfer_records"."idempotency_key_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."boqs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"boq_number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"currency_code" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"current_revision_number" integer DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "boqs_title_length" CHECK (char_length("app"."boqs"."title") BETWEEN 1 AND 160),
	CONSTRAINT "boqs_description_length" CHECK ("app"."boqs"."description" IS NULL OR char_length("app"."boqs"."description") <= 2000),
	CONSTRAINT "boqs_currency_check" CHECK ("app"."boqs"."currency_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "boqs_number_positive" CHECK ("app"."boqs"."boq_number" > 0),
	CONSTRAINT "boqs_revision_positive" CHECK ("app"."boqs"."current_revision_number" > 0),
	CONSTRAINT "boqs_version_positive" CHECK ("app"."boqs"."version" > 0),
	CONSTRAINT "boqs_status_check" CHECK ("app"."boqs"."status" IN ('DRAFT', 'IN_REVIEW', 'APPROVED', 'LOCKED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "boqs_id_scope_unique" ON "app"."boqs" USING btree ("id","organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "boq_revisions_id_scope_unique" ON "app"."boq_revisions" USING btree ("id","organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "boq_sections_id_scope_unique" ON "app"."boq_sections" USING btree ("id","revision_id","organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "boq_items_id_scope_unique" ON "app"."boq_items" USING btree ("id","revision_id","organization_id","project_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."boq_import_runs" ADD CONSTRAINT "boq_import_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."boq_import_runs" ADD CONSTRAINT "boq_import_runs_boq_scope_fk" FOREIGN KEY ("boq_id","organization_id","project_id") REFERENCES "app"."boqs"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."boq_items" ADD CONSTRAINT "boq_items_section_scope_fk" FOREIGN KEY ("section_id","revision_id","organization_id","project_id") REFERENCES "app"."boq_sections"("id","revision_id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."boq_items" ADD CONSTRAINT "boq_items_cost_code_scope_fk" FOREIGN KEY ("cost_code_id","organization_id","project_id") REFERENCES "app"."project_cost_codes"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."boq_mappings" ADD CONSTRAINT "boq_mappings_mapped_by_users_id_fk" FOREIGN KEY ("mapped_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."boq_mappings" ADD CONSTRAINT "boq_mappings_superseded_by_users_id_fk" FOREIGN KEY ("superseded_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."boq_mappings" ADD CONSTRAINT "boq_mappings_item_scope_fk" FOREIGN KEY ("item_id","revision_id","organization_id","project_id") REFERENCES "app"."boq_items"("id","revision_id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."boq_mappings" ADD CONSTRAINT "boq_mappings_cost_code_scope_fk" FOREIGN KEY ("cost_code_id","organization_id","project_id") REFERENCES "app"."project_cost_codes"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."boq_revisions" ADD CONSTRAINT "boq_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."boq_revisions" ADD CONSTRAINT "boq_revisions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."boq_revisions" ADD CONSTRAINT "boq_revisions_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."boq_revisions" ADD CONSTRAINT "boq_revisions_boq_scope_fk" FOREIGN KEY ("boq_id","organization_id","project_id") REFERENCES "app"."boqs"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."boq_sections" ADD CONSTRAINT "boq_sections_revision_scope_fk" FOREIGN KEY ("revision_id","organization_id","project_id") REFERENCES "app"."boq_revisions"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."boq_sections" ADD CONSTRAINT "boq_sections_parent_scope_fk" FOREIGN KEY ("parent_section_id","revision_id","organization_id","project_id") REFERENCES "app"."boq_sections"("id","revision_id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."boq_transfer_records" ADD CONSTRAINT "boq_transfer_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."boq_transfer_records" ADD CONSTRAINT "boq_transfer_records_revision_scope_fk" FOREIGN KEY ("boq_revision_id","organization_id","project_id") REFERENCES "app"."boq_revisions"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."boqs" ADD CONSTRAINT "boqs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."boqs" ADD CONSTRAINT "boqs_project_org_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "app"."projects"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "boq_import_runs_idempotency_unique" ON "app"."boq_import_runs" USING btree ("organization_id","project_id","boq_id","idempotency_key_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boq_import_runs_org_project_status_idx" ON "app"."boq_import_runs" USING btree ("organization_id","project_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "boq_items_key_unique" ON "app"."boq_items" USING btree ("revision_id","item_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "boq_items_order_unique" ON "app"."boq_items" USING btree ("revision_id","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boq_items_org_project_cost_code_idx" ON "app"."boq_items" USING btree ("organization_id","project_id","cost_code_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boq_items_section_order_idx" ON "app"."boq_items" USING btree ("section_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "boq_mappings_active_target_unique" ON "app"."boq_mappings" USING btree ("item_id","target_type") WHERE "app"."boq_mappings"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boq_mappings_org_project_cost_code_idx" ON "app"."boq_mappings" USING btree ("organization_id","project_id","cost_code_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "boq_revisions_number_unique" ON "app"."boq_revisions" USING btree ("boq_id","revision_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boq_revisions_org_project_status_idx" ON "app"."boq_revisions" USING btree ("organization_id","project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "boq_sections_key_unique" ON "app"."boq_sections" USING btree ("revision_id","section_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "boq_sections_order_unique" ON "app"."boq_sections" USING btree ("revision_id","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boq_sections_org_project_revision_idx" ON "app"."boq_sections" USING btree ("organization_id","project_id","revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "boq_transfer_records_operation_unique" ON "app"."boq_transfer_records" USING btree ("organization_id","project_id","boq_revision_id","operation");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "boq_transfer_records_idempotency_unique" ON "app"."boq_transfer_records" USING btree ("organization_id","project_id","boq_revision_id","operation","idempotency_key_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boq_transfer_records_org_project_status_idx" ON "app"."boq_transfer_records" USING btree ("organization_id","project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "boqs_number_unique" ON "app"."boqs" USING btree ("organization_id","project_id","boq_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boqs_org_project_status_idx" ON "app"."boqs" USING btree ("organization_id","project_id","status","updated_at" DESC NULLS LAST);