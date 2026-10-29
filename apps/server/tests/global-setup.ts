// apps/server/tests/global-setup.ts
//
// Vitest globalSetup — runs once in the main process before any test workers spin up.
//
// What it does:
//  1. Verifies target DB is "siteflow_test" (safety gate — refuses otherwise)
//  2. Prints the database name so every test run is self-documenting
//  3. Creates "siteflow_test" if it does not yet exist
//  4. Applies all migration .sql files from packages/database/drizzle (idempotent)
//  5. Seeds ai.* permissions and role grants (idempotent)
//  6. Sets up LangGraph checkpointer tables in schema "langgraph"
//  7. Schema drift check — Drizzle schema vs live PostgreSQL columns

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Import postgres via @siteflow/database (it re-exports it as of the latest build)
// This ensures Vitest can resolve it through the workspace package instead of looking
// for a bare 'postgres' package that doesn't exist in apps/server/node_modules.
import { postgres, schema } from '@siteflow/database';
import { isTable, getTableColumns, Table } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function globalSetup() {
  const rawUrl =
    process.env['DATABASE_URL'] ||
    'postgres://siteflow:siteflow@localhost:5434/siteflow_test';

  const parsedUrl = new URL(rawUrl);
  const dbName = parsedUrl.pathname.replace(/^\//, '');

  // ── Step 1 & 2: Safety check + announce ─────────────────────────────────────
  console.log('\n======================================================');
  console.log(`[Vitest GlobalSetup] Target database: "${dbName}"`);
  console.log('======================================================\n');

  if (dbName !== 'siteflow_test') {
    throw new Error(
      `SAFETY FAILURE: Tests may ONLY run against "siteflow_test". ` +
        `Attempted target: "${dbName}". Aborting to protect data.`,
    );
  }

  // ── Step 3: Ensure database exists ──────────────────────────────────────────
  // CREATE DATABASE cannot run inside a transaction — use onnotice + no_prepare.
  const adminUrl = new URL(rawUrl);
  adminUrl.pathname = '/postgres';
  const adminSql = postgres(adminUrl.toString(), {
    max: 1,
    // Disable prepared statements so CREATE DATABASE goes through cleanly
    prepare: false,
  });
  try {
    const existing = await adminSql`
      SELECT 1 FROM pg_database WHERE datname = ${dbName}
    `;
    if ((existing as any[]).length === 0) {
      console.log(`[Vitest GlobalSetup] Creating test database "${dbName}"...`);
      // Must be outside a transaction; postgres.js unsafe() with oneline
      await adminSql.unsafe(`CREATE DATABASE "${dbName}"`);
      console.log(`[Vitest GlobalSetup] Created "${dbName}".`);
    } else {
      console.log(`[Vitest GlobalSetup] Database "${dbName}" already exists.`);
    }
  } finally {
    await adminSql.end();
  }

  // ── Connect to siteflow_test ─────────────────────────────────────────────────
  const testSql = postgres(rawUrl, { max: 5 });

  try {
    // Ensure required schemas exist
    await testSql.unsafe('CREATE SCHEMA IF NOT EXISTS "app"');
    await testSql.unsafe('CREATE SCHEMA IF NOT EXISTS "pgboss"');
    await testSql.unsafe('CREATE SCHEMA IF NOT EXISTS "langgraph"');
    await testSql.unsafe('CREATE SCHEMA IF NOT EXISTS "drizzle"');

    // Migration tracking table (Drizzle's own journal)
    await testSql.unsafe(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL UNIQUE,
        created_at bigint NOT NULL
      )
    `);

    // ── Step 4: Apply migrations ─────────────────────────────────────────────
    const drizzleDir = path.resolve(
      __dirname,
      '../../../packages/database/drizzle',
    );
    const allFiles = await fs.readdir(drizzleDir);
    const sqlFiles = allFiles
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    const appliedRows = await testSql.unsafe(
      `SELECT hash FROM drizzle.__drizzle_migrations`,
    );
    const appliedSet = new Set((appliedRows as any[]).map((r) => r.hash));

    let appliedCount = 0;
    for (const sqlFile of sqlFiles) {
      if (appliedSet.has(sqlFile)) continue;

      const filePath = path.join(drizzleDir, sqlFile);
      const sqlContent = await fs.readFile(filePath, 'utf-8');

      const statements = sqlContent
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      // Wrap each migration in a transaction so failures are rolled back cleanly
      await testSql.begin(async (tx) => {
        for (const stmt of statements) {
          await tx.unsafe(stmt);
        }
        await tx.unsafe(
          `INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
           VALUES ($1, $2)`,
          [sqlFile, Date.now()],
        );
      });

      appliedCount++;
    }

    if (appliedCount > 0) {
      console.log(
        `[Vitest GlobalSetup] Applied ${appliedCount} pending migration(s).`,
      );
    } else {
      console.log(
        `[Vitest GlobalSetup] All ${sqlFiles.length} migration(s) already applied.`,
      );
    }

    // ── Step 5: Seed ai.* permissions ────────────────────────────────────────
    console.log('[Vitest GlobalSetup] Seeding ai.* permissions...');
    const aiPerms = [
      'ai.runs.create',
      'ai.runs.read',
      'ai.runs.cancel',
      'ai.approvals.decide',
    ];
    for (const key of aiPerms) {
      await testSql.unsafe(
        `INSERT INTO "app"."permissions" ("id", "key")
         VALUES (gen_random_uuid(), $1)
         ON CONFLICT ("key") DO NOTHING`,
        [key],
      );
    }

    // Grant to admin + finance roles (all 4 perms)
    await testSql.unsafe(
      `INSERT INTO "app"."role_permissions" ("role_id", "permission_id")
       SELECT r.id, p.id
       FROM "app"."roles" r
       CROSS JOIN "app"."permissions" p
       WHERE p.key IN ('ai.runs.create','ai.runs.read','ai.runs.cancel','ai.approvals.decide')
         AND r.name IN ('Organization Admin','Finance')
       ON CONFLICT DO NOTHING`,
    );

    // Grant to Project Manager (no decide)
    await testSql.unsafe(
      `INSERT INTO "app"."role_permissions" ("role_id", "permission_id")
       SELECT r.id, p.id
       FROM "app"."roles" r
       CROSS JOIN "app"."permissions" p
       WHERE p.key IN ('ai.runs.create','ai.runs.read','ai.runs.cancel')
         AND r.name = 'Project Manager'
       ON CONFLICT DO NOTHING`,
    );

    // ── Step 6: LangGraph checkpointer tables ────────────────────────────────
    // We set up the tables directly using raw SQL rather than importing
    // PostgresSaver (which might have resolution issues in globalSetup context)
    console.log('[Vitest GlobalSetup] Setting up LangGraph checkpointer tables...');
    await testSql.unsafe(`
      CREATE TABLE IF NOT EXISTS langgraph.checkpoints (
        thread_id TEXT NOT NULL,
        checkpoint_ns TEXT NOT NULL DEFAULT '',
        checkpoint_id TEXT NOT NULL,
        parent_checkpoint_id TEXT,
        type TEXT,
        checkpoint JSONB NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}',
        PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
      )
    `);
    await testSql.unsafe(`
      CREATE TABLE IF NOT EXISTS langgraph.checkpoint_blobs (
        thread_id TEXT NOT NULL,
        checkpoint_ns TEXT NOT NULL DEFAULT '',
        channel TEXT NOT NULL,
        version TEXT NOT NULL,
        type TEXT NOT NULL,
        blob BYTEA,
        PRIMARY KEY (thread_id, checkpoint_ns, channel, version)
      )
    `);
    await testSql.unsafe(`
      CREATE TABLE IF NOT EXISTS langgraph.checkpoint_writes (
        thread_id TEXT NOT NULL,
        checkpoint_ns TEXT NOT NULL DEFAULT '',
        checkpoint_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        idx INTEGER NOT NULL,
        channel TEXT NOT NULL,
        type TEXT,
        blob BYTEA NOT NULL,
        PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
      )
    `);
    await testSql.unsafe(`
      CREATE TABLE IF NOT EXISTS langgraph.checkpoint_migrations (
        v INTEGER PRIMARY KEY
      )
    `);

    // ── Step 7: Schema drift check ────────────────────────────────────────────
    console.log('[Vitest GlobalSetup] Running schema drift check...');
    const dbColumns = await testSql.unsafe(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'app'`,
    );

    const dbTableColMap = new Map<string, Set<string>>();
    for (const row of dbColumns as any[]) {
      if (!dbTableColMap.has(row.table_name)) {
        dbTableColMap.set(row.table_name, new Set());
      }
      dbTableColMap.get(row.table_name)!.add(row.column_name);
    }

    const missingItems: string[] = [];
    for (const value of Object.values(schema)) {
      if (value && typeof value === 'object' && isTable(value)) {
        const table = value as PgTable;
        // Access table name from Drizzle's Symbol-keyed metadata
        const sym = Object.getOwnPropertySymbols(table).find(
          (s) => s.description === 'drizzle:Name',
        );
        const tableName: string = sym
          ? (table as any)[sym]
          : (table as any)._?.config?.name ?? '';

        if (!tableName) continue;

        const existingCols = dbTableColMap.get(tableName);
        if (!existingCols) {
          missingItems.push(`Table missing: "app"."${tableName}"`);
          continue;
        }

        const columns = getTableColumns(table);
        for (const col of Object.values(columns)) {
          const colName = (col as any).name as string;
          if (colName && !existingCols.has(colName)) {
            missingItems.push(
              `Column missing: "app"."${tableName}"."${colName}"`,
            );
          }
        }
      }
    }

    if (missingItems.length > 0) {
      throw new Error(
        `[Schema Drift Check FAILED] Drizzle schema has items not in PostgreSQL:\n  - ` +
          missingItems.join('\n  - '),
      );
    }

    console.log('[Vitest GlobalSetup] Schema drift check PASSED ✓');
    console.log('[Vitest GlobalSetup] Setup complete — running tests.\n');
  } finally {
    await testSql.end();
  }
}
