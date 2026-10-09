// apps/server/src/scripts/migrate-exports.ts
import { getDb } from '../lib/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "app"."report_export_status" AS ENUM('PENDING', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "app"."report_export_format" AS ENUM('csv');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "app"."report_exports" (
      "id" text PRIMARY KEY NOT NULL,
      "organization_id" text NOT NULL,
      "project_id" text,
      "requested_by" text NOT NULL,
      "report_type" text NOT NULL,
      "format" "app"."report_export_format" DEFAULT 'csv' NOT NULL,
      "filter_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "status" "app"."report_export_status" DEFAULT 'PENDING' NOT NULL,
      "object_key" text,
      "last_error" text,
      "expires_at" timestamp with time zone NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "report_exports_org_idx" ON "app"."report_exports" ("organization_id");
    CREATE INDEX IF NOT EXISTS "report_exports_org_user_idx" ON "app"."report_exports" ("organization_id", "requested_by");
    CREATE INDEX IF NOT EXISTS "report_exports_status_idx" ON "app"."report_exports" ("organization_id", "status");
    CREATE INDEX IF NOT EXISTS "report_exports_expires_idx" ON "app"."report_exports" ("expires_at");
  `);

  console.log('report_exports table and indexes created successfully');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed', err);
  process.exit(1);
});
