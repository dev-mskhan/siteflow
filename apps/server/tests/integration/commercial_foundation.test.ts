import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { DatabaseTransaction } from '@siteflow/database';
import {
  commercialIdempotencyKeys,
  financialAuditEvents,
  projects,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { executeIdempotently } from '../../src/lib/commercial/idempotency.service.js';
import { writeFinancialAuditEvent } from '../../src/lib/commercial/financial-audit.service.js';
import { FINANCIAL_AUDIT_ACTIONS } from '../../src/lib/commercial/financial-audit.types.js';
import { IdempotencyKeyPayloadMismatchError } from '../../src/lib/commercial/commercial.errors.js';
import { createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';
import { createTestApp } from '../helpers/test-app.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 12);

describe('commercial foundation (integration)', () => {
  let app: FastifyInstance;
  let organizationId: string;
  let otherOrganizationId: string;
  let actorUserId: string;
  let projectId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({
      email: `commercial-foundation-${runId}@example.com`,
    });
    actorUserId = owner.user.id;
    organizationId = (await createOrgWithAdmin(app, owner.token, `Commercial Foundation ${runId}`))
      .orgId;
    const otherOwner = await createVerifiedUser({
      email: `commercial-foundation-other-${runId}@example.com`,
    });
    otherOrganizationId = (
      await createOrgWithAdmin(app, otherOwner.token, `Commercial Foundation Other ${runId}`)
    ).orgId;

    projectId = crypto.randomUUID();
    await getDb()
      .insert(projects)
      .values({
        id: projectId,
        organizationId,
        projectNumber: `CF-${runId}`,
        name: `Commercial Foundation ${runId}`,
        currency: 'USD',
      });
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('replays one completed command for the same scoped key and canonical request', async () => {
    const operation = `test.commercial.once.${runId}`;
    const entityId = `${runId}-once`;
    let callbackCount = 0;
    const command = {
      organizationId,
      operation,
      key: `key-${runId}-once`,
      request: { amount: '12.34', details: { left: 'a', right: 'b' } },
    } as const;

    const execute = async (tx: DatabaseTransaction) => {
      callbackCount += 1;
      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.COST_POSTED,
        entityType: 'CommercialFoundationTest',
        entityId,
        amount: '12.34',
        currencyCode: 'USD',
        requestId: runId,
      });
      return { entityId, amount: '12.34' };
    };

    const first = await executeIdempotently(command, execute);
    const replay = await executeIdempotently(
      {
        ...command,
        request: { details: { right: 'b', left: 'a' }, amount: '12.34' },
      },
      execute,
    );

    expect(first).toEqual({ entityId, amount: '12.34' });
    expect(replay).toEqual(first);
    expect(callbackCount).toBe(1);
    const effects = await getDb()
      .select({
        id: financialAuditEvents.id,
        action: financialAuditEvents.action,
        actorUserId: financialAuditEvents.actorUserId,
        amount: financialAuditEvents.amount,
        currencyCode: financialAuditEvents.currencyCode,
      })
      .from(financialAuditEvents)
      .where(
        and(
          eq(financialAuditEvents.organizationId, organizationId),
          eq(financialAuditEvents.projectId, projectId),
          eq(financialAuditEvents.entityId, entityId),
          eq(financialAuditEvents.requestId, runId),
        ),
      );
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      action: FINANCIAL_AUDIT_ACTIONS.COST_POSTED,
      actorUserId,
      amount: '12.34',
      currencyCode: 'USD',
    });
  });

  it('rejects reuse of a scoped key with a different request payload', async () => {
    const command = {
      organizationId,
      operation: `test.commercial.payload-mismatch.${runId}`,
      key: `key-${runId}-mismatch`,
      request: { amount: '1.00' },
    } as const;
    await executeIdempotently(command, async () => ({ accepted: true }));

    await expect(
      executeIdempotently({ ...command, request: { amount: '2.00' } }, async () => ({
        accepted: false,
      })),
    ).rejects.toBeInstanceOf(IdempotencyKeyPayloadMismatchError);
  });

  it('scopes identical keys by organization and operation', async () => {
    const key = `key-${runId}-scope`;
    const resultA = await executeIdempotently(
      {
        organizationId,
        operation: `test.commercial.scope-a.${runId}`,
        key,
        request: { value: 'a' },
      },
      async () => ({ value: 'a' }),
    );
    const resultB = await executeIdempotently(
      {
        organizationId: otherOrganizationId,
        operation: `test.commercial.scope-a.${runId}`,
        key,
        request: { value: 'b' },
      },
      async () => ({ value: 'b' }),
    );
    const resultC = await executeIdempotently(
      {
        organizationId,
        operation: `test.commercial.scope-b.${runId}`,
        key,
        request: { value: 'c' },
      },
      async () => ({ value: 'c' }),
    );

    expect(resultA).toEqual({ value: 'a' });
    expect(resultB).toEqual({ value: 'b' });
    expect(resultC).toEqual({ value: 'c' });
  });

  it('serializes concurrent duplicate commands to one committed financial effect', async () => {
    const operation = `test.commercial.concurrent.${runId}`;
    const entityId = `${runId}-concurrent`;
    let callbackCount = 0;
    const command = {
      organizationId,
      operation,
      key: `key-${runId}-concurrent`,
      request: { amount: '7.50' },
    } as const;

    let enterCommand!: () => void;
    let releaseCommand!: () => void;
    const commandEntered = new Promise<void>((resolve) => {
      enterCommand = resolve;
    });
    const commandGate = new Promise<void>((resolve) => {
      releaseCommand = resolve;
    });
    const execute = async (tx: DatabaseTransaction) => {
      callbackCount += 1;
      enterCommand();
      await commandGate;
      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.COST_POSTED,
        entityType: 'CommercialFoundationTest',
        entityId,
        amount: '7.50',
        currencyCode: 'USD',
        requestId: runId,
      });
      return { entityId, amount: '7.50' };
    };

    const firstRequest = executeIdempotently(command, execute);
    await commandEntered;
    const secondRequest = executeIdempotently(command, execute);
    releaseCommand();
    const results = await Promise.all([firstRequest, secondRequest]);

    expect(results[0]).toEqual(results[1]);
    expect(callbackCount).toBe(1);
    const effects = await getDb()
      .select({ id: financialAuditEvents.id })
      .from(financialAuditEvents)
      .where(
        and(
          eq(financialAuditEvents.organizationId, organizationId),
          eq(financialAuditEvents.projectId, projectId),
          eq(financialAuditEvents.entityId, entityId),
          eq(financialAuditEvents.requestId, runId),
        ),
      );
    expect(effects).toHaveLength(1);
  });

  it('rolls back the key reservation and audit event when the command fails', async () => {
    const operation = `test.commercial.rollback.${runId}`;
    const entityId = `${runId}-rollback`;
    const command = {
      organizationId,
      operation,
      key: `key-${runId}-rollback`,
      request: { amount: '3.00' },
    } as const;

    await expect(
      executeIdempotently(command, async (tx) => {
        await writeFinancialAuditEvent(tx, {
          organizationId,
          projectId,
          actorUserId,
          action: FINANCIAL_AUDIT_ACTIONS.COST_POSTED,
          entityType: 'CommercialFoundationTest',
          entityId,
          amount: '3.00',
          currencyCode: 'USD',
          requestId: runId,
        });
        throw new Error('transaction rollback fixture');
      }),
    ).rejects.toThrow('transaction rollback fixture');

    const reservations = await getDb()
      .select({ id: commercialIdempotencyKeys.id })
      .from(commercialIdempotencyKeys)
      .where(
        and(
          eq(commercialIdempotencyKeys.organizationId, organizationId),
          eq(commercialIdempotencyKeys.operation, operation),
        ),
      );
    const auditRows = await getDb()
      .select({ id: financialAuditEvents.id })
      .from(financialAuditEvents)
      .where(
        and(
          eq(financialAuditEvents.organizationId, organizationId),
          eq(financialAuditEvents.projectId, projectId),
          eq(financialAuditEvents.entityId, entityId),
          eq(financialAuditEvents.requestId, runId),
        ),
      );
    expect(reservations).toHaveLength(0);
    expect(auditRows).toHaveLength(0);
  });

  it('prevents updates and deletes from rewriting financial audit history', async () => {
    const entityId = `${runId}-immutable`;
    const event = await getDb().transaction((tx) =>
      writeFinancialAuditEvent(tx, {
        organizationId,
        projectId,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.COST_POSTED,
        entityType: 'CommercialFoundationTest',
        entityId,
        amount: '1.00',
        currencyCode: 'USD',
        requestId: runId,
      }),
    );

    await expect(
      getDb()
        .update(financialAuditEvents)
        .set({ reason: 'rewrite attempt' })
        .where(eq(financialAuditEvents.id, event.id)),
    ).rejects.toThrow(/append-only/i);
    await expect(
      getDb().delete(financialAuditEvents).where(eq(financialAuditEvents.id, event.id)),
    ).rejects.toThrow(/append-only/i);

    const persisted = await getDb()
      .select({ reason: financialAuditEvents.reason })
      .from(financialAuditEvents)
      .where(
        and(
          eq(financialAuditEvents.organizationId, organizationId),
          eq(financialAuditEvents.projectId, projectId),
          eq(financialAuditEvents.entityId, entityId),
          eq(financialAuditEvents.requestId, runId),
        ),
      );
    expect(persisted).toHaveLength(1);
    expect(persisted[0]!.reason).toBeNull();
  });
});
