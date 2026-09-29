CREATE TYPE "app"."material_request_priority" AS ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TYPE "app"."material_request_status" AS ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_ORDERED', 'ORDERED', 'FULFILLED', 'CANCELLED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "app"."quote_status" AS ENUM('DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."document_number_allocators" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text,
	"series" text NOT NULL,
	"period" text NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."material_request_items" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"material_request_id" text NOT NULL,
	"material_id" text NOT NULL,
	"description" text,
	"quantity" numeric(15, 3) NOT NULL,
	"unit_code" text NOT NULL,
	"required_by_date" date,
	"task_id" text,
	"phase_id" text,
	"cost_code_id" text,
	"boq_line_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mat_req_items_qty_gt_0" CHECK ("app"."material_request_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."material_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"request_number" text NOT NULL,
	"requested_by_member_id" text,
	"status" "app"."material_request_status" DEFAULT 'DRAFT' NOT NULL,
	"required_by_date" date,
	"delivery_location" text,
	"priority" "app"."material_request_priority" DEFAULT 'NORMAL' NOT NULL,
	"notes" text,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."quote_items" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"quote_id" text NOT NULL,
	"material_request_item_id" text,
	"material_id" text NOT NULL,
	"description" text,
	"quantity" numeric(15, 3) NOT NULL,
	"unit_code" text NOT NULL,
	"unit_price" numeric(15, 2) NOT NULL,
	"discount_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"line_subtotal" numeric(15, 2) NOT NULL,
	"line_total" numeric(15, 2) NOT NULL,
	"expected_delivery_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_items_qty_gt_0" CHECK ("app"."quote_items"."quantity" > 0),
	CONSTRAINT "quote_items_unit_price_gte_0" CHECK ("app"."quote_items"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"quote_number" text NOT NULL,
	"supplier_id" text NOT NULL,
	"material_request_id" text,
	"status" "app"."quote_status" DEFAULT 'DRAFT' NOT NULL,
	"quote_date" date NOT NULL,
	"valid_until" date,
	"currency_code" text NOT NULL,
	"subtotal" numeric(15, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"submitted_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_amounts_gte_0" CHECK ("app"."quotes"."subtotal" >= 0 AND "app"."quotes"."tax_amount" >= 0 AND "app"."quotes"."discount_amount" >= 0 AND "app"."quotes"."total_amount" >= 0),
	CONSTRAINT "quotes_valid_until" CHECK ("app"."quotes"."valid_until" IS NULL OR "app"."quotes"."valid_until" >= "app"."quotes"."quote_date")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."document_number_allocators" ADD CONSTRAINT "document_number_allocators_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."document_number_allocators" ADD CONSTRAINT "document_number_allocators_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."material_request_items" ADD CONSTRAINT "material_request_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."material_request_items" ADD CONSTRAINT "material_request_items_material_request_id_material_requests_id_fk" FOREIGN KEY ("material_request_id") REFERENCES "app"."material_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."material_request_items" ADD CONSTRAINT "material_request_items_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "app"."materials"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."material_request_items" ADD CONSTRAINT "material_request_items_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "app"."tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."material_request_items" ADD CONSTRAINT "material_request_items_phase_id_project_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "app"."project_phases"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."material_request_items" ADD CONSTRAINT "material_request_items_cost_code_id_project_cost_codes_id_fk" FOREIGN KEY ("cost_code_id") REFERENCES "app"."project_cost_codes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."material_requests" ADD CONSTRAINT "material_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."material_requests" ADD CONSTRAINT "material_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."material_requests" ADD CONSTRAINT "material_requests_requested_by_member_id_project_members_id_fk" FOREIGN KEY ("requested_by_member_id") REFERENCES "app"."project_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."quote_items" ADD CONSTRAINT "quote_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."quote_items" ADD CONSTRAINT "quote_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "app"."quotes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."quote_items" ADD CONSTRAINT "quote_items_material_request_item_id_material_request_items_id_fk" FOREIGN KEY ("material_request_item_id") REFERENCES "app"."material_request_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."quote_items" ADD CONSTRAINT "quote_items_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "app"."materials"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."quotes" ADD CONSTRAINT "quotes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."quotes" ADD CONSTRAINT "quotes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."quotes" ADD CONSTRAINT "quotes_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "app"."suppliers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."quotes" ADD CONSTRAINT "quotes_material_request_id_material_requests_id_fk" FOREIGN KEY ("material_request_id") REFERENCES "app"."material_requests"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_num_allocator_org_series_idx" ON "app"."document_number_allocators" USING btree ("organization_id","series","period");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mat_req_items_request_idx" ON "app"."material_request_items" USING btree ("material_request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mat_req_items_task_idx" ON "app"."material_request_items" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "material_requests_num_unique" ON "app"."material_requests" USING btree ("project_id","request_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "material_requests_project_status_created_idx" ON "app"."material_requests" USING btree ("project_id","status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "material_requests_org_project_idx" ON "app"."material_requests" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quote_items_quote_idx" ON "app"."quote_items" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quotes_num_unique" ON "app"."quotes" USING btree ("project_id","quote_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_project_status_idx" ON "app"."quotes" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_supplier_idx" ON "app"."quotes" USING btree ("supplier_id");

--> statement-breakpoint
CREATE UNIQUE INDEX doc_num_allocator_proj_unique
  ON app.document_number_allocators(organization_id, project_id, series, period)
  WHERE project_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX doc_num_allocator_org_unique
  ON app.document_number_allocators(organization_id, series, period)
  WHERE project_id IS NULL;
