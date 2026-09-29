CREATE TYPE "app"."committed_cost_source_type" AS ENUM('PURCHASE_ORDER');--> statement-breakpoint
CREATE TYPE "app"."committed_cost_status" AS ENUM('ACTIVE', 'RELEASED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "app"."procurement_approval_resource_type" AS ENUM('MATERIAL_REQUEST', 'QUOTE', 'PURCHASE_ORDER');--> statement-breakpoint
CREATE TYPE "app"."procurement_approval_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "app"."purchase_order_status" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED', 'CLOSED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."committed_costs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"source_type" "app"."committed_cost_source_type" NOT NULL,
	"source_id" text NOT NULL,
	"supplier_id" text,
	"purchase_order_id" text,
	"cost_code_id" text,
	"task_id" text,
	"boq_line_id" text,
	"currency_code" text NOT NULL,
	"committed_amount" numeric(15, 2) NOT NULL,
	"status" "app"."committed_cost_status" DEFAULT 'ACTIVE' NOT NULL,
	"committed_at" timestamp with time zone NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."procurement_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"resource_type" "app"."procurement_approval_resource_type" NOT NULL,
	"resource_id" text NOT NULL,
	"status" "app"."procurement_approval_status" DEFAULT 'PENDING' NOT NULL,
	"requested_by" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"decision_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."purchase_order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"purchase_order_id" text NOT NULL,
	"material_id" text NOT NULL,
	"description" text,
	"quantity" numeric(15, 3) NOT NULL,
	"unit_code" text NOT NULL,
	"unit_price" numeric(15, 2) NOT NULL,
	"discount_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"line_subtotal" numeric(15, 2) NOT NULL,
	"line_total" numeric(15, 2) NOT NULL,
	"material_request_item_id" text,
	"source_quote_item_id" text,
	"task_id" text,
	"phase_id" text,
	"cost_code_id" text,
	"boq_line_id" text,
	"expected_delivery_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "po_items_qty_gt_0" CHECK ("app"."purchase_order_items"."quantity" > 0),
	CONSTRAINT "po_items_unit_price_gte_0" CHECK ("app"."purchase_order_items"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."purchase_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"po_number" text NOT NULL,
	"supplier_id" text NOT NULL,
	"material_request_id" text,
	"source_quote_id" text,
	"status" "app"."purchase_order_status" DEFAULT 'DRAFT' NOT NULL,
	"order_date" date NOT NULL,
	"expected_delivery_date" date,
	"delivery_location" text,
	"currency_code" text NOT NULL,
	"subtotal" numeric(15, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_by_member_id" text,
	"approved_at" timestamp with time zone,
	"approved_by" text,
	"sent_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_amounts_gte_0" CHECK ("app"."purchase_orders"."subtotal" >= 0 AND "app"."purchase_orders"."tax_amount" >= 0 AND "app"."purchase_orders"."discount_amount" >= 0 AND "app"."purchase_orders"."total_amount" >= 0),
	CONSTRAINT "purchase_orders_delivery_date" CHECK ("app"."purchase_orders"."expected_delivery_date" IS NULL OR "app"."purchase_orders"."expected_delivery_date" >= "app"."purchase_orders"."order_date")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."committed_costs" ADD CONSTRAINT "committed_costs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."committed_costs" ADD CONSTRAINT "committed_costs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."committed_costs" ADD CONSTRAINT "committed_costs_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "app"."suppliers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."committed_costs" ADD CONSTRAINT "committed_costs_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "app"."purchase_orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."committed_costs" ADD CONSTRAINT "committed_costs_cost_code_id_project_cost_codes_id_fk" FOREIGN KEY ("cost_code_id") REFERENCES "app"."project_cost_codes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."committed_costs" ADD CONSTRAINT "committed_costs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "app"."tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."procurement_approvals" ADD CONSTRAINT "procurement_approvals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."procurement_approvals" ADD CONSTRAINT "procurement_approvals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."procurement_approvals" ADD CONSTRAINT "procurement_approvals_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."procurement_approvals" ADD CONSTRAINT "procurement_approvals_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "app"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "app"."materials"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_material_request_item_id_material_request_items_id_fk" FOREIGN KEY ("material_request_item_id") REFERENCES "app"."material_request_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_source_quote_item_id_quote_items_id_fk" FOREIGN KEY ("source_quote_item_id") REFERENCES "app"."quote_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "app"."tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_phase_id_project_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "app"."project_phases"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_cost_code_id_project_cost_codes_id_fk" FOREIGN KEY ("cost_code_id") REFERENCES "app"."project_cost_codes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."purchase_orders" ADD CONSTRAINT "purchase_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."purchase_orders" ADD CONSTRAINT "purchase_orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "app"."suppliers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."purchase_orders" ADD CONSTRAINT "purchase_orders_material_request_id_material_requests_id_fk" FOREIGN KEY ("material_request_id") REFERENCES "app"."material_requests"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."purchase_orders" ADD CONSTRAINT "purchase_orders_source_quote_id_quotes_id_fk" FOREIGN KEY ("source_quote_id") REFERENCES "app"."quotes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_member_id_project_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "app"."project_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "committed_costs_source_unique" ON "app"."committed_costs" USING btree ("organization_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "committed_costs_project_idx" ON "app"."committed_costs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "committed_costs_org_project_idx" ON "app"."committed_costs" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "procurement_approvals_resource_idx" ON "app"."procurement_approvals" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "procurement_approvals_project_status_idx" ON "app"."procurement_approvals" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "po_items_po_idx" ON "app"."purchase_order_items" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "po_items_material_idx" ON "app"."purchase_order_items" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "po_items_task_idx" ON "app"."purchase_order_items" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_num_unique" ON "app"."purchase_orders" USING btree ("project_id","po_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_orders_project_status_created_idx" ON "app"."purchase_orders" USING btree ("project_id","status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_orders_supplier_idx" ON "app"."purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_orders_org_project_idx" ON "app"."purchase_orders" USING btree ("organization_id","project_id");

--> statement-breakpoint
CREATE UNIQUE INDEX procurement_approvals_pending_unique
  ON app.procurement_approvals(resource_type, resource_id)
  WHERE status = 'PENDING';
