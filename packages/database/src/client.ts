import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index.js';

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;

/**
 * Create a Drizzle ORM client backed by postgres.js.
 *
 * Call once per process — the returned `db` is a singleton.
 * For the server app, use the `db` singleton from this package's barrel export.
 */
export function createDatabaseClient(connectionString: string) {
  const sql = postgres(connectionString, {
    max: 10,          // connection pool size
    idle_timeout: 30, // close idle connections after 30s
    connect_timeout: 10,
    transform: {
      // Return camelCase column names automatically
      column: postgres.toCamel,
    },
  });

  return drizzle(sql, { schema, logger: process.env.NODE_ENV === 'development' });
}

export { schema };
