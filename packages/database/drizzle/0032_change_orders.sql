CREATE TABLE IF NOT EXISTS "app"."change_order_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"change_order_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"line_number" integer NOT NULL,
	"description" text NOT NULL,
	"cost_code_id" text NOT NULL,
	"phase_id" text,
	"task_id" text,
	"document_id" text,
	"boq_line_id" text,
	"cost_delta" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"revenue_delta" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "change_order_lines_number_positive" CHECK ("app"."change_order_lines"."line_number" > 0),
	CONSTRAINT "change_order_lines_description_length" CHECK (char_length("app"."change_order_lines"."description") BETWEEN 1 AND 1000)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."change_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"change_order_number" text NOT NULL,
	"title" text NOT NULL,
	"reason" text NOT NULL,
	"requester_id" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"currency_code" text NOT NULL,
	"cost_delta" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"revenue_delta" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"schedule_delta_days" integer DEFAULT 0 NOT NULL,
	"client_approval_required" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp with time zone,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"client_approved_by" text,
	"client_approved_at" timestamp with time zone,
	"rejected_by" text,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"effected_by" text,
	"effected_at" timestamp with time zone,
	"effected_budget_revision_id" text,
	"voided_by" text,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "change_orders_status_check" CHECK ("app"."change_orders"."status" IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'PENDING_CLIENT_APPROVAL', 'CLIENT_APPROVED', 'REJECTED', 'EFFECTED', 'VOIDED')),
	CONSTRAINT "change_orders_currency_check" CHECK ("app"."change_orders"."currency_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "change_orders_version_positive" CHECK ("app"."change_orders"."version" > 0),
	CONSTRAINT "change_orders_title_length" CHECK (char_length("app"."change_orders"."title") BETWEEN 1 AND 200),
	CONSTRAINT "change_orders_reason_length" CHECK (char_length("app"."change_orders"."reason") BETWEEN 1 AND 2000),
	CONSTRAINT "change_orders_approval_metadata_check" CHECK ("app"."change_orders"."status" NOT IN ('APPROVED', 'PENDING_CLIENT_APPROVAL', 'CLIENT_APPROVED', 'EFFECTED') OR ("app"."change_orders"."approved_by" IS NOT NULL AND "app"."change_orders"."approved_at" IS NOT NULL)),
	CONSTRAINT "change_orders_client_approval_metadata_check" CHECK ("app"."change_orders"."status" <> 'EFFECTED' OR NOT "app"."change_orders"."client_approval_required" OR ("app"."change_orders"."client_approved_by" IS NOT NULL AND "app"."change_orders"."client_approved_at" IS NOT NULL)),
	CONSTRAINT "change_orders_rejection_metadata_check" CHECK ("app"."change_orders"."status" <> 'REJECTED' OR ("app"."change_orders"."rejected_by" IS NOT NULL AND "app"."change_orders"."rejected_at" IS NOT NULL AND "app"."change_orders"."rejection_reason" IS NOT NULL)),
	CONSTRAINT "change_orders_effect_metadata_check" CHECK ("app"."change_orders"."status" <> 'EFFECTED' OR ("app"."change_orders"."effected_by" IS NOT NULL AND "app"."change_orders"."effected_at" IS NOT NULL)),
	CONSTRAINT "change_orders_void_metadata_check" CHECK ("app"."change_orders"."status" <> 'VOIDED' OR ("app"."change_orders"."voided_by" IS NOT NULL AND "app"."change_orders"."voided_at" IS NOT NULL))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."change_order_lines" ADD CONSTRAINT "change_order_lines_cost_code_id_project_cost_codes_id_fk" FOREIGN KEY ("cost_code_id") REFERENCES "app"."project_cost_codes"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."change_order_lines" ADD CONSTRAINT "change_order_lines_phase_id_project_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "app"."project_phases"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."change_order_lines" ADD CONSTRAINT "change_order_lines_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "app"."tasks"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."change_order_lines" ADD CONSTRAINT "change_order_lines_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "app"."documents"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "change_orders_id_scope_unique" ON "app"."change_orders" USING btree ("id","organization_id","project_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."change_order_lines" ADD CONSTRAINT "change_order_lines_change_order_scope_fk" FOREIGN KEY ("change_order_id","organization_id","project_id") REFERENCES "app"."change_orders"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."change_orders" ADD CONSTRAINT "change_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."change_orders" ADD CONSTRAINT "change_orders_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."change_orders" ADD CONSTRAINT "change_orders_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."change_orders" ADD CONSTRAINT "change_orders_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."change_orders" ADD CONSTRAINT "change_orders_client_approved_by_users_id_fk" FOREIGN KEY ("client_approved_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."change_orders" ADD CONSTRAINT "change_orders_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."change_orders" ADD CONSTRAINT "change_orders_effected_by_users_id_fk" FOREIGN KEY ("effected_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."change_orders" ADD CONSTRAINT "change_orders_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."change_orders" ADD CONSTRAINT "change_orders_project_org_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "app"."projects"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."change_orders" ADD CONSTRAINT "change_orders_effected_budget_revision_scope_fk" FOREIGN KEY ("effected_budget_revision_id","organization_id","project_id") REFERENCES "app"."project_budget_revisions"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "change_order_lines_number_unique" ON "app"."change_order_lines" USING btree ("change_order_id","line_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_order_lines_org_project_code_idx" ON "app"."change_order_lines" USING btree ("organization_id","project_id","cost_code_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_order_lines_org_project_phase_idx" ON "app"."change_order_lines" USING btree ("organization_id","project_id","phase_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_order_lines_org_project_task_idx" ON "app"."change_order_lines" USING btree ("organization_id","project_id","task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_order_lines_org_project_document_idx" ON "app"."change_order_lines" USING btree ("organization_id","project_id","document_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "change_orders_project_number_unique" ON "app"."change_orders" USING btree ("project_id","change_order_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "change_orders_effected_revision_unique" ON "app"."change_orders" USING btree ("effected_budget_revision_id") WHERE "app"."change_orders"."effected_budget_revision_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_orders_org_project_status_created_idx" ON "app"."change_orders" USING btree ("organization_id","project_id","status","created_at" DESC NULLS LAST);