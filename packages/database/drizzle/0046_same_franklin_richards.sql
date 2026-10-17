ALTER TABLE "app"."financial_audit_events" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."audit_logs" ALTER COLUMN "organization_id" DROP NOT NULL;