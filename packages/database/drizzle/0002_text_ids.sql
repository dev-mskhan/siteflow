-- Migration: Switch all PK and FK columns from uuid to text
-- This allows any string ID format (UUID, ULID, etc.) to be stored.
-- WARNING: This migration drops and recreates all app schema tables.
-- Only safe on a dev database with no production data.

-- Drop all tables in dependency order (children first)
DROP TABLE IF EXISTS "app"."audit_logs" CASCADE;
DROP TABLE IF EXISTS "app"."role_permissions" CASCADE;
DROP TABLE IF EXISTS "app"."invitations" CASCADE;
DROP TABLE IF EXISTS "app"."organization_memberships" CASCADE;
DROP TABLE IF EXISTS "app"."roles" CASCADE;
DROP TABLE IF EXISTS "app"."permissions" CASCADE;
DROP TABLE IF EXISTS "app"."organizations" CASCADE;
DROP TABLE IF EXISTS "app"."outbox_events" CASCADE;
DROP TABLE IF EXISTS "app"."password_reset_tokens" CASCADE;
DROP TABLE IF EXISTS "app"."email_verification_tokens" CASCADE;
DROP TABLE IF EXISTS "app"."sessions" CASCADE;
DROP TABLE IF EXISTS "app"."oauth_accounts" CASCADE;
DROP TABLE IF EXISTS "app"."users" CASCADE;

--> statement-breakpoint

CREATE TABLE "app"."users" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "email_verified_at" timestamp with time zone,
  "password_hash" text,
  "first_name" text NOT NULL,
  "last_name" text,
  "status" "app"."user_status" DEFAULT 'ACTIVE' NOT NULL,
  "last_login_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);

--> statement-breakpoint

CREATE TABLE "app"."oauth_accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "provider" "app"."oauth_provider" NOT NULL,
  "provider_account_id" text NOT NULL,
  "email" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

CREATE TABLE "app"."sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "refresh_token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "last_used_at" timestamp with time zone,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

CREATE TABLE "app"."email_verification_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

CREATE TABLE "app"."password_reset_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

CREATE TABLE "app"."outbox_events" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text,
  "event_type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "status" "app"."outbox_status" DEFAULT 'PENDING' NOT NULL,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "processed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

CREATE TABLE "app"."organizations" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "status" "app"."org_status" DEFAULT 'ACTIVE' NOT NULL,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

CREATE TABLE "app"."roles" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "is_system" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

CREATE TABLE "app"."permissions" (
  "id" text PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "description" text,
  CONSTRAINT "permissions_key_unique" UNIQUE("key")
);

--> statement-breakpoint

CREATE TABLE "app"."role_permissions" (
  "role_id" text NOT NULL,
  "permission_id" text NOT NULL
);

--> statement-breakpoint

CREATE TABLE "app"."organization_memberships" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role_id" text NOT NULL,
  "status" "app"."member_status" DEFAULT 'ACTIVE' NOT NULL,
  "joined_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

CREATE TABLE "app"."invitations" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "email" text NOT NULL,
  "role_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "status" "app"."invitation_status" DEFAULT 'PENDING' NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "accepted_at" timestamp with time zone,
  "invited_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

CREATE TABLE "app"."audit_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "actor_user_id" text,
  "action" text NOT NULL,
  "resource_type" text,
  "resource_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Foreign keys
ALTER TABLE "app"."oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app"."email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app"."organizations" ADD CONSTRAINT "organizations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app"."roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "app"."roles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "app"."permissions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app"."organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app"."organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app"."organization_memberships" ADD CONSTRAINT "organization_memberships_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "app"."roles"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app"."invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app"."invitations" ADD CONSTRAINT "invitations_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "app"."roles"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app"."invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "app"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app"."audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app"."audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "app"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- Indexes
CREATE UNIQUE INDEX "oauth_provider_account_idx" ON "app"."oauth_accounts" ("provider","provider_account_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_unique" ON "app"."organizations" ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX "roles_org_name_unique" ON "app"."roles" ("organization_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_unique" ON "app"."role_permissions" ("role_id","permission_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_org_user_unique" ON "app"."organization_memberships" ("organization_id","user_id");
--> statement-breakpoint
CREATE INDEX "memberships_org_id_idx" ON "app"."organization_memberships" ("organization_id");
--> statement-breakpoint
CREATE INDEX "memberships_user_id_idx" ON "app"."organization_memberships" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_hash_unique" ON "app"."invitations" ("token_hash");
--> statement-breakpoint
CREATE INDEX "invitations_email_org_idx" ON "app"."invitations" ("email","organization_id");
--> statement-breakpoint
CREATE INDEX "outbox_events_org_idx" ON "app"."outbox_events" ("organization_id");
--> statement-breakpoint
CREATE INDEX "outbox_events_status_idx" ON "app"."outbox_events" ("status","created_at");
--> statement-breakpoint
CREATE INDEX "audit_logs_org_idx" ON "app"."audit_logs" ("organization_id");
--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "app"."audit_logs" ("actor_user_id");
