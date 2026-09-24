// apps/server/src/lib/id.ts
// Centralized ID generation for all database entities.
// Uses crypto.randomUUID() — standard UUID v4, natively available in Node 16+.

/**
 * Generates a new UUID v4 string.
 * Use this wherever a new entity ID is needed before an INSERT.
 */
export function generateId(): string {
  return crypto.randomUUID();
}
