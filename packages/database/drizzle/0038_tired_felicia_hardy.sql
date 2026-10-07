CREATE TABLE IF NOT EXISTS "app"."retainage_records" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"payment_application_line_id" text NOT NULL,
	"currency_code" text NOT NULL,
	"retainage_percent" numeric(5, 2) NOT NULL,
	"accrued_amount" numeric(15, 2) NOT NULL,
	"released_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"remaining_amount" numeric(15, 2) NOT NULL,
	"status" text DEFAULT 'HELD' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retainage_records_currency_check" CHECK ("app"."retainage_records"."currency_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "retainage_records_percent_check" CHECK ("app"."retainage_records"."retainage_percent" BETWEEN 0 AND 100),
	CONSTRAINT "retainage_records_amounts_check" CHECK ("app"."retainage_records"."accrued_amount" > 0 AND "app"."retainage_records"."released_amount" >= 0 AND "app"."retainage_records"."remaining_amount" >= 0 AND "app"."retainage_records"."accrued_amount" = "app"."retainage_records"."released_amount" + "app"."retainage_records"."remaining_amount"),
	CONSTRAINT "retainage_records_status_check" CHECK ("app"."retainage_records"."status" IN ('HELD', 'PARTIALLY_RELEASED', 'RELEASED')),
	CONSTRAINT "retainage_records_status_balance_check" CHECK (("app"."retainage_records"."status" = 'HELD' AND "app"."retainage_records"."released_amount" = 0) OR ("app"."retainage_records"."status" = 'PARTIALLY_RELEASED' AND "app"."retainage_records"."released_amount" > 0 AND "app"."retainage_records"."remaining_amount" > 0) OR ("app"."retainage_records"."status" = 'RELEASED' AND "app"."retainage_records"."remaining_amount" = 0)),
	CONSTRAINT "retainage_records_version_check" CHECK ("app"."retainage_records"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."retainage_releases" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"retainage_record_id" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"reason" text NOT NULL,
	"released_by" text NOT NULL,
	"idempotency_reference" text NOT NULL,
	"released_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retainage_releases_amount_positive" CHECK ("app"."retainage_releases"."amount" > 0),
	CONSTRAINT "retainage_releases_reason_nonempty" CHECK (length(trim("app"."retainage_releases"."reason")) > 0),
	CONSTRAINT "retainage_releases_idempotency_nonempty" CHECK (length(trim("app"."retainage_releases"."idempotency_reference")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_application_lines_id_scope_unique" ON "app"."payment_application_lines" USING btree ("id","organization_id","project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "retainage_records_id_scope_unique" ON "app"."retainage_records" USING btree ("id","organization_id","project_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."retainage_records" ADD CONSTRAINT "retainage_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."retainage_records" ADD CONSTRAINT "retainage_records_project_org_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "app"."projects"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."retainage_records" ADD CONSTRAINT "retainage_records_application_line_scope_fk" FOREIGN KEY ("payment_application_line_id","organization_id","project_id") REFERENCES "app"."payment_application_lines"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."retainage_releases" ADD CONSTRAINT "retainage_releases_released_by_users_id_fk" FOREIGN KEY ("released_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."retainage_releases" ADD CONSTRAINT "retainage_releases_project_org_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "app"."projects"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."retainage_releases" ADD CONSTRAINT "retainage_releases_record_scope_fk" FOREIGN KEY ("retainage_record_id","organization_id","project_id") REFERENCES "app"."retainage_records"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "retainage_records_line_unique" ON "app"."retainage_records" USING btree ("payment_application_line_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "retainage_records_project_status_idx" ON "app"."retainage_records" USING btree ("organization_id","project_id","status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "retainage_releases_idempotency_unique" ON "app"."retainage_releases" USING btree ("organization_id","idempotency_reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "retainage_releases_record_created_idx" ON "app"."retainage_releases" USING btree ("organization_id","project_id","retainage_record_id","released_at","id");--> statement-breakpoint
CREATE FUNCTION "app"."prevent_retainage_release_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'retainage release history is append-only';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "retainage_releases_append_only"
BEFORE UPDATE OR DELETE ON "app"."retainage_releases"
FOR EACH ROW EXECUTE FUNCTION "app"."prevent_retainage_release_mutation"();