// apps/server/src/lib/db/db.ts
import { createDatabaseClient, type DatabaseClient } from '@siteflow/database';
import { serverEnv } from '../../config/env.js';

let _db: DatabaseClient | undefined;

/**
 * Returns the singleton Drizzle database client.
 * Lazily initialised on first call.
 * Pool config and statement timeout are sourced from serverEnv.
 */
export function getDb(): DatabaseClient {
  if (!_db) {
    _db = createDatabaseClient(serverEnv.DATABASE_URL, {
      max: serverEnv.DB_POOL_MAX,
      idleTimeoutMs: serverEnv.DB_POOL_IDLE_TIMEOUT_MS,
      connectTimeoutMs: serverEnv.DB_POOL_CONNECTION_TIMEOUT_MS,
      statementTimeoutMs: serverEnv.DB_STATEMENT_TIMEOUT_MS,
    });
  }
  return _db;
}

export type { DatabaseClient };
