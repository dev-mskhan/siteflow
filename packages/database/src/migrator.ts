/**
 * Database Migration Runner
 * Industry-standard approach using drizzle-orm migrate()
 * 
 * Usage:
 *   pnpm tsx packages/database/src/migrator.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigrations() {
  const databaseUrl = process.env['DATABASE_URL'] ?? 'postgres://siteflow:siteflow@localhost:5434/siteflow';

  console.log('🔄 Starting database migrations...');
  console.log(`📦 Database: ${databaseUrl.split('@')[1]}`);

  // Create migration connection (max 1 connection)
  const migrationClient = postgres(databaseUrl, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    // Run migrations from the drizzle folder
    const migrationsFolder = resolve(__dirname, '../drizzle');
    console.log(`📁 Migrations folder: ${migrationsFolder}\n`);

    await migrate(db, { migrationsFolder });

    console.log('✅ Migrations completed successfully!\n');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

runMigrations();
