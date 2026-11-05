CREATE EXTENSION IF NOT EXISTS "vector";--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."agent_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text,
	"created_by" text NOT NULL,
	"agent" text NOT NULL,
	"title" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."agent_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"channel" text NOT NULL,
	"content" text NOT NULL,
	"run_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."knowledge_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"document_id" text NOT NULL,
	"document_version_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"page_reference" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_chunks_status_check" CHECK ("app"."knowledge_chunks"."status" IN ('ACTIVE', 'SUPERSEDED')),
	CONSTRAINT "knowledge_chunks_version_positive" CHECK ("app"."knowledge_chunks"."version_number" > 0),
	CONSTRAINT "knowledge_chunks_chunk_nonneg" CHECK ("app"."knowledge_chunks"."chunk_index" >= 0)
);
--> statement-breakpoint
ALTER TABLE "app"."agent_approvals" ADD COLUMN IF NOT EXISTS "approved_tool_name" text;--> statement-breakpoint
ALTER TABLE "app"."agent_approvals" ADD COLUMN IF NOT EXISTS "approved_args_hash" text;--> statement-breakpoint
ALTER TABLE "app"."agent_runs" ADD COLUMN IF NOT EXISTS "provider" text;--> statement-breakpoint
ALTER TABLE "app"."agent_runs" ADD COLUMN IF NOT EXISTS "model" text;--> statement-breakpoint
ALTER TABLE "app"."agent_runs" ADD COLUMN IF NOT EXISTS "channel" text;--> statement-breakpoint
ALTER TABLE "app"."agent_runs" ADD COLUMN IF NOT EXISTS "conversation_id" text;--> statement-breakpoint
ALTER TABLE "app"."agent_runs" ADD COLUMN IF NOT EXISTS "parent_run_id" text;--> statement-breakpoint
ALTER TABLE "app"."agent_runs" ADD COLUMN IF NOT EXISTS "prompt_version" text;--> statement-breakpoint
ALTER TABLE "app"."notifications" ADD COLUMN IF NOT EXISTS "read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."saas_reminder_deliveries" ADD COLUMN IF NOT EXISTS "suppressed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_conversations_org_idx" ON "app"."agent_conversations" USING btree ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_conversations_user_idx" ON "app"."agent_conversations" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_conversations_project_idx" ON "app"."agent_conversations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_messages_conv_idx" ON "app"."agent_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_messages_run_idx" ON "app"."agent_messages" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_chunks_org_project_idx" ON "app"."knowledge_chunks" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_chunks_document_idx" ON "app"."knowledge_chunks" USING btree ("document_id","document_version_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_chunks_status_idx" ON "app"."knowledge_chunks" USING btree ("organization_id","project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_delivery_dedupe_unique" ON "app"."notifications" USING btree ("organization_id","recipient_id","event_id","channel");--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "app"."agent_approvals" DROP CONSTRAINT IF EXISTS "agent_approvals_decision_metadata_check";
  ALTER TABLE "app"."agent_approvals" ADD CONSTRAINT "agent_approvals_decision_metadata_check" CHECK ("app"."agent_approvals"."status" IN ('PENDING', 'EXPIRED') OR ("app"."agent_approvals"."decided_by" IS NOT NULL AND "app"."agent_approvals"."decided_at" IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "app"."saas_reminder_deliveries"
    ADD CONSTRAINT "saas_reminder_deliveries_suppressed_at_check"
    CHECK (("status"::text = 'SUPPRESSED') = ("suppressed_at" IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_chunks_embedding_hnsw_idx" ON "app"."knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);
