CREATE TYPE "app"."material_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "app"."material_type" AS ENUM('MATERIAL', 'EQUIPMENT', 'CONSUMABLE', 'SERVICE', 'OTHER');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."materials" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"material_code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"default_unit_code" text NOT NULL,
	"material_type" "app"."material_type" DEFAULT 'MATERIAL' NOT NULL,
	"status" "app"."material_status" DEFAULT 'ACTIVE' NOT NULL,
	"default_tax_code" text,
	"default_currency_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."materials" ADD CONSTRAINT "materials_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "materials_org_code_unique" ON "app"."materials" USING btree ("organization_id","material_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "materials_org_idx" ON "app"."materials" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "materials_org_status_idx" ON "app"."materials" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "materials_org_category_idx" ON "app"."materials" USING btree ("organization_id","category");