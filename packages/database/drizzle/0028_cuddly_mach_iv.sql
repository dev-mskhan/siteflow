CREATE TABLE IF NOT EXISTS "app"."commercial_idempotency_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"operation" text NOT NULL,
	"key_hash" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_body" jsonb,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commercial_idempotency_operation_length" CHECK (char_length("app"."commercial_idempotency_keys"."operation") BETWEEN 1 AND 128),
	CONSTRAINT "commercial_idempotency_key_hash_length" CHECK (char_length("app"."commercial_idempotency_keys"."key_hash") = 64),
	CONSTRAINT "commercial_idempotency_request_hash_length" CHECK (char_length("app"."commercial_idempotency_keys"."request_hash") = 64)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."financial_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"previous_state" jsonb,
	"new_state" jsonb,
	"amount" numeric(15, 2),
	"currency_code" text,
	"reason" text,
	"request_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_audit_currency_length" CHECK ("app"."financial_audit_events"."currency_code" IS NULL OR char_length("app"."financial_audit_events"."currency_code") = 3),
	CONSTRAINT "financial_audit_amount_requires_currency" CHECK ("app"."financial_audit_events"."amount" IS NULL OR "app"."financial_audit_events"."currency_code" IS NOT NULL)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."commercial_idempotency_keys" ADD CONSTRAINT "commercial_idempotency_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."financial_audit_events" ADD CONSTRAINT "financial_audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."financial_audit_events" ADD CONSTRAINT "financial_audit_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."financial_audit_events" ADD CONSTRAINT "financial_audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "commercial_idempotency_scope_unique" ON "app"."commercial_idempotency_keys" USING btree ("organization_id","operation","key_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commercial_idempotency_created_idx" ON "app"."commercial_idempotency_keys" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_audit_org_project_created_idx" ON "app"."financial_audit_events" USING btree ("organization_id","project_id","created_at","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_audit_entity_idx" ON "app"."financial_audit_events" USING btree ("organization_id","project_id","entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_audit_actor_idx" ON "app"."financial_audit_events" USING btree ("actor_user_id","created_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.prevent_financial_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'financial audit events are append-only'
    USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER financial_audit_events_no_update_delete
BEFORE UPDATE OR DELETE ON app.financial_audit_events
FOR EACH ROW EXECUTE FUNCTION app.prevent_financial_audit_event_mutation();
--> statement-breakpoint
CREATE TRIGGER financial_audit_events_no_truncate
BEFORE TRUNCATE ON app.financial_audit_events
FOR EACH STATEMENT EXECUTE FUNCTION app.prevent_financial_audit_event_mutation();