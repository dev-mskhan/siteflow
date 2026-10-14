CREATE TYPE "app"."agent_approval_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "app"."agent_risk_tier" AS ENUM('READ', 'DRAFT', 'BINDING');--> statement-breakpoint
CREATE TYPE "app"."agent_run_status" AS ENUM('QUEUED', 'RUNNING', 'AWAITING_APPROVAL', 'SUCCEEDED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "app"."agent_run_trigger" AS ENUM('USER', 'EVENT', 'SCHEDULE');--> statement-breakpoint
CREATE TYPE "app"."agent_tool_call_status" AS ENUM('SUCCESS', 'ERROR', 'SKIPPED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."agent_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"proposal_type" text NOT NULL,
	"proposal" jsonb NOT NULL,
	"status" "app"."agent_approval_status" DEFAULT 'PENDING' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_approvals_decision_metadata_check" CHECK ("app"."agent_approvals"."status" = 'PENDING' OR ("app"."agent_approvals"."decided_by" IS NOT NULL AND "app"."agent_approvals"."decided_at" IS NOT NULL)),
	CONSTRAINT "agent_approvals_expires_positive" CHECK ("app"."agent_approvals"."expires_at" > "app"."agent_approvals"."created_at")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text,
	"agent" text NOT NULL,
	"trigger" "app"."agent_run_trigger" NOT NULL,
	"trigger_ref" text,
	"status" "app"."agent_run_status" DEFAULT 'QUEUED' NOT NULL,
	"input_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb,
	"error" text,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(10, 6) DEFAULT '0' NOT NULL,
	"trace_id" text,
	"correlation_id" text,
	"created_by" text NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_runs_tokens_in_nonneg" CHECK ("app"."agent_runs"."tokens_in" >= 0),
	CONSTRAINT "agent_runs_tokens_out_nonneg" CHECK ("app"."agent_runs"."tokens_out" >= 0),
	CONSTRAINT "agent_runs_cost_nonneg" CHECK ("app"."agent_runs"."cost_usd" >= 0),
	CONSTRAINT "agent_runs_started_at_check" CHECK ("app"."agent_runs"."started_at" IS NULL OR "app"."agent_runs"."status" <> 'QUEUED'),
	CONSTRAINT "agent_runs_finished_at_check" CHECK ("app"."agent_runs"."finished_at" IS NULL OR "app"."agent_runs"."status" IN ('SUCCEEDED', 'FAILED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."agent_tool_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"tool_name" text NOT NULL,
	"risk_tier" "app"."agent_risk_tier" NOT NULL,
	"args_redacted" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_summary" jsonb,
	"status" "app"."agent_tool_call_status" NOT NULL,
	"error_message" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_tool_calls_duration_nonneg" CHECK ("app"."agent_tool_calls"."duration_ms" IS NULL OR "app"."agent_tool_calls"."duration_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."agent_usage_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"day" date NOT NULL,
	"agent" text NOT NULL,
	"runs_count" integer DEFAULT 0 NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(10, 6) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_usage_daily_runs_nonneg" CHECK ("app"."agent_usage_daily"."runs_count" >= 0),
	CONSTRAINT "agent_usage_daily_tokens_nonneg" CHECK ("app"."agent_usage_daily"."tokens_in" >= 0 AND "app"."agent_usage_daily"."tokens_out" >= 0),
	CONSTRAINT "agent_usage_daily_cost_nonneg" CHECK ("app"."agent_usage_daily"."cost_usd" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."material_rate_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"material_id" text NOT NULL,
	"scope" text NOT NULL,
	"project_id" text,
	"version_number" integer NOT NULL,
	"unit_code" text NOT NULL,
	"unit_price" numeric(15, 4) NOT NULL,
	"currency_code" text NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"created_by" text NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_rate_versions_price_gte_0" CHECK ("app"."material_rate_versions"."unit_price" >= 0),
	CONSTRAINT "material_rate_versions_period_valid" CHECK ("app"."material_rate_versions"."effective_to" IS NULL OR "app"."material_rate_versions"."effective_to" > "app"."material_rate_versions"."effective_from"),
	CONSTRAINT "material_rate_versions_scope_valid" CHECK (("app"."material_rate_versions"."scope" = 'ORGANIZATION' AND "app"."material_rate_versions"."project_id" IS NULL) OR ("app"."material_rate_versions"."scope" = 'PROJECT' AND "app"."material_rate_versions"."project_id" IS NOT NULL)),
	CONSTRAINT "material_rate_versions_status_valid" CHECK ("app"."material_rate_versions"."status" IN ('DRAFT', 'APPROVED', 'RETIRED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."proposal_client_events" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"proposal_revision_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"event" text NOT NULL,
	"client_signatory_name" text,
	"response_reference" text,
	"notes" text,
	"recorded_by" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_client_events_event_check" CHECK ("app"."proposal_client_events"."event" IN ('ACCEPTED','REJECTED','WITHDRAWN_BY_CLIENT','EXPIRED')),
	CONSTRAINT "proposal_client_events_notes_length" CHECK ("app"."proposal_client_events"."notes" IS NULL OR char_length("app"."proposal_client_events"."notes") <= 2000)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."proposal_conversions" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"proposal_revision_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"idempotency_key_hash" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"linked_project_id" text,
	"failure_reason" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "proposal_conversions_status_check" CHECK ("app"."proposal_conversions"."status" IN ('PENDING','COMPLETED','FAILED')),
	CONSTRAINT "proposal_conversions_completed_metadata_check" CHECK ("app"."proposal_conversions"."status" <> 'COMPLETED' OR ("app"."proposal_conversions"."completed_at" IS NOT NULL AND "app"."proposal_conversions"."linked_project_id" IS NOT NULL)),
	CONSTRAINT "proposal_conversions_failed_metadata_check" CHECK ("app"."proposal_conversions"."status" <> 'FAILED' OR "app"."proposal_conversions"."failure_reason" IS NOT NULL),
	CONSTRAINT "proposal_conversions_key_hash_check" CHECK ("app"."proposal_conversions"."idempotency_key_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."proposal_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"revision_id" text NOT NULL,
	"proposal_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"sort_order" integer NOT NULL,
	"item_key" text NOT NULL,
	"section_key" text,
	"description" text NOT NULL,
	"specification" text,
	"unit" text NOT NULL,
	"quantity" numeric(15, 3) NOT NULL,
	"unit_rate" numeric(15, 2) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency_code" text NOT NULL,
	"cost_code_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_lines_sort_positive" CHECK ("app"."proposal_lines"."sort_order" > 0),
	CONSTRAINT "proposal_lines_item_key_length" CHECK (char_length("app"."proposal_lines"."item_key") BETWEEN 1 AND 64),
	CONSTRAINT "proposal_lines_description_length" CHECK (char_length("app"."proposal_lines"."description") BETWEEN 1 AND 500),
	CONSTRAINT "proposal_lines_specification_length" CHECK ("app"."proposal_lines"."specification" IS NULL OR char_length("app"."proposal_lines"."specification") <= 2000),
	CONSTRAINT "proposal_lines_unit_length" CHECK (char_length("app"."proposal_lines"."unit") BETWEEN 1 AND 32),
	CONSTRAINT "proposal_lines_quantity_positive" CHECK ("app"."proposal_lines"."quantity" > 0),
	CONSTRAINT "proposal_lines_unit_rate_nonnegative" CHECK ("app"."proposal_lines"."unit_rate" >= 0),
	CONSTRAINT "proposal_lines_amount_nonnegative" CHECK ("app"."proposal_lines"."amount" >= 0),
	CONSTRAINT "proposal_lines_currency_check" CHECK ("app"."proposal_lines"."currency_code" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."proposal_number_sequences" (
	"organization_id" text NOT NULL,
	"series" text NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_number_sequences_last_number_check" CHECK ("app"."proposal_number_sequences"."last_number" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."proposal_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"source_estimate_id" text,
	"source_estimate_revision_id" text,
	"source_boq_id" text,
	"source_boq_revision_id" text,
	"currency_code" text NOT NULL,
	"calculation_version" text DEFAULT 'proposal-v1' NOT NULL,
	"tax_percent" numeric(7, 4) DEFAULT '0' NOT NULL,
	"tax_source" text,
	"overhead_percent" numeric(7, 4) DEFAULT '0' NOT NULL,
	"contingency_percent" numeric(7, 4) DEFAULT '0' NOT NULL,
	"markup_percent" numeric(7, 4) DEFAULT '0' NOT NULL,
	"discount_percent" numeric(7, 4) DEFAULT '0' NOT NULL,
	"subtotal_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"scope" text,
	"inclusions" text,
	"exclusions" text,
	"assumptions" text,
	"clarifications" text,
	"valid_until" text,
	"estimated_duration_days" integer,
	"schedule_summary" text,
	"commercial_terms" jsonb,
	"delivery_method" text DEFAULT 'INTERNAL' NOT NULL,
	"delivery_notes" text,
	"created_by" text NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp with time zone,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"issued_by" text,
	"issued_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_revisions_number_positive" CHECK ("app"."proposal_revisions"."revision_number" > 0),
	CONSTRAINT "proposal_revisions_status_check" CHECK ("app"."proposal_revisions"."status" IN ('DRAFT','PENDING_APPROVAL','APPROVED','ISSUED','SUPERSEDED')),
	CONSTRAINT "proposal_revisions_currency_check" CHECK ("app"."proposal_revisions"."currency_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "proposal_revisions_calc_version_length" CHECK (char_length("app"."proposal_revisions"."calculation_version") BETWEEN 1 AND 64),
	CONSTRAINT "proposal_revisions_tax_percent_check" CHECK ("app"."proposal_revisions"."tax_percent" BETWEEN 0 AND 100),
	CONSTRAINT "proposal_revisions_overhead_percent_check" CHECK ("app"."proposal_revisions"."overhead_percent" BETWEEN 0 AND 100),
	CONSTRAINT "proposal_revisions_contingency_percent_check" CHECK ("app"."proposal_revisions"."contingency_percent" BETWEEN 0 AND 100),
	CONSTRAINT "proposal_revisions_markup_percent_check" CHECK ("app"."proposal_revisions"."markup_percent" BETWEEN 0 AND 100),
	CONSTRAINT "proposal_revisions_discount_percent_check" CHECK ("app"."proposal_revisions"."discount_percent" BETWEEN 0 AND 100),
	CONSTRAINT "proposal_revisions_amounts_nonnegative" CHECK ("app"."proposal_revisions"."subtotal_amount" >= 0 AND "app"."proposal_revisions"."tax_amount" >= 0 AND "app"."proposal_revisions"."total_amount" >= 0),
	CONSTRAINT "proposal_revisions_tax_source_check" CHECK ("app"."proposal_revisions"."tax_percent" = 0 OR ("app"."proposal_revisions"."tax_source" IS NOT NULL AND char_length("app"."proposal_revisions"."tax_source") BETWEEN 1 AND 500)),
	CONSTRAINT "proposal_revisions_approval_metadata_check" CHECK ("app"."proposal_revisions"."status" NOT IN ('APPROVED','ISSUED') OR ("app"."proposal_revisions"."approved_by" IS NOT NULL AND "app"."proposal_revisions"."approved_at" IS NOT NULL)),
	CONSTRAINT "proposal_revisions_issued_metadata_check" CHECK ("app"."proposal_revisions"."status" <> 'ISSUED' OR ("app"."proposal_revisions"."issued_by" IS NOT NULL AND "app"."proposal_revisions"."issued_at" IS NOT NULL)),
	CONSTRAINT "proposal_revisions_delivery_method_check" CHECK ("app"."proposal_revisions"."delivery_method" IN ('INTERNAL','EMAIL')),
	CONSTRAINT "proposal_revisions_valid_until_format" CHECK ("app"."proposal_revisions"."valid_until" IS NULL OR "app"."proposal_revisions"."valid_until" ~ '^d{4}-d{2}-d{2}$'),
	CONSTRAINT "proposal_revisions_duration_positive" CHECK ("app"."proposal_revisions"."estimated_duration_days" IS NULL OR "app"."proposal_revisions"."estimated_duration_days" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"tender_id" text,
	"proposal_number" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"current_revision_number" integer DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"client_name" text,
	"client_reference" text,
	"source_estimate_id" text,
	"source_estimate_revision_id" text,
	"source_boq_id" text,
	"source_boq_revision_id" text,
	"created_by" text NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp with time zone,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"rejected_by" text,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"issued_at" timestamp with time zone,
	"issued_by" text,
	"accepted_at" timestamp with time zone,
	"accepted_by" text,
	"client_response_event" text,
	"client_response_at" timestamp with time zone,
	"client_signatory_name" text,
	"client_response_reference" text,
	"withdrawn_at" timestamp with time zone,
	"withdrawn_by" text,
	"withdrawal_reason" text,
	"expired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposals_title_length" CHECK (char_length("app"."proposals"."title") BETWEEN 1 AND 160),
	CONSTRAINT "proposals_description_length" CHECK ("app"."proposals"."description" IS NULL OR char_length("app"."proposals"."description") <= 5000),
	CONSTRAINT "proposals_number_length" CHECK (char_length("app"."proposals"."proposal_number") BETWEEN 1 AND 64),
	CONSTRAINT "proposals_revision_positive" CHECK ("app"."proposals"."current_revision_number" > 0),
	CONSTRAINT "proposals_version_positive" CHECK ("app"."proposals"."version" > 0),
	CONSTRAINT "proposals_status_check" CHECK ("app"."proposals"."status" IN ('DRAFT','PENDING_APPROVAL','APPROVED','ISSUED','ACCEPTED','REJECTED','WITHDRAWN','EXPIRED')),
	CONSTRAINT "proposals_approval_metadata_check" CHECK ("app"."proposals"."status" NOT IN ('APPROVED','ISSUED','ACCEPTED') OR ("app"."proposals"."approved_by" IS NOT NULL AND "app"."proposals"."approved_at" IS NOT NULL)),
	CONSTRAINT "proposals_issued_metadata_check" CHECK ("app"."proposals"."status" NOT IN ('ISSUED','ACCEPTED','REJECTED','WITHDRAWN','EXPIRED') OR ("app"."proposals"."issued_by" IS NOT NULL AND "app"."proposals"."issued_at" IS NOT NULL)),
	CONSTRAINT "proposals_rejection_metadata_check" CHECK ("app"."proposals"."status" <> 'REJECTED' OR ("app"."proposals"."rejected_by" IS NOT NULL AND "app"."proposals"."rejected_at" IS NOT NULL AND char_length("app"."proposals"."rejection_reason") >= 10)),
	CONSTRAINT "proposals_accepted_metadata_check" CHECK ("app"."proposals"."status" <> 'ACCEPTED' OR ("app"."proposals"."accepted_by" IS NOT NULL AND "app"."proposals"."accepted_at" IS NOT NULL)),
	CONSTRAINT "proposals_withdrawn_metadata_check" CHECK ("app"."proposals"."status" <> 'WITHDRAWN' OR ("app"."proposals"."withdrawn_by" IS NOT NULL AND "app"."proposals"."withdrawn_at" IS NOT NULL)),
	CONSTRAINT "proposals_client_response_check" CHECK ("app"."proposals"."client_response_event" IS NULL OR "app"."proposals"."client_response_event" IN ('ACCEPTED','REJECTED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."tenders" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text,
	"tender_number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"client_name" text NOT NULL,
	"client_reference" text,
	"issuer_name" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"submission_deadline" timestamp with time zone NOT NULL,
	"submission_timezone" text NOT NULL,
	"requirements" text,
	"required_documents" jsonb,
	"estimated_value" numeric(15, 2),
	"currency_code" text,
	"notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"submitted_at" timestamp with time zone,
	"awarded_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenders_title_length" CHECK (char_length("app"."tenders"."title") BETWEEN 1 AND 160),
	CONSTRAINT "tenders_description_length" CHECK ("app"."tenders"."description" IS NULL OR char_length("app"."tenders"."description") <= 5000),
	CONSTRAINT "tenders_client_name_length" CHECK (char_length("app"."tenders"."client_name") BETWEEN 1 AND 200),
	CONSTRAINT "tenders_number_positive" CHECK ("app"."tenders"."tender_number" > 0),
	CONSTRAINT "tenders_version_positive" CHECK ("app"."tenders"."version" > 0),
	CONSTRAINT "tenders_estimated_value_nonnegative" CHECK ("app"."tenders"."estimated_value" IS NULL OR "app"."tenders"."estimated_value" >= 0),
	CONSTRAINT "tenders_currency_check" CHECK ("app"."tenders"."currency_code" IS NULL OR "app"."tenders"."currency_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "tenders_timezone_length" CHECK (char_length("app"."tenders"."submission_timezone") BETWEEN 1 AND 100),
	CONSTRAINT "tenders_status_check" CHECK ("app"."tenders"."status" IN ('OPEN', 'SUBMITTED', 'AWARDED', 'LOST', 'WITHDRAWN', 'EXPIRED')),
	CONSTRAINT "tenders_submitted_metadata_check" CHECK ("app"."tenders"."status" NOT IN ('SUBMITTED','AWARDED','LOST') OR "app"."tenders"."submitted_at" IS NOT NULL),
	CONSTRAINT "tenders_awarded_metadata_check" CHECK ("app"."tenders"."status" <> 'AWARDED' OR "app"."tenders"."awarded_at" IS NOT NULL)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."material_rate_versions" ADD CONSTRAINT "material_rate_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."material_rate_versions" ADD CONSTRAINT "material_rate_versions_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "app"."materials"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."material_rate_versions" ADD CONSTRAINT "material_rate_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."material_rate_versions" ADD CONSTRAINT "material_rate_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."material_rate_versions" ADD CONSTRAINT "material_rate_versions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."proposal_client_events" ADD CONSTRAINT "proposal_client_events_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "proposal_lines_id_scope_unique" ON "app"."proposal_lines" USING btree ("id","revision_id","organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "proposal_revisions_id_scope_unique" ON "app"."proposal_revisions" USING btree ("id","organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "proposals_id_scope_unique" ON "app"."proposals" USING btree ("id","organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tenders_id_scope_unique" ON "app"."tenders" USING btree ("id","organization_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."proposal_client_events" ADD CONSTRAINT "proposal_client_events_revision_scope_fk" FOREIGN KEY ("proposal_revision_id","organization_id","project_id") REFERENCES "app"."proposal_revisions"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."proposal_conversions" ADD CONSTRAINT "proposal_conversions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."proposal_conversions" ADD CONSTRAINT "proposal_conversions_revision_scope_fk" FOREIGN KEY ("proposal_revision_id","organization_id","project_id") REFERENCES "app"."proposal_revisions"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."proposal_lines" ADD CONSTRAINT "proposal_lines_revision_scope_fk" FOREIGN KEY ("revision_id","organization_id","project_id") REFERENCES "app"."proposal_revisions"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."proposal_revisions" ADD CONSTRAINT "proposal_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."proposal_revisions" ADD CONSTRAINT "proposal_revisions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."proposal_revisions" ADD CONSTRAINT "proposal_revisions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."proposal_revisions" ADD CONSTRAINT "proposal_revisions_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."proposal_revisions" ADD CONSTRAINT "proposal_revisions_proposal_scope_fk" FOREIGN KEY ("proposal_id","organization_id","project_id") REFERENCES "app"."proposals"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."proposals" ADD CONSTRAINT "proposals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."proposals" ADD CONSTRAINT "proposals_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."proposals" ADD CONSTRAINT "proposals_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."proposals" ADD CONSTRAINT "proposals_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."proposals" ADD CONSTRAINT "proposals_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."proposals" ADD CONSTRAINT "proposals_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."proposals" ADD CONSTRAINT "proposals_withdrawn_by_users_id_fk" FOREIGN KEY ("withdrawn_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."proposals" ADD CONSTRAINT "proposals_project_org_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "app"."projects"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."tenders" ADD CONSTRAINT "tenders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_approvals_run_pending_unique" ON "app"."agent_approvals" USING btree ("run_id") WHERE "app"."agent_approvals"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_approvals_org_status_idx" ON "app"."agent_approvals" USING btree ("organization_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_approvals_run_idx" ON "app"."agent_approvals" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_approvals_expires_idx" ON "app"."agent_approvals" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_org_status_created_idx" ON "app"."agent_runs" USING btree ("organization_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_org_project_idx" ON "app"."agent_runs" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_org_agent_idx" ON "app"."agent_runs" USING btree ("organization_id","agent");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_created_by_idx" ON "app"."agent_runs" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_trace_id_idx" ON "app"."agent_runs" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_tool_calls_run_idx" ON "app"."agent_tool_calls" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_tool_calls_org_tool_idx" ON "app"."agent_tool_calls" USING btree ("organization_id","tool_name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_usage_daily_org_day_agent_unique" ON "app"."agent_usage_daily" USING btree ("organization_id","day","agent");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_usage_daily_org_day_idx" ON "app"."agent_usage_daily" USING btree ("organization_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "material_rate_versions_version_unique" ON "app"."material_rate_versions" USING btree ("organization_id","material_id","scope","project_id","version_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "material_rate_versions_lookup_idx" ON "app"."material_rate_versions" USING btree ("organization_id","material_id","scope","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposal_client_events_org_project_proposal_idx" ON "app"."proposal_client_events" USING btree ("organization_id","project_id","proposal_id","recorded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "proposal_conversions_idempotency_unique" ON "app"."proposal_conversions" USING btree ("organization_id","project_id","proposal_revision_id","idempotency_key_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposal_conversions_org_project_status_idx" ON "app"."proposal_conversions" USING btree ("organization_id","project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "proposal_lines_key_unique" ON "app"."proposal_lines" USING btree ("revision_id","item_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "proposal_lines_order_unique" ON "app"."proposal_lines" USING btree ("revision_id","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposal_lines_org_project_revision_idx" ON "app"."proposal_lines" USING btree ("organization_id","project_id","revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "proposal_number_sequences_pk" ON "app"."proposal_number_sequences" USING btree ("organization_id","series");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "proposal_revisions_number_unique" ON "app"."proposal_revisions" USING btree ("proposal_id","revision_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposal_revisions_org_project_status_idx" ON "app"."proposal_revisions" USING btree ("organization_id","project_id","status","revision_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "proposals_number_unique" ON "app"."proposals" USING btree ("organization_id","project_id","proposal_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposals_org_project_status_updated_idx" ON "app"."proposals" USING btree ("organization_id","project_id","status","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposals_org_tender_idx" ON "app"."proposals" USING btree ("organization_id","tender_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposals_org_project_created_idx" ON "app"."proposals" USING btree ("organization_id","project_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tenders_number_unique" ON "app"."tenders" USING btree ("organization_id","tender_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenders_org_status_deadline_idx" ON "app"."tenders" USING btree ("organization_id","status","submission_deadline" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenders_org_project_idx" ON "app"."tenders" USING btree ("organization_id","project_id");