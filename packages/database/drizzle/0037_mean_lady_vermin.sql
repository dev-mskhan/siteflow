CREATE TABLE IF NOT EXISTS "app"."invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"direction" text NOT NULL,
	"invoice_number" text NOT NULL,
	"supplier_id" text,
	"purchase_order_id" text,
	"payment_application_id" text,
	"bill_to_name" text,
	"invoice_date" date NOT NULL,
	"due_date" date,
	"currency_code" text NOT NULL,
	"subtotal" numeric(15, 2) NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"retainage_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"total_amount" numeric(15, 2) NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp with time zone,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"rejected_by" text,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"voided_by" text,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_direction_check" CHECK ("app"."invoices"."direction" IN ('RECEIVABLE', 'PAYABLE')),
	CONSTRAINT "invoices_source_check" CHECK (("app"."invoices"."direction" = 'RECEIVABLE' AND "app"."invoices"."bill_to_name" IS NOT NULL AND "app"."invoices"."supplier_id" IS NULL AND "app"."invoices"."purchase_order_id" IS NULL)
        OR ("app"."invoices"."direction" = 'PAYABLE' AND "app"."invoices"."bill_to_name" IS NULL AND "app"."invoices"."supplier_id" IS NOT NULL AND "app"."invoices"."purchase_order_id" IS NOT NULL)),
	CONSTRAINT "invoices_number_nonempty" CHECK (length(trim("app"."invoices"."invoice_number")) > 0),
	CONSTRAINT "invoices_currency_check" CHECK ("app"."invoices"."currency_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "invoices_dates_check" CHECK ("app"."invoices"."due_date" IS NULL OR "app"."invoices"."due_date" >= "app"."invoices"."invoice_date"),
	CONSTRAINT "invoices_amounts_check" CHECK ("app"."invoices"."subtotal" >= 0 AND "app"."invoices"."tax_amount" >= 0 AND "app"."invoices"."retainage_amount" >= 0 AND "app"."invoices"."total_amount" = "app"."invoices"."subtotal" + "app"."invoices"."tax_amount" - "app"."invoices"."retainage_amount" AND "app"."invoices"."total_amount" > 0),
	CONSTRAINT "invoices_version_check" CHECK ("app"."invoices"."version" > 0),
	CONSTRAINT "invoices_status_check" CHECK ("app"."invoices"."status" IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'VOIDED')),
	CONSTRAINT "invoices_submit_metadata_check" CHECK ("app"."invoices"."status" NOT IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED') OR ("app"."invoices"."submitted_by" IS NOT NULL AND "app"."invoices"."submitted_at" IS NOT NULL)),
	CONSTRAINT "invoices_approval_metadata_check" CHECK ("app"."invoices"."status" <> 'APPROVED' OR ("app"."invoices"."approved_by" IS NOT NULL AND "app"."invoices"."approved_at" IS NOT NULL)),
	CONSTRAINT "invoices_rejection_metadata_check" CHECK ("app"."invoices"."status" <> 'REJECTED' OR ("app"."invoices"."rejected_by" IS NOT NULL AND "app"."invoices"."rejected_at" IS NOT NULL AND "app"."invoices"."rejection_reason" IS NOT NULL)),
	CONSTRAINT "invoices_void_metadata_check" CHECK ("app"."invoices"."status" <> 'VOIDED' OR ("app"."invoices"."voided_by" IS NOT NULL AND "app"."invoices"."voided_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."payments" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"direction" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency_code" text NOT NULL,
	"payment_date" date NOT NULL,
	"method" text NOT NULL,
	"reference" text,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp with time zone,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"rejected_by" text,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"executed_by" text,
	"executed_at" timestamp with time zone,
	"voided_by" text,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_direction_check" CHECK ("app"."payments"."direction" IN ('RECEIVABLE', 'PAYABLE')),
	CONSTRAINT "payments_amount_check" CHECK ("app"."payments"."amount" > 0),
	CONSTRAINT "payments_currency_check" CHECK ("app"."payments"."currency_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "payments_method_check" CHECK (length(trim("app"."payments"."method")) > 0 AND length("app"."payments"."method") <= 64),
	CONSTRAINT "payments_version_check" CHECK ("app"."payments"."version" > 0),
	CONSTRAINT "payments_status_check" CHECK ("app"."payments"."status" IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXECUTED', 'VOIDED')),
	CONSTRAINT "payments_submit_metadata_check" CHECK ("app"."payments"."status" NOT IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXECUTED') OR ("app"."payments"."submitted_by" IS NOT NULL AND "app"."payments"."submitted_at" IS NOT NULL)),
	CONSTRAINT "payments_approval_metadata_check" CHECK ("app"."payments"."status" NOT IN ('APPROVED', 'EXECUTED') OR ("app"."payments"."approved_by" IS NOT NULL AND "app"."payments"."approved_at" IS NOT NULL)),
	CONSTRAINT "payments_execution_metadata_check" CHECK ("app"."payments"."status" <> 'EXECUTED' OR ("app"."payments"."executed_by" IS NOT NULL AND "app"."payments"."executed_at" IS NOT NULL)),
	CONSTRAINT "payments_rejection_metadata_check" CHECK ("app"."payments"."status" <> 'REJECTED' OR ("app"."payments"."rejected_by" IS NOT NULL AND "app"."payments"."rejected_at" IS NOT NULL AND "app"."payments"."rejection_reason" IS NOT NULL)),
	CONSTRAINT "payments_void_metadata_check" CHECK ("app"."payments"."status" <> 'VOIDED' OR ("app"."payments"."voided_by" IS NOT NULL AND "app"."payments"."voided_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_id_scope_unique" ON "app"."purchase_orders" USING btree ("id","organization_id","project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_id_org_unique" ON "app"."suppliers" USING btree ("id","organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_id_scope_unique" ON "app"."invoices" USING btree ("id","organization_id","project_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."invoices" ADD CONSTRAINT "invoices_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."invoices" ADD CONSTRAINT "invoices_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."invoices" ADD CONSTRAINT "invoices_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."invoices" ADD CONSTRAINT "invoices_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."invoices" ADD CONSTRAINT "invoices_project_org_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "app"."projects"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."invoices" ADD CONSTRAINT "invoices_purchase_order_scope_fk" FOREIGN KEY ("purchase_order_id","organization_id","project_id") REFERENCES "app"."purchase_orders"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."invoices" ADD CONSTRAINT "invoices_payment_application_scope_fk" FOREIGN KEY ("payment_application_id","organization_id","project_id") REFERENCES "app"."payment_applications"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."invoices" ADD CONSTRAINT "invoices_supplier_org_fk" FOREIGN KEY ("supplier_id","organization_id") REFERENCES "app"."suppliers"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."payments" ADD CONSTRAINT "payments_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."payments" ADD CONSTRAINT "payments_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."payments" ADD CONSTRAINT "payments_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."payments" ADD CONSTRAINT "payments_executed_by_users_id_fk" FOREIGN KEY ("executed_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."payments" ADD CONSTRAINT "payments_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."payments" ADD CONSTRAINT "payments_project_org_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "app"."projects"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."payments" ADD CONSTRAINT "payments_invoice_scope_fk" FOREIGN KEY ("invoice_id","organization_id","project_id") REFERENCES "app"."invoices"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_number_unique" ON "app"."invoices" USING btree ("organization_id","project_id","direction","invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_id_scope_unique" ON "app"."invoices" USING btree ("id","organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_application_unique" ON "app"."invoices" USING btree ("payment_application_id") WHERE "app"."invoices"."payment_application_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_project_status_date_idx" ON "app"."invoices" USING btree ("organization_id","project_id","status","invoice_date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_invoice_status_idx" ON "app"."payments" USING btree ("organization_id","project_id","invoice_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_project_created_id_idx" ON "app"."payments" USING btree ("organization_id","project_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_id_scope_unique" ON "app"."payments" USING btree ("id","organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_id_scope_unique" ON "app"."purchase_orders" USING btree ("id","organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_id_org_unique" ON "app"."suppliers" USING btree ("id","organization_id");