// apps/server/src/lib/db/db.ts
import { createDatabaseClient, type DatabaseClient } from '@siteflow/database';
import { serverEnv } from '../../config/env.js';

let _db: DatabaseClient | undefined;

/**
 * Returns the singleton Drizzle database client.
 * Lazily initialised on first call.
 */
export function getDb(): DatabaseClient {
  if (!_db) {
    _db = createDatabaseClient(serverEnv.DATABASE_URL);
  }
  return _db;
}

export type { DatabaseClient };
