import { describe, it, expect } from 'vitest';
import { getDb } from '../../../src/lib/db/index.js';
import {
  getOutboxSendOptions,
  writeOutboxEvent,
} from '../../../src/lib/outbox/outbox.service.js';
import { outboxEvents } from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';
import { ORG_QUEUES } from '../../../src/modules/invitation/invitation.jobs.js';
import { AUTH_QUEUES } from '../../../src/modules/auth/auth.jobs.js';

describe('F.2 Transactional Event Publishing Integration', () => {
  const runId = Math.random().toString(36).substring(7);
  const org1Id = `org1_${runId}`;
  const org2Id = `org2_${runId}`;
  const db = getDb();

  it('atomically commits a validated tenant-scoped queue event', async () => {
    let eventId = '';

    await db.transaction(async (tx) => {
      const e = await writeOutboxEvent(
        tx,
        ORG_QUEUES.SEND_INVITATION_EMAIL,
        {
          id: `evt_${runId}_1`,
          organizationId: org1Id,
          invitationId: `invite_${runId}`,
          email: `member_${runId}@test.dev`,
          orgName: `Org ${runId}`,
          inviterName: 'Test Admin',
          token: `token_${runId}`,
        },
        org1Id,
      );
      eventId = e.id;
    });

    const [row] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, eventId));
    expect(row).toBeDefined();
    expect(row.organizationId).toBe(org1Id);
    expect(row.eventType).toBe(ORG_QUEUES.SEND_INVITATION_EMAIL);
    expect(row.payload).toMatchObject({ organizationId: org1Id, invitationId: `invite_${runId}` });
  });

  it('does not create a second outbox row when an event id is replayed', async () => {
    const eventId = `evt_${runId}_duplicate`;
    const payload = {
      id: eventId,
      organizationId: org1Id,
      invitationId: `invite_${runId}_duplicate`,
      email: `duplicate_${runId}@test.dev`,
      orgName: `Org ${runId}`,
      inviterName: 'Test Admin',
      token: `token_${runId}`,
    };
    await db.transaction((tx) =>
      writeOutboxEvent(tx, ORG_QUEUES.SEND_INVITATION_EMAIL, payload, org1Id),
    );

    await expect(
      db.transaction((tx) =>
        writeOutboxEvent(tx, ORG_QUEUES.SEND_INVITATION_EMAIL, payload, org1Id),
      ),
    ).rejects.toThrow();

    const rows = await db.select().from(outboxEvents).where(eq(outboxEvents.id, eventId));
    expect(rows).toHaveLength(1);
  });

  it('rejects a tenant-scoped event with no tenant and rolls back the transaction', async () => {
    await expect(
      db.transaction(async (tx) => {
        await writeOutboxEvent(
          tx,
          ORG_QUEUES.SEND_INVITATION_EMAIL,
          {
            id: `evt_${runId}_missing_org`,
            invitationId: `invite_${runId}`,
            email: `member_${runId}@test.dev`,
            orgName: `Org ${runId}`,
            inviterName: 'Test Admin',
            token: `token_${runId}`,
          },
          undefined,
        );
      }),
    ).rejects.toThrow(/organizationId/i);

    const rows = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, `evt_${runId}_missing_org`));
    expect(rows.length).toBe(0);
  });

  it('rejects malformed event names, malformed payloads, and mismatched tenant claims', async () => {
    const tx = { insert: () => undefined };
    await expect(
      writeOutboxEvent(tx, 'invalid', { organizationId: org1Id }, org1Id),
    ).rejects.toThrow(/unsupported outbox event type/i);

    await expect(
      writeOutboxEvent(
        tx,
        ORG_QUEUES.SEND_INVITATION_EMAIL,
        {
          organizationId: org1Id,
          invitationId: `invite_${runId}`,
          email: 'not-an-email',
          orgName: `Org ${runId}`,
          inviterName: 'Test Admin',
          token: `token_${runId}`,
        },
        org1Id,
      ),
    ).rejects.toThrow();

    await expect(
      writeOutboxEvent(
        tx,
        ORG_QUEUES.SEND_INVITATION_EMAIL,
        {
          organizationId: org2Id,
          invitationId: `invite_${runId}`,
          email: `member_${runId}@test.dev`,
          orgName: `Org ${runId}`,
          inviterName: 'Test Admin',
          token: `token_${runId}`,
        },
        org1Id,
      ),
    ).rejects.toThrow(/does not match/i);
  });

  it('retains the explicitly tenant-neutral auth queue contract', async () => {
    const eventId = `evt_${runId}_auth`;
    await db.transaction(async (tx) => {
      await writeOutboxEvent(tx, AUTH_QUEUES.SEND_PASSWORD_CHANGED_NOTIFICATION, {
        id: eventId,
        userId: `user_${runId}`,
        email: `user_${runId}@test.dev`,
      });
    });

    const [row] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, eventId));
    expect(row).toBeDefined();
    expect(row.organizationId).toBeNull();
  });

  it('rejects outbox publishing without transaction handle', async () => {
    let caughtError: Error | null = null;

    try {
      await writeOutboxEvent(
        null as any,
        'TaskCompleted',
        {
          id: `evt_${runId}_notx`,
          name: 'TaskCompleted',
          version: 1,
          organizationId: org1Id,
          entityType: 'Task',
          entityId: `task_${runId}`,
          payload: {},
        },
        org1Id,
      );
    } catch (err: any) {
      caughtError = err;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError?.message).toContain('Transaction handle tx is required');
  });

  it('uses a stable payload idempotency key for durable PgBoss deduplication', () => {
    expect(
      getOutboxSendOptions('generated-event-id', {
        idempotencyKey: 'project:abc:created',
      }),
    ).toEqual({
      singletonKey: 'project:abc:created',
      singletonSeconds: 86400,
    });
    expect(getOutboxSendOptions('generated-event-id', {})).toMatchObject({
      singletonKey: 'generated-event-id',
    });
  });
});
