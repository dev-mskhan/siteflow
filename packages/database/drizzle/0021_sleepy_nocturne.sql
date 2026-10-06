CREATE TYPE "app"."document_access" AS ENUM('PROJECT_MEMBERS', 'PROJECT_MANAGERS_ONLY', 'ADMIN_ONLY');--> statement-breakpoint
CREATE TYPE "app"."document_category" AS ENUM('DRAWING', 'SPECIFICATION', 'PERMIT', 'CERTIFICATE', 'REPORT', 'PHOTO', 'VIDEO', 'CONTRACT', 'INVOICE', 'OTHER');--> statement-breakpoint
CREATE TYPE "app"."document_status" AS ENUM('PENDING_UPLOAD', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED', 'DELETED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."document_access_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"document_id" text NOT NULL,
	"accessed_by" text NOT NULL,
	"access_type" text NOT NULL,
	"ip_address" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_access_logs_access_type_valid" CHECK ("app"."document_access_logs"."access_type" IN ('DOWNLOAD', 'UPLOAD_COMPLETE', 'VERSION_CREATED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."document_entity_links" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"document_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."document_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"uploaded_by" text,
	"file_name" text NOT NULL,
	"file_size" bigint NOT NULL,
	"content_type" text NOT NULL,
	"checksum" text,
	"storage_key" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_versions_file_size_positive" CHECK ("app"."document_versions"."file_size" > 0),
	CONSTRAINT "document_versions_number_positive" CHECK ("app"."document_versions"."version_number" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."documents" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"category" "app"."document_category" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "app"."document_status" DEFAULT 'PENDING_UPLOAD' NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"uploaded_by" text,
	"file_name" text NOT NULL,
	"file_size" bigint NOT NULL,
	"content_type" text NOT NULL,
	"checksum" text,
	"storage_key" text,
	"access_policy" "app"."document_access" DEFAULT 'PROJECT_MEMBERS' NOT NULL,
	"expiry_date" date,
	"expires_notified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_file_size_positive" CHECK ("app"."documents"."file_size" > 0),
	CONSTRAINT "documents_title_length" CHECK (char_length("app"."documents"."title") <= 500)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."document_access_logs" ADD CONSTRAINT "document_access_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."document_access_logs" ADD CONSTRAINT "document_access_logs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "app"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."document_access_logs" ADD CONSTRAINT "document_access_logs_accessed_by_users_id_fk" FOREIGN KEY ("accessed_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."document_entity_links" ADD CONSTRAINT "document_entity_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."document_entity_links" ADD CONSTRAINT "document_entity_links_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "app"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."document_entity_links" ADD CONSTRAINT "document_entity_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "app"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."document_versions" ADD CONSTRAINT "document_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."document_versions" ADD CONSTRAINT "document_versions_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_access_logs_doc_idx" ON "app"."document_access_logs" USING btree ("document_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_access_logs_org_idx" ON "app"."document_access_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_access_logs_accessed_by_idx" ON "app"."document_access_logs" USING btree ("accessed_by");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "document_entity_links_unique" ON "app"."document_entity_links" USING btree ("document_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_entity_links_entity_idx" ON "app"."document_entity_links" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_entity_links_doc_idx" ON "app"."document_entity_links" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_entity_links_org_idx" ON "app"."document_entity_links" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_entity_links_created_by_idx" ON "app"."document_entity_links" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "document_versions_doc_number_unique" ON "app"."document_versions" USING btree ("document_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "document_versions_storage_key_unique" ON "app"."document_versions" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_versions_doc_idx" ON "app"."document_versions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_versions_org_idx" ON "app"."document_versions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_versions_uploaded_by_idx" ON "app"."document_versions" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_org_project_idx" ON "app"."documents" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_project_category_status_idx" ON "app"."documents" USING btree ("project_id","category","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_project_created_idx" ON "app"."documents" USING btree ("project_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_expiry_partial_idx" ON "app"."documents" USING btree ("expiry_date","expires_notified") WHERE "app"."documents"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_uploaded_by_idx" ON "app"."documents" USING btree ("uploaded_by");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "documents_storage_key_unique" ON "app"."documents" USING btree ("storage_key");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."task_document_links" ADD CONSTRAINT "task_document_links_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "app"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_doc_links_document_idx" ON "app"."task_document_links" USING btree ("document_id");