// packages/database/src/run-migration.ts
import postgres from 'postgres';

const connectionString = process.env['DATABASE_URL'] ?? 'postgres://siteflow:siteflow@localhost:5434/siteflow';
const sql = postgres(connectionString);

async function run() {
  console.log('Applying Phase 1 Database Tables & Enums directly...');

  await sql.unsafe(`
    CREATE SCHEMA IF NOT EXISTS "app";

    DO $$ BEGIN
      CREATE TYPE "app"."user_status" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "app"."oauth_provider" AS ENUM('GOOGLE', 'GITHUB', 'MICROSOFT');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "app"."outbox_status" AS ENUM('PENDING', 'PROCESSED', 'FAILED');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "app"."org_status" AS ENUM('ACTIVE', 'SUSPENDED', 'ARCHIVED');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "app"."member_status" AS ENUM('ACTIVE', 'SUSPENDED', 'REMOVED');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "app"."invitation_status" AS ENUM('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "app"."users" (
      "id" text PRIMARY KEY NOT NULL,
      "email" text NOT NULL UNIQUE,
      "email_verified_at" timestamp with time zone,
      "password_hash" text,
      "first_name" text NOT NULL,
      "last_name" text,
      "status" "app"."user_status" DEFAULT 'ACTIVE' NOT NULL,
      "last_login_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "app"."oauth_accounts" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL REFERENCES "app"."users"("id") ON DELETE CASCADE,
      "provider" "app"."oauth_provider" NOT NULL,
      "provider_account_id" text NOT NULL,
      "email" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "oauth_provider_account_idx" ON "app"."oauth_accounts" ("provider", "provider_account_id");

    CREATE TABLE IF NOT EXISTS "app"."sessions" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL REFERENCES "app"."users"("id") ON DELETE CASCADE,
      "refresh_token_hash" text NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "revoked_at" timestamp with time zone,
      "last_used_at" timestamp with time zone,
      "ip_address" text,
      "user_agent" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "app"."email_verification_tokens" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL REFERENCES "app"."users"("id") ON DELETE CASCADE,
      "token_hash" text NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "used_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "app"."password_reset_tokens" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL REFERENCES "app"."users"("id") ON DELETE CASCADE,
      "token_hash" text NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "used_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "app"."outbox_events" (
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

    CREATE INDEX IF NOT EXISTS "outbox_events_org_idx" ON "app"."outbox_events" ("organization_id");
    CREATE INDEX IF NOT EXISTS "outbox_events_status_idx" ON "app"."outbox_events" ("status", "created_at");

    CREATE TABLE IF NOT EXISTS "app"."organizations" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "slug" text NOT NULL,
      "status" "app"."org_status" DEFAULT 'ACTIVE' NOT NULL,
      "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "created_by" text NOT NULL REFERENCES "app"."users"("id"),
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_unique" ON "app"."organizations" ("slug");

    CREATE TABLE IF NOT EXISTS "app"."roles" (
      "id" text PRIMARY KEY NOT NULL,
      "organization_id" text NOT NULL REFERENCES "app"."organizations"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "description" text,
      "is_system" boolean DEFAULT false NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "roles_org_name_unique" ON "app"."roles" ("organization_id", "name");

    CREATE TABLE IF NOT EXISTS "app"."permissions" (
      "id" text PRIMARY KEY NOT NULL,
      "key" text NOT NULL UNIQUE,
      "description" text
    );

    CREATE TABLE IF NOT EXISTS "app"."role_permissions" (
      "role_id" text NOT NULL REFERENCES "app"."roles"("id") ON DELETE CASCADE,
      "permission_id" text NOT NULL REFERENCES "app"."permissions"("id") ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_unique" ON "app"."role_permissions" ("role_id", "permission_id");

    CREATE TABLE IF NOT EXISTS "app"."organization_memberships" (
      "id" text PRIMARY KEY NOT NULL,
      "organization_id" text NOT NULL REFERENCES "app"."organizations"("id") ON DELETE CASCADE,
      "user_id" text NOT NULL REFERENCES "app"."users"("id") ON DELETE CASCADE,
      "role_id" text NOT NULL REFERENCES "app"."roles"("id"),
      "status" "app"."member_status" DEFAULT 'ACTIVE' NOT NULL,
      "joined_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "memberships_org_user_unique" ON "app"."organization_memberships" ("organization_id", "user_id");
    CREATE INDEX IF NOT EXISTS "memberships_org_id_idx" ON "app"."organization_memberships" ("organization_id");
    CREATE INDEX IF NOT EXISTS "memberships_user_id_idx" ON "app"."organization_memberships" ("user_id");

    CREATE TABLE IF NOT EXISTS "app"."invitations" (
      "id" text PRIMARY KEY NOT NULL,
      "organization_id" text NOT NULL REFERENCES "app"."organizations"("id") ON DELETE CASCADE,
      "email" text NOT NULL,
      "role_id" text NOT NULL REFERENCES "app"."roles"("id"),
      "token_hash" text NOT NULL,
      "status" "app"."invitation_status" DEFAULT 'PENDING' NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "accepted_at" timestamp with time zone,
      "invited_by" text NOT NULL REFERENCES "app"."users"("id"),
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "invitations_token_hash_unique" ON "app"."invitations" ("token_hash");
    CREATE INDEX IF NOT EXISTS "invitations_email_org_idx" ON "app"."invitations" ("email", "organization_id");

    CREATE TABLE IF NOT EXISTS "app"."audit_logs" (
      "id" text PRIMARY KEY NOT NULL,
      "organization_id" text NOT NULL REFERENCES "app"."organizations"("id"),
      "actor_user_id" text REFERENCES "app"."users"("id"),
      "action" text NOT NULL,
      "resource_type" text,
      "resource_id" text,
      "metadata" jsonb DEFAULT '{}'::jsonb,
      "ip_address" text,
      "user_agent" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "audit_logs_org_idx" ON "app"."audit_logs" ("organization_id");
    CREATE INDEX IF NOT EXISTS "audit_logs_actor_idx" ON "app"."audit_logs" ("actor_user_id");
  `);

  console.log('Migration successfully applied!');
  await sql.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
