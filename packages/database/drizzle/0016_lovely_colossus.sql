CREATE TYPE "app"."supplier_status" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "app"."supplier_type" AS ENUM('MATERIAL_SUPPLIER', 'SERVICE_PROVIDER', 'EQUIPMENT_SUPPLIER', 'GENERAL_SUPPLIER');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."supplier_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"supplier_id" text NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"email" text,
	"phone" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"supplier_code" text NOT NULL,
	"legal_name" text NOT NULL,
	"display_name" text NOT NULL,
	"supplier_type" "app"."supplier_type" DEFAULT 'GENERAL_SUPPLIER' NOT NULL,
	"status" "app"."supplier_status" DEFAULT 'ACTIVE' NOT NULL,
	"tax_reference" text,
	"email" text,
	"phone" text,
	"address" text,
	"website" text,
	"payment_terms" text,
	"currency_code" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."supplier_contacts" ADD CONSTRAINT "supplier_contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."supplier_contacts" ADD CONSTRAINT "supplier_contacts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "app"."suppliers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."suppliers" ADD CONSTRAINT "suppliers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_contacts_supplier_idx" ON "app"."supplier_contacts" USING btree ("supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_org_code_unique" ON "app"."suppliers" USING btree ("organization_id","supplier_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suppliers_org_idx" ON "app"."suppliers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suppliers_org_status_idx" ON "app"."suppliers" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_contacts_primary_unique" ON "app"."supplier_contacts" ("supplier_id") WHERE is_primary = true;
