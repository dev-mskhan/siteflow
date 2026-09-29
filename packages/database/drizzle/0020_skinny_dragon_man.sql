CREATE TYPE "app"."delivery_status" AS ENUM('SCHEDULED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "app"."inventory_transaction_source_type" AS ENUM('RECEIPT', 'FIELD_LOG', 'ADJUSTMENT', 'TRANSFER', 'MANUAL');--> statement-breakpoint
CREATE TYPE "app"."inventory_transaction_type" AS ENUM('RECEIPT', 'ISSUE', 'CONSUMPTION', 'RETURN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT');--> statement-breakpoint
CREATE TYPE "app"."partner_performance_event_type" AS ENUM('DELIVERY_ON_TIME', 'DELIVERY_LATE', 'DELIVERY_PARTIAL', 'DELIVERY_CANCELLED', 'RECEIPT_REJECTION', 'RECEIPT_DISCREPANCY', 'PO_CANCELLED', 'WORK_COMPLETED', 'WORK_COMPLETED_LATE', 'WORK_DELAYED', 'SCOPE_CHANGE', 'QUALITY_ISSUE');--> statement-breakpoint
CREATE TYPE "app"."partner_type" AS ENUM('SUPPLIER', 'SUBCONTRACTOR');--> statement-breakpoint
CREATE TYPE "app"."receipt_status" AS ENUM('DRAFT', 'POSTED', 'VOIDED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"purchase_order_id" text NOT NULL,
	"delivery_number" text NOT NULL,
	"status" "app"."delivery_status" DEFAULT 'SCHEDULED' NOT NULL,
	"scheduled_date" date,
	"actual_delivery_date" date,
	"supplier_reference" text,
	"carrier" text,
	"tracking_reference" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."delivery_items" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"delivery_id" text NOT NULL,
	"purchase_order_item_id" text NOT NULL,
	"quantity" numeric(15, 3) NOT NULL,
	"unit_code" text NOT NULL,
	"notes" text,
	CONSTRAINT "delivery_items_qty_gt_0" CHECK ("app"."delivery_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."inventory_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"inventory_item_id" text NOT NULL,
	"material_id" text NOT NULL,
	"transaction_type" "app"."inventory_transaction_type" NOT NULL,
	"quantity" numeric(15, 3) NOT NULL,
	"unit_code" text NOT NULL,
	"source_type" "app"."inventory_transaction_source_type" NOT NULL,
	"source_id" text NOT NULL,
	"transfer_id" text,
	"reversal_of_transaction_id" text,
	"task_id" text,
	"cost_code_id" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_by_member_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inv_tx_qty_gt_0" CHECK ("app"."inventory_transactions"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."inventory_transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"material_id" text NOT NULL,
	"quantity" numeric(15, 3) NOT NULL,
	"unit_code" text NOT NULL,
	"from_location" text NOT NULL,
	"to_location" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_by_member_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inv_transfers_different_locations" CHECK ("app"."inventory_transfers"."from_location" != "app"."inventory_transfers"."to_location"),
	CONSTRAINT "inv_transfers_qty_gt_0" CHECK ("app"."inventory_transfers"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."partner_performance_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text,
	"partner_type" "app"."partner_type" NOT NULL,
	"supplier_id" text,
	"subcontractor_id" text,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"event_type" "app"."partner_performance_event_type" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"metric_value" numeric(10, 2),
	"unit" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."project_inventory_items" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"material_id" text NOT NULL,
	"location" text DEFAULT 'default' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."receipt_items" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"receipt_id" text NOT NULL,
	"purchase_order_item_id" text NOT NULL,
	"quantity_delivered" numeric(15, 3) NOT NULL,
	"quantity_accepted" numeric(15, 3) NOT NULL,
	"quantity_rejected" numeric(15, 3) DEFAULT '0' NOT NULL,
	"unit_code" text NOT NULL,
	"rejection_reason" text,
	"condition" text,
	"notes" text,
	CONSTRAINT "receipt_items_qty_delivered_gte_0" CHECK ("app"."receipt_items"."quantity_delivered" >= 0),
	CONSTRAINT "receipt_items_qty_accepted_gte_0" CHECK ("app"."receipt_items"."quantity_accepted" >= 0),
	CONSTRAINT "receipt_items_qty_rejected_gte_0" CHECK ("app"."receipt_items"."quantity_rejected" >= 0),
	CONSTRAINT "receipt_items_accepted_plus_rejected" CHECK ("app"."receipt_items"."quantity_accepted" + "app"."receipt_items"."quantity_rejected" <= "app"."receipt_items"."quantity_delivered")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"purchase_order_id" text NOT NULL,
	"delivery_id" text,
	"receipt_number" text NOT NULL,
	"status" "app"."receipt_status" DEFAULT 'DRAFT' NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"received_by_member_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."deliveries" ADD CONSTRAINT "deliveries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."deliveries" ADD CONSTRAINT "deliveries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."deliveries" ADD CONSTRAINT "deliveries_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "app"."purchase_orders"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."delivery_items" ADD CONSTRAINT "delivery_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."delivery_items" ADD CONSTRAINT "delivery_items_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "app"."deliveries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."delivery_items" ADD CONSTRAINT "delivery_items_purchase_order_item_id_purchase_order_items_id_fk" FOREIGN KEY ("purchase_order_item_id") REFERENCES "app"."purchase_order_items"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_inventory_item_id_project_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "app"."project_inventory_items"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "app"."materials"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_transfer_id_inventory_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "app"."inventory_transfers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "app"."tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_cost_code_id_project_cost_codes_id_fk" FOREIGN KEY ("cost_code_id") REFERENCES "app"."project_cost_codes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_created_by_member_id_project_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "app"."project_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."inventory_transfers" ADD CONSTRAINT "inventory_transfers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."inventory_transfers" ADD CONSTRAINT "inventory_transfers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."inventory_transfers" ADD CONSTRAINT "inventory_transfers_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "app"."materials"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."inventory_transfers" ADD CONSTRAINT "inventory_transfers_created_by_member_id_project_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "app"."project_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."partner_performance_events" ADD CONSTRAINT "partner_performance_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."partner_performance_events" ADD CONSTRAINT "partner_performance_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."partner_performance_events" ADD CONSTRAINT "partner_performance_events_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "app"."suppliers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."partner_performance_events" ADD CONSTRAINT "partner_performance_events_subcontractor_id_subcontractors_id_fk" FOREIGN KEY ("subcontractor_id") REFERENCES "app"."subcontractors"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."project_inventory_items" ADD CONSTRAINT "project_inventory_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."project_inventory_items" ADD CONSTRAINT "project_inventory_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."project_inventory_items" ADD CONSTRAINT "project_inventory_items_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "app"."materials"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."receipt_items" ADD CONSTRAINT "receipt_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."receipt_items" ADD CONSTRAINT "receipt_items_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "app"."receipts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."receipt_items" ADD CONSTRAINT "receipt_items_purchase_order_item_id_purchase_order_items_id_fk" FOREIGN KEY ("purchase_order_item_id") REFERENCES "app"."purchase_order_items"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."receipts" ADD CONSTRAINT "receipts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."receipts" ADD CONSTRAINT "receipts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."receipts" ADD CONSTRAINT "receipts_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "app"."purchase_orders"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."receipts" ADD CONSTRAINT "receipts_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "app"."deliveries"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."receipts" ADD CONSTRAINT "receipts_received_by_member_id_project_members_id_fk" FOREIGN KEY ("received_by_member_id") REFERENCES "app"."project_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deliveries_num_unique" ON "app"."deliveries" USING btree ("project_id","delivery_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deliveries_po_idx" ON "app"."deliveries" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deliveries_project_status_scheduled_idx" ON "app"."deliveries" USING btree ("project_id","status","scheduled_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_items_delivery_idx" ON "app"."delivery_items" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inv_tx_project_material_idx" ON "app"."inventory_transactions" USING btree ("project_id","material_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inv_tx_org_project_idx" ON "app"."inventory_transactions" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inv_tx_source_idx" ON "app"."inventory_transactions" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inv_tx_task_idx" ON "app"."inventory_transactions" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inv_tx_transfer_idx" ON "app"."inventory_transactions" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inv_transfers_project_idx" ON "app"."inventory_transfers" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "partner_perf_events_source_unique" ON "app"."partner_performance_events" USING btree ("source_type","source_id","event_type","supplier_id","subcontractor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partner_perf_events_supplier_idx" ON "app"."partner_performance_events" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partner_perf_events_sub_idx" ON "app"."partner_performance_events" USING btree ("subcontractor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partner_perf_events_project_idx" ON "app"."partner_performance_events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partner_perf_events_source_idx" ON "app"."partner_performance_events" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_inventory_items_unique" ON "app"."project_inventory_items" USING btree ("project_id","material_id","location");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_inventory_items_project_idx" ON "app"."project_inventory_items" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "receipt_items_receipt_idx" ON "app"."receipt_items" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "receipt_items_po_item_idx" ON "app"."receipt_items" USING btree ("purchase_order_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "receipts_num_unique" ON "app"."receipts" USING btree ("project_id","receipt_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "receipts_po_idx" ON "app"."receipts" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "receipts_project_status_idx" ON "app"."receipts" USING btree ("project_id","status");