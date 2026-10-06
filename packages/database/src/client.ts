import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index.js';

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;
export type DatabaseTransaction = Parameters<Parameters<DatabaseClient['transaction']>[0]>[0];

export interface DatabasePoolOptions {
  max?: number;
  idleTimeoutMs?: number;
  connectTimeoutMs?: number;
  statementTimeoutMs?: number;
}

/**
 * Create a Drizzle ORM client backed by postgres.js.
 *
 * Call once per process — the returned `db` is a singleton.
 * For the server app, use the `db` singleton from this package's barrel export.
 */
export function createDatabaseClient(connectionString: string, pool?: DatabasePoolOptions) {
  const sql = postgres(connectionString, {
    max: pool?.max ?? 10,
    idle_timeout: pool?.idleTimeoutMs != null ? Math.round(pool.idleTimeoutMs / 1000) : 30,
    connect_timeout: pool?.connectTimeoutMs != null ? Math.round(pool.connectTimeoutMs / 1000) : 10,
    // Set statement_timeout on every new connection to protect against runaway queries
    ...(pool?.statementTimeoutMs != null && {
      connection: {
        statement_timeout: pool.statementTimeoutMs,
      },
    }),
    transform: {
      // Return camelCase column names automatically
      column: postgres.toCamel,
    },
  });

  return drizzle(sql, { schema, logger: process.env.NODE_ENV === 'development' });
}

export { schema };
