CREATE TABLE IF NOT EXISTS "app"."payment_application_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_application_id" text NOT NULL,
	"schedule_of_value_line_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"line_number" integer NOT NULL,
	"current_work" numeric(15, 2) NOT NULL,
	"stored_materials" numeric(15, 2) NOT NULL,
	"gross_completed" numeric(15, 2) NOT NULL,
	"retainage_percent" numeric(5, 2) NOT NULL,
	"retainage_requested" numeric(15, 2) NOT NULL,
	"prior_approved_gross" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"requested_amount" numeric(15, 2) NOT NULL,
	"approved_current_work" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"approved_stored_materials" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"approved_gross" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"approved_retainage" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"approved_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_application_lines_line_number_positive" CHECK ("app"."payment_application_lines"."line_number" > 0),
	CONSTRAINT "payment_application_lines_amounts_nonnegative" CHECK ("app"."payment_application_lines"."current_work" >= 0 AND "app"."payment_application_lines"."stored_materials" >= 0 AND "app"."payment_application_lines"."gross_completed" >= 0 AND "app"."payment_application_lines"."retainage_requested" >= 0 AND "app"."payment_application_lines"."prior_approved_gross" >= 0 AND "app"."payment_application_lines"."requested_amount" >= 0 AND "app"."payment_application_lines"."approved_current_work" >= 0 AND "app"."payment_application_lines"."approved_stored_materials" >= 0 AND "app"."payment_application_lines"."approved_gross" >= 0 AND "app"."payment_application_lines"."approved_retainage" >= 0 AND "app"."payment_application_lines"."approved_amount" >= 0),
	CONSTRAINT "payment_application_lines_request_reconciles" CHECK ("app"."payment_application_lines"."current_work" + "app"."payment_application_lines"."stored_materials" = "app"."payment_application_lines"."gross_completed" AND "app"."payment_application_lines"."gross_completed" - "app"."payment_application_lines"."retainage_requested" = "app"."payment_application_lines"."requested_amount"),
	CONSTRAINT "payment_application_lines_approval_reconciles" CHECK ("app"."payment_application_lines"."approved_current_work" + "app"."payment_application_lines"."approved_stored_materials" = "app"."payment_application_lines"."approved_gross" AND "app"."payment_application_lines"."approved_gross" - "app"."payment_application_lines"."approved_retainage" = "app"."payment_application_lines"."approved_amount"),
	CONSTRAINT "payment_application_lines_retainage_percent_range" CHECK ("app"."payment_application_lines"."retainage_percent" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."payment_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"revision_id" text NOT NULL,
	"application_number" integer NOT NULL,
	"billing_period_start" date NOT NULL,
	"billing_period_end" date NOT NULL,
	"currency_code" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp with time zone,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"rejected_by" text,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"voided_by" text,
	"voided_at" timestamp with time zone,
	"gross_requested" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"retainage_requested" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"prior_approved_gross" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"requested_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"approved_gross" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"approved_retainage" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"approved_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_applications_number_positive" CHECK ("app"."payment_applications"."application_number" > 0),
	CONSTRAINT "payment_applications_version_positive" CHECK ("app"."payment_applications"."version" > 0),
	CONSTRAINT "payment_applications_period_check" CHECK ("app"."payment_applications"."billing_period_start" <= "app"."payment_applications"."billing_period_end"),
	CONSTRAINT "payment_applications_currency_check" CHECK ("app"."payment_applications"."currency_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "payment_applications_status_check" CHECK ("app"."payment_applications"."status" IN ('DRAFT', 'PENDING_REVIEW', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'VOIDED')),
	CONSTRAINT "payment_applications_submission_metadata_check" CHECK ("app"."payment_applications"."status" NOT IN ('PENDING_REVIEW', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED') OR ("app"."payment_applications"."submitted_by" IS NOT NULL AND "app"."payment_applications"."submitted_at" IS NOT NULL)),
	CONSTRAINT "payment_applications_review_metadata_check" CHECK ("app"."payment_applications"."status" <> 'UNDER_REVIEW' OR ("app"."payment_applications"."reviewed_by" IS NOT NULL AND "app"."payment_applications"."reviewed_at" IS NOT NULL)),
	CONSTRAINT "payment_applications_approval_metadata_check" CHECK ("app"."payment_applications"."status" NOT IN ('APPROVED', 'PARTIALLY_APPROVED') OR ("app"."payment_applications"."approved_by" IS NOT NULL AND "app"."payment_applications"."approved_at" IS NOT NULL)),
	CONSTRAINT "payment_applications_rejection_metadata_check" CHECK ("app"."payment_applications"."status" <> 'REJECTED' OR ("app"."payment_applications"."rejected_by" IS NOT NULL AND "app"."payment_applications"."rejected_at" IS NOT NULL AND "app"."payment_applications"."rejection_reason" IS NOT NULL)),
	CONSTRAINT "payment_applications_void_metadata_check" CHECK ("app"."payment_applications"."status" <> 'VOIDED' OR ("app"."payment_applications"."voided_by" IS NOT NULL AND "app"."payment_applications"."voided_at" IS NOT NULL)),
	CONSTRAINT "payment_applications_totals_nonnegative" CHECK ("app"."payment_applications"."gross_requested" >= 0 AND "app"."payment_applications"."retainage_requested" >= 0 AND "app"."payment_applications"."prior_approved_gross" >= 0 AND "app"."payment_applications"."requested_amount" >= 0 AND "app"."payment_applications"."approved_gross" >= 0 AND "app"."payment_applications"."approved_retainage" >= 0 AND "app"."payment_applications"."approved_amount" >= 0),
	CONSTRAINT "payment_applications_totals_reconcile" CHECK ("app"."payment_applications"."gross_requested" - "app"."payment_applications"."retainage_requested" = "app"."payment_applications"."requested_amount" AND "app"."payment_applications"."approved_gross" - "app"."payment_applications"."approved_retainage" = "app"."payment_applications"."approved_amount")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."schedule_of_value_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"schedule_of_value_line_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"completed_to_date" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"stored_materials" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"retainage_accrued" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_of_value_progress_nonnegative" CHECK ("app"."schedule_of_value_progress"."completed_to_date" >= 0 AND "app"."schedule_of_value_progress"."stored_materials" >= 0 AND "app"."schedule_of_value_progress"."retainage_accrued" >= 0)
);
--> statement-breakpoint
ALTER TABLE "app"."schedule_of_value_lines"
	ADD COLUMN IF NOT EXISTS "completed_to_date" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	ADD COLUMN IF NOT EXISTS "stored_materials" numeric(15, 2) DEFAULT '0.00' NOT NULL;
--> statement-breakpoint
INSERT INTO "app"."schedule_of_value_progress" (
	"id", "schedule_of_value_line_id", "organization_id", "project_id",
	"completed_to_date", "stored_materials", "retainage_accrued"
)
SELECT gen_random_uuid()::text, line."id", line."organization_id", line."project_id",
	line."completed_to_date", line."stored_materials",
	ROUND((line."completed_to_date" + line."stored_materials") * line."retainage_percent" / 100, 2)
FROM "app"."schedule_of_value_lines" AS line
INNER JOIN "app"."schedule_of_value_revisions" AS revision
	ON revision."id" = line."revision_id"
	AND revision."organization_id" = line."organization_id"
	AND revision."project_id" = line."project_id"
WHERE revision."status" IN ('APPROVED', 'SUPERSEDED')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "app"."schedule_of_value_lines" DROP CONSTRAINT IF EXISTS "schedule_of_value_lines_progress_nonnegative";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_applications_id_scope_unique" ON "app"."payment_applications" USING btree ("id","organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "schedule_of_value_lines_id_scope_unique" ON "app"."schedule_of_value_lines" USING btree ("id","organization_id","project_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."payment_application_lines" ADD CONSTRAINT "payment_application_lines_application_scope_fk" FOREIGN KEY ("payment_application_id","organization_id","project_id") REFERENCES "app"."payment_applications"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."payment_application_lines" ADD CONSTRAINT "payment_application_lines_sov_line_scope_fk" FOREIGN KEY ("schedule_of_value_line_id","organization_id","project_id") REFERENCES "app"."schedule_of_value_lines"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."payment_applications" ADD CONSTRAINT "payment_applications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."payment_applications" ADD CONSTRAINT "payment_applications_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."payment_applications" ADD CONSTRAINT "payment_applications_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."payment_applications" ADD CONSTRAINT "payment_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."payment_applications" ADD CONSTRAINT "payment_applications_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."payment_applications" ADD CONSTRAINT "payment_applications_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."payment_applications" ADD CONSTRAINT "payment_applications_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."payment_applications" ADD CONSTRAINT "payment_applications_project_org_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "app"."projects"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."payment_applications" ADD CONSTRAINT "payment_applications_revision_scope_fk" FOREIGN KEY ("revision_id","organization_id","project_id") REFERENCES "app"."schedule_of_value_revisions"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."schedule_of_value_progress" ADD CONSTRAINT "schedule_of_value_progress_line_scope_fk" FOREIGN KEY ("schedule_of_value_line_id","organization_id","project_id") REFERENCES "app"."schedule_of_value_lines"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_application_lines_application_line_unique" ON "app"."payment_application_lines" USING btree ("payment_application_id","schedule_of_value_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_application_lines_number_unique" ON "app"."payment_application_lines" USING btree ("payment_application_id","line_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_application_lines_project_sov_line_idx" ON "app"."payment_application_lines" USING btree ("organization_id","project_id","schedule_of_value_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_applications_number_unique" ON "app"."payment_applications" USING btree ("project_id","application_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_applications_project_status_period_idx" ON "app"."payment_applications" USING btree ("organization_id","project_id","status","billing_period_end" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "schedule_of_value_progress_line_unique" ON "app"."schedule_of_value_progress" USING btree ("schedule_of_value_line_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_of_value_progress_scope_idx" ON "app"."schedule_of_value_progress" USING btree ("organization_id","project_id");--> statement-breakpoint
ALTER TABLE "app"."schedule_of_value_lines" DROP COLUMN IF EXISTS "completed_to_date";--> statement-breakpoint
ALTER TABLE "app"."schedule_of_value_lines" DROP COLUMN IF EXISTS "stored_materials";