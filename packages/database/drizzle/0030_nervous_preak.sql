CREATE TABLE IF NOT EXISTS "app"."project_budget_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"revision_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"cost_code_id" text NOT NULL,
	"phase_id" text,
	"line_number" integer NOT NULL,
	"description" text,
	"amount" numeric(15, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_budget_lines_line_number_positive" CHECK ("app"."project_budget_lines"."line_number" > 0),
	CONSTRAINT "project_budget_lines_amount_nonnegative" CHECK ("app"."project_budget_lines"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."project_budget_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"budget_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"created_by" text NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp with time zone,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_budget_revisions_status_check" CHECK ("app"."project_budget_revisions"."status" IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SUPERSEDED', 'CLOSED')),
	CONSTRAINT "project_budget_revisions_number_positive" CHECK ("app"."project_budget_revisions"."revision_number" > 0),
	CONSTRAINT "project_budget_revisions_approval_metadata_check" CHECK ("app"."project_budget_revisions"."status" NOT IN ('APPROVED', 'SUPERSEDED', 'CLOSED') OR ("app"."project_budget_revisions"."approved_by" IS NOT NULL AND "app"."project_budget_revisions"."approved_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."project_budgets" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"currency_code" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"current_revision_number" integer DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp with time zone,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_budgets_status_check" CHECK ("app"."project_budgets"."status" IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SUPERSEDED', 'CLOSED')),
	CONSTRAINT "project_budgets_currency_check" CHECK ("app"."project_budgets"."currency_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "project_budgets_revision_positive" CHECK ("app"."project_budgets"."current_revision_number" > 0),
	CONSTRAINT "project_budgets_version_positive" CHECK ("app"."project_budgets"."version" > 0),
	CONSTRAINT "project_budgets_approval_metadata_check" CHECK (("app"."project_budgets"."status" NOT IN ('APPROVED', 'SUPERSEDED', 'CLOSED')) OR ("app"."project_budgets"."approved_by" IS NOT NULL AND "app"."project_budgets"."approved_at" IS NOT NULL)),
	CONSTRAINT "project_budgets_closed_metadata_check" CHECK ("app"."project_budgets"."status" <> 'CLOSED' OR "app"."project_budgets"."closed_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_budgets_id_org_project_unique" ON "app"."project_budgets" USING btree ("id","organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_budget_revisions_id_scope_unique" ON "app"."project_budget_revisions" USING btree ("id","organization_id","project_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."project_budget_lines" ADD CONSTRAINT "project_budget_lines_cost_code_id_project_cost_codes_id_fk" FOREIGN KEY ("cost_code_id") REFERENCES "app"."project_cost_codes"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."project_budget_lines" ADD CONSTRAINT "project_budget_lines_phase_id_project_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "app"."project_phases"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."project_budget_lines" ADD CONSTRAINT "project_budget_lines_revision_scope_fk" FOREIGN KEY ("revision_id","organization_id","project_id") REFERENCES "app"."project_budget_revisions"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."project_budget_revisions" ADD CONSTRAINT "project_budget_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."project_budget_revisions" ADD CONSTRAINT "project_budget_revisions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."project_budget_revisions" ADD CONSTRAINT "project_budget_revisions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."project_budget_revisions" ADD CONSTRAINT "project_budget_revisions_budget_scope_fk" FOREIGN KEY ("budget_id","organization_id","project_id") REFERENCES "app"."project_budgets"("id","organization_id","project_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."project_budgets" ADD CONSTRAINT "project_budgets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."project_budgets" ADD CONSTRAINT "project_budgets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."project_budgets" ADD CONSTRAINT "project_budgets_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."project_budgets" ADD CONSTRAINT "project_budgets_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."project_budgets" ADD CONSTRAINT "project_budgets_project_org_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "app"."projects"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_budget_lines_revision_line_unique" ON "app"."project_budget_lines" USING btree ("revision_id","line_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_budget_lines_org_project_cost_code_idx" ON "app"."project_budget_lines" USING btree ("organization_id","project_id","cost_code_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_budget_lines_org_project_phase_idx" ON "app"."project_budget_lines" USING btree ("organization_id","project_id","phase_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_budget_revisions_number_unique" ON "app"."project_budget_revisions" USING btree ("budget_id","revision_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_budget_revisions_project_status_idx" ON "app"."project_budget_revisions" USING btree ("organization_id","project_id","status","revision_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_budgets_project_unique" ON "app"."project_budgets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_budgets_org_project_status_idx" ON "app"."project_budgets" USING btree ("organization_id","project_id","status");--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.prevent_non_draft_budget_line_changes() RETURNS trigger AS $$
DECLARE
  budget_status text;
  revision_id text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.revision_id IS DISTINCT FROM OLD.revision_id THEN
    RAISE EXCEPTION 'budget lines cannot be moved between revisions';
  END IF;

  revision_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.revision_id ELSE NEW.revision_id END;
  SELECT status INTO budget_status
  FROM app.project_budget_revisions
  WHERE id = revision_id
  FOR UPDATE;

  IF budget_status IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'lines for a non-draft budget revision are immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER project_budget_lines_draft_only
BEFORE INSERT OR UPDATE OR DELETE ON app.project_budget_lines
FOR EACH ROW EXECUTE FUNCTION app.prevent_non_draft_budget_line_changes();--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.prevent_approved_budget_revision_rewrite() RETURNS trigger AS $$
BEGIN
  IF OLD.status IN ('APPROVED', 'SUPERSEDED', 'CLOSED') AND (
    NEW.budget_id IS DISTINCT FROM OLD.budget_id OR
    NEW.organization_id IS DISTINCT FROM OLD.organization_id OR
    NEW.project_id IS DISTINCT FROM OLD.project_id OR
    NEW.revision_number IS DISTINCT FROM OLD.revision_number OR
    NEW.created_by IS DISTINCT FROM OLD.created_by OR
    NEW.created_at IS DISTINCT FROM OLD.created_at OR
    NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR
    NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
    NEW.approved_by IS DISTINCT FROM OLD.approved_by OR
    NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
    (NEW.status IS DISTINCT FROM OLD.status AND NOT (
      OLD.status = 'APPROVED' AND NEW.status IN ('SUPERSEDED', 'CLOSED')
    ))
  ) THEN
    RAISE EXCEPTION 'approved budget revision history is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER project_budget_revision_history_immutable
BEFORE UPDATE OR DELETE ON app.project_budget_revisions
FOR EACH ROW EXECUTE FUNCTION app.prevent_approved_budget_revision_rewrite();