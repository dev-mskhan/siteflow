CREATE TABLE IF NOT EXISTS "app"."cost_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"cost_code_id" text NOT NULL,
	"phase_id" text,
	"task_id" text,
	"document_id" text,
	"source_type" text DEFAULT 'MANUAL' NOT NULL,
	"source_id" text,
	"transaction_date" date NOT NULL,
	"posting_date" date,
	"description" text NOT NULL,
	"quantity" numeric(15, 3),
	"unit" text,
	"unit_cost" numeric(15, 2),
	"subtotal" numeric(15, 2) NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"total_amount" numeric(15, 2) NOT NULL,
	"currency_code" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"created_by" text NOT NULL,
	"posted_by" text,
	"posted_at" timestamp with time zone,
	"voided_by" text,
	"voided_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"reversal_of_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cost_transactions_source_type_check" CHECK ("app"."cost_transactions"."source_type" IN ('MANUAL', 'DOCUMENT', 'TASK', 'PHASE', 'VOID_REVERSAL')),
	CONSTRAINT "cost_transactions_source_pair_check" CHECK (("app"."cost_transactions"."source_type" = 'MANUAL' AND ("app"."cost_transactions"."source_id" IS NULL OR char_length("app"."cost_transactions"."source_id") > 0)) OR ("app"."cost_transactions"."source_type" IN ('DOCUMENT', 'TASK', 'PHASE') AND "app"."cost_transactions"."source_id" IS NOT NULL) OR ("app"."cost_transactions"."source_type" = 'VOID_REVERSAL' AND "app"."cost_transactions"."source_id" IS NULL)),
	CONSTRAINT "cost_transactions_currency_check" CHECK ("app"."cost_transactions"."currency_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "cost_transactions_status_check" CHECK ("app"."cost_transactions"."status" IN ('DRAFT', 'POSTED', 'VOIDED')),
	CONSTRAINT "cost_transactions_description_length" CHECK (char_length("app"."cost_transactions"."description") BETWEEN 1 AND 1000),
	CONSTRAINT "cost_transactions_quantity_unit_check" CHECK (("app"."cost_transactions"."quantity" IS NULL AND "app"."cost_transactions"."unit" IS NULL AND "app"."cost_transactions"."unit_cost" IS NULL) OR ("app"."cost_transactions"."quantity" > 0 AND "app"."cost_transactions"."unit" IS NOT NULL AND char_length("app"."cost_transactions"."unit") BETWEEN 1 AND 64 AND "app"."cost_transactions"."unit_cost" >= 0)),
	CONSTRAINT "cost_transactions_amounts_check" CHECK (("app"."cost_transactions"."source_type" = 'VOID_REVERSAL' AND "app"."cost_transactions"."subtotal" <= 0 AND "app"."cost_transactions"."tax_amount" <= 0 AND "app"."cost_transactions"."total_amount" <= 0) OR ("app"."cost_transactions"."source_type" <> 'VOID_REVERSAL' AND "app"."cost_transactions"."subtotal" >= 0 AND "app"."cost_transactions"."tax_amount" >= 0 AND "app"."cost_transactions"."total_amount" >= 0)),
	CONSTRAINT "cost_transactions_total_check" CHECK ("app"."cost_transactions"."total_amount" = "app"."cost_transactions"."subtotal" + "app"."cost_transactions"."tax_amount"),
	CONSTRAINT "cost_transactions_version_positive" CHECK ("app"."cost_transactions"."version" > 0),
	CONSTRAINT "cost_transactions_post_metadata_check" CHECK ("app"."cost_transactions"."status" NOT IN ('POSTED', 'VOIDED') OR ("app"."cost_transactions"."posted_by" IS NOT NULL AND "app"."cost_transactions"."posted_at" IS NOT NULL AND "app"."cost_transactions"."posting_date" IS NOT NULL)),
	CONSTRAINT "cost_transactions_void_metadata_check" CHECK ("app"."cost_transactions"."status" <> 'VOIDED' OR ("app"."cost_transactions"."voided_by" IS NOT NULL AND "app"."cost_transactions"."voided_at" IS NOT NULL)),
	CONSTRAINT "cost_transactions_reversal_check" CHECK (("app"."cost_transactions"."source_type" = 'VOID_REVERSAL' AND "app"."cost_transactions"."reversal_of_id" IS NOT NULL AND "app"."cost_transactions"."status" = 'POSTED') OR ("app"."cost_transactions"."source_type" <> 'VOID_REVERSAL' AND "app"."cost_transactions"."reversal_of_id" IS NULL))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."cost_transactions" ADD CONSTRAINT "cost_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."cost_transactions" ADD CONSTRAINT "cost_transactions_cost_code_id_project_cost_codes_id_fk" FOREIGN KEY ("cost_code_id") REFERENCES "app"."project_cost_codes"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."cost_transactions" ADD CONSTRAINT "cost_transactions_phase_id_project_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "app"."project_phases"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."cost_transactions" ADD CONSTRAINT "cost_transactions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "app"."tasks"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."cost_transactions" ADD CONSTRAINT "cost_transactions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "app"."documents"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."cost_transactions" ADD CONSTRAINT "cost_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."cost_transactions" ADD CONSTRAINT "cost_transactions_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."cost_transactions" ADD CONSTRAINT "cost_transactions_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."cost_transactions" ADD CONSTRAINT "cost_transactions_project_org_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "app"."projects"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."cost_transactions" ADD CONSTRAINT "cost_transactions_reversal_scope_fk" FOREIGN KEY ("reversal_of_id") REFERENCES "app"."cost_transactions"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cost_transactions_source_unique" ON "app"."cost_transactions" USING btree ("organization_id","project_id","source_type","source_id") WHERE "app"."cost_transactions"."source_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cost_transactions_reversal_unique" ON "app"."cost_transactions" USING btree ("reversal_of_id") WHERE "app"."cost_transactions"."reversal_of_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_transactions_org_project_created_idx" ON "app"."cost_transactions" USING btree ("organization_id","project_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_transactions_org_project_cost_code_idx" ON "app"."cost_transactions" USING btree ("organization_id","project_id","cost_code_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_transactions_org_project_status_idx" ON "app"."cost_transactions" USING btree ("organization_id","project_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_transactions_phase_idx" ON "app"."cost_transactions" USING btree ("organization_id","project_id","phase_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_transactions_task_idx" ON "app"."cost_transactions" USING btree ("organization_id","project_id","task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_transactions_document_idx" ON "app"."cost_transactions" USING btree ("organization_id","project_id","document_id");