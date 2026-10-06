import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { commercialIdempotencyKeys } from '@siteflow/database/schema';
import type { DatabaseTransaction } from '@siteflow/database';
import { getDb } from '../db/index.js';
import { generateId } from '../id.js';
import {
  IdempotencyKeyPayloadMismatchError,
  IncompleteIdempotencyRecordError,
  InvalidIdempotencyRequestError,
} from './commercial.errors.js';

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface IdempotentCommand {
  organizationId: string;
  operation: string;
  key: string;
  request: JsonValue;
}

function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new InvalidIdempotencyRequestError();
    }
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      throw new InvalidIdempotencyRequestError();
    }
    return serialized;
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new InvalidIdempotencyRequestError();
  }

  const entries = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key]!)}`);
  return `{${entries.join(',')}}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function validateCommand(command: IdempotentCommand): void {
  if (
    command.organizationId.length === 0 ||
    command.operation.length === 0 ||
    command.operation.length > 128 ||
    command.key.trim().length === 0 ||
    command.key.length > 255
  ) {
    throw new InvalidIdempotencyRequestError();
  }
}

/**
 * Runs a database-only command once for an organization/operation/key tuple.
 * The reservation, command writes, and stored result commit or roll back together.
 */
export async function executeIdempotently<T extends JsonValue>(
  command: IdempotentCommand,
  execute: (tx: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  validateCommand(command);
  const keyHash = sha256(command.key);
  const requestHash = sha256(canonicalJson(command.request));

  return getDb().transaction(async (tx) => {
    const inserted = await tx
      .insert(commercialIdempotencyKeys)
      .values({
        id: generateId(),
        organizationId: command.organizationId,
        operation: command.operation,
        keyHash,
        requestHash,
      })
      .onConflictDoNothing({
        target: [
          commercialIdempotencyKeys.organizationId,
          commercialIdempotencyKeys.operation,
          commercialIdempotencyKeys.keyHash,
        ],
      })
      .returning({ id: commercialIdempotencyKeys.id });

    if (inserted.length === 0) {
      const rows = await tx
        .select({
          requestHash: commercialIdempotencyKeys.requestHash,
          responseBody: commercialIdempotencyKeys.responseBody,
          completedAt: commercialIdempotencyKeys.completedAt,
        })
        .from(commercialIdempotencyKeys)
        .where(
          and(
            eq(commercialIdempotencyKeys.organizationId, command.organizationId),
            eq(commercialIdempotencyKeys.operation, command.operation),
            eq(commercialIdempotencyKeys.keyHash, keyHash),
          ),
        )
        .limit(1);
      const existing = rows[0];
      if (!existing || existing.completedAt === null) {
        throw new IncompleteIdempotencyRecordError();
      }
      if (existing.requestHash !== requestHash) {
        throw new IdempotencyKeyPayloadMismatchError();
      }
      return existing.responseBody as T;
    }

    const result = await execute(tx);
    canonicalJson(result);
    await tx
      .update(commercialIdempotencyKeys)
      .set({ responseBody: result, completedAt: new Date() })
      .where(eq(commercialIdempotencyKeys.id, inserted[0]!.id));
    return result;
  });
}
