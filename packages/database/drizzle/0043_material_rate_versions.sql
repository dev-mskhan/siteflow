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
ALTER TABLE "app"."material_rate_versions" ADD CONSTRAINT "material_rate_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."material_rate_versions" ADD CONSTRAINT "material_rate_versions_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "app"."materials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."material_rate_versions" ADD CONSTRAINT "material_rate_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."material_rate_versions" ADD CONSTRAINT "material_rate_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."material_rate_versions" ADD CONSTRAINT "material_rate_versions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "material_rate_versions_version_unique" ON "app"."material_rate_versions" USING btree ("organization_id","material_id","scope","project_id","version_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "material_rate_versions_lookup_idx" ON "app"."material_rate_versions" USING btree ("organization_id","material_id","scope","status");
