CREATE TABLE IF NOT EXISTS "app"."field_log_amendments" (
	"id" text PRIMARY KEY NOT NULL,
	"log_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"requested_by" text NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"reason" text NOT NULL,
	"correction" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."field_log_amendments" ADD CONSTRAINT "field_log_amendments_log_id_daily_field_logs_id_fk" FOREIGN KEY ("log_id") REFERENCES "app"."daily_field_logs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."field_log_amendments" ADD CONSTRAINT "field_log_amendments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."field_log_amendments" ADD CONSTRAINT "field_log_amendments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."field_log_amendments" ADD CONSTRAINT "field_log_amendments_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."field_log_amendments" ADD CONSTRAINT "field_log_amendments_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "field_log_amendments_log_idx" ON "app"."field_log_amendments" USING btree ("log_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "field_log_amendments_org_project_idx" ON "app"."field_log_amendments" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "field_log_amendments_requested_by_idx" ON "app"."field_log_amendments" USING btree ("requested_by");