CREATE TYPE "app"."submittal_response" AS ENUM('APPROVED', 'APPROVED_WITH_COMMENTS', 'REVISE_AND_RESUBMIT', 'REJECTED');--> statement-breakpoint
CREATE TYPE "app"."revision_status" AS ENUM('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REVISE_AND_RESUBMIT');--> statement-breakpoint
CREATE TYPE "app"."submittal_status" AS ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REVISE_AND_RESUBMIT', 'CLOSED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."submittal_revision_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"submittal_revision_id" text NOT NULL,
	"submittal_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"status" "app"."revision_status" NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"response" "app"."submittal_response" NOT NULL,
	"response_notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."submittal_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"submittal_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"status" "app"."revision_status" DEFAULT 'SUBMITTED' NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"response" "app"."submittal_response",
	"response_notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."submittals" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"submittal_number" text NOT NULL,
	"title" text NOT NULL,
	"spec_reference" text,
	"discipline" text,
	"responsible_member_id" text,
	"reviewer_member_id" text,
	"status" "app"."submittal_status" DEFAULT 'DRAFT' NOT NULL,
	"due_date" date,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."submittal_revision_reviews" ADD CONSTRAINT "submittal_revision_reviews_submittal_revision_id_submittal_revisions_id_fk" FOREIGN KEY ("submittal_revision_id") REFERENCES "app"."submittal_revisions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."submittal_revision_reviews" ADD CONSTRAINT "submittal_revision_reviews_submittal_id_submittals_id_fk" FOREIGN KEY ("submittal_id") REFERENCES "app"."submittals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."submittal_revision_reviews" ADD CONSTRAINT "submittal_revision_reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."submittal_revision_reviews" ADD CONSTRAINT "submittal_revision_reviews_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."submittal_revisions" ADD CONSTRAINT "submittal_revisions_submittal_id_submittals_id_fk" FOREIGN KEY ("submittal_id") REFERENCES "app"."submittals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."submittal_revisions" ADD CONSTRAINT "submittal_revisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."submittal_revisions" ADD CONSTRAINT "submittal_revisions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."submittal_revisions" ADD CONSTRAINT "submittal_revisions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."submittals" ADD CONSTRAINT "submittals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."submittals" ADD CONSTRAINT "submittals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."submittals" ADD CONSTRAINT "submittals_responsible_member_id_project_members_id_fk" FOREIGN KEY ("responsible_member_id") REFERENCES "app"."project_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."submittals" ADD CONSTRAINT "submittals_reviewer_member_id_project_members_id_fk" FOREIGN KEY ("reviewer_member_id") REFERENCES "app"."project_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."submittals" ADD CONSTRAINT "submittals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "submittal_revision_reviews_revision_unique" ON "app"."submittal_revision_reviews" USING btree ("submittal_revision_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submittal_revision_reviews_submittal_idx" ON "app"."submittal_revision_reviews" USING btree ("submittal_id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "submittal_revisions_number_unique" ON "app"."submittal_revisions" USING btree ("submittal_id","revision_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submittal_revisions_submittal_idx" ON "app"."submittal_revisions" USING btree ("submittal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submittal_revisions_org_idx" ON "app"."submittal_revisions" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "submittals_project_number_unique" ON "app"."submittals" USING btree ("project_id","submittal_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submittals_org_project_idx" ON "app"."submittals" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submittals_project_status_created_idx" ON "app"."submittals" USING btree ("project_id","status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submittals_responsible_member_idx" ON "app"."submittals" USING btree ("responsible_member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submittals_reviewer_member_idx" ON "app"."submittals" USING btree ("reviewer_member_id");