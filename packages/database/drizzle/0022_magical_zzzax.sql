CREATE TYPE "app"."document_processing_status" AS ENUM('NOT_STARTED', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');--> statement-breakpoint
ALTER TABLE "app"."documents" ADD COLUMN "processing_status" "app"."document_processing_status" DEFAULT 'NOT_STARTED' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."documents" ADD COLUMN "processing_error" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_project_status_idx" ON "app"."documents" USING btree ("project_id","status");