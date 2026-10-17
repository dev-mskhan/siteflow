// apps/server/src/modules/platform/platform-idempotency.ts
// Idempotency-Key replay for platform admin writes. Scope is (actor, operation, key).
import { createHash, randomUUID } from 'node:crypto';
import { and, eq, lt } from 'drizzle-orm';
import { platformIdempotencyKeys } from '@siteflow/database/schema';
import { getDb } from '../../lib/db/index.js';
import { ConflictError } from '../auth/auth.errors.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export interface IdempotentWriteInput<T> {
  actorUserId: string;
  operation: string;
  idempotencyKey: string | undefined;
  body: unknown;
  execute: () => Promise<T>;
}

export async function runIdempotentWrite<T>(input: IdempotentWriteInput<T>): Promise<T> {
  if (!input.idempotencyKey) return input.execute();

  const db = getDb();
  const keyHash = sha256(input.idempotencyKey);
  const requestHash = sha256(JSON.stringify(input.body ?? null));
  const scope = and(
    eq(platformIdempotencyKeys.actorUserId, input.actorUserId),
    eq(platformIdempotencyKeys.operation, input.operation),
    eq(platformIdempotencyKeys.keyHash, keyHash),
  );

  await db.delete(platformIdempotencyKeys).where(and(scope, lt(platformIdempotencyKeys.expiresAt, new Date())));

  const [existing] = await db.select().from(platformIdempotencyKeys).where(scope).limit(1);
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new ConflictError('Idempotency-Key was already used with a different request body');
    }
    if (!existing.completedAt) {
      throw new ConflictError('A request with this Idempotency-Key is still in progress');
    }
    return existing.responseBody as T;
  }

  try {
    await db.insert(platformIdempotencyKeys).values({
      id: randomUUID(),
      actorUserId: input.actorUserId,
      operation: input.operation,
      keyHash,
      requestHash,
    });
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      err.code === '23505'
    ) {
      throw new ConflictError('A request with this Idempotency-Key is still in progress');
    }
    throw err;
  }

  try {
    const result = await input.execute();
    await db
      .update(platformIdempotencyKeys)
      .set({ responseBody: result as object, completedAt: new Date() })
      .where(scope);
    return result;
  } catch (err) {
    await db.delete(platformIdempotencyKeys).where(scope);
    throw err;
  }
}
