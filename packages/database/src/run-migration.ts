// packages/database/src/run-migration.ts
import postgres from 'postgres';

const connectionString = process.env['DATABASE_URL'] ?? 'postgres://siteflow:siteflow@localhost:5434/siteflow';
const sql = postgres(connectionString);

async function run() {
  console.log('Applying Phase 1 Database Tables & Enums directly...');

  await sql.unsafe(`
    CREATE SCHEMA IF NOT EXISTS "app";

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

    CREATE TABLE IF NOT EXISTS "app"."organizations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL,
      "slug" text NOT NULL,
      "status" "app"."org_status" DEFAULT 'ACTIVE' NOT NULL,
      "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "created_by" uuid NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_unique" ON "app"."organizations" ("slug");

    CREATE TABLE IF NOT EXISTS "app"."roles" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "organization_id" uuid NOT NULL REFERENCES "app"."organizations"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "description" text,
      "is_system" boolean DEFAULT false NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "roles_org_name_unique" ON "app"."roles" ("organization_id", "name");

    CREATE TABLE IF NOT EXISTS "app"."permissions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "key" text NOT NULL UNIQUE,
      "description" text
    );

    CREATE TABLE IF NOT EXISTS "app"."role_permissions" (
      "role_id" uuid NOT NULL REFERENCES "app"."roles"("id") ON DELETE CASCADE,
      "permission_id" uuid NOT NULL REFERENCES "app"."permissions"("id") ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_unique" ON "app"."role_permissions" ("role_id", "permission_id");

    CREATE TABLE IF NOT EXISTS "app"."organization_memberships" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "organization_id" uuid NOT NULL REFERENCES "app"."organizations"("id") ON DELETE CASCADE,
      "user_id" uuid NOT NULL REFERENCES "app"."users"("id") ON DELETE CASCADE,
      "role_id" uuid NOT NULL REFERENCES "app"."roles"("id"),
      "status" "app"."member_status" DEFAULT 'ACTIVE' NOT NULL,
      "joined_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "memberships_org_user_unique" ON "app"."organization_memberships" ("organization_id", "user_id");

    CREATE TABLE IF NOT EXISTS "app"."invitations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "organization_id" uuid NOT NULL REFERENCES "app"."organizations"("id") ON DELETE CASCADE,
      "email" text NOT NULL,
      "role_id" uuid NOT NULL REFERENCES "app"."roles"("id"),
      "token_hash" text NOT NULL,
      "status" "app"."invitation_status" DEFAULT 'PENDING' NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "accepted_at" timestamp with time zone,
      "invited_by" uuid NOT NULL REFERENCES "app"."users"("id"),
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "invitations_token_hash_unique" ON "app"."invitations" ("token_hash");

    CREATE TABLE IF NOT EXISTS "app"."audit_logs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "organization_id" uuid NOT NULL REFERENCES "app"."organizations"("id"),
      "actor_user_id" uuid REFERENCES "app"."users"("id"),
      "action" text NOT NULL,
      "resource_type" text,
      "resource_id" text,
      "metadata" jsonb DEFAULT '{}'::jsonb,
      "ip_address" text,
      "user_agent" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `);

  console.log('Migration successfully applied!');
  await sql.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
