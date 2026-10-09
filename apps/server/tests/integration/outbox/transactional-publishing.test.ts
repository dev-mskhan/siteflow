import { describe, it, expect } from 'vitest';
import { getDb } from '../../../src/lib/db/index.js';
import { writeOutboxEvent } from '../../../src/lib/outbox/outbox.service.js';
import { outboxEvents } from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';

describe('F.2 Transactional Event Publishing Integration', () => {
  const runId = Math.random().toString(36).substring(7);
  const org1Id = `org1_${runId}`;
  const org2Id = `org2_${runId}`;
  const db = getDb();

  it('atomically commits outbox event within transaction and enforces organizationId requirement', async () => {
    let eventId = '';

    await db.transaction(async (tx) => {
      const e = await writeOutboxEvent(
        tx,
        'TaskCompleted',
        {
          id: `evt_${runId}_1`,
          name: 'TaskCompleted',
          version: 1,
          occurredAt: new Date().toISOString(),
          organizationId: org1Id,
          entityType: 'Task',
          entityId: `task_${runId}`,
          payload: { taskId: `task_${runId}` },
        },
        org1Id,
      );
      eventId = e.id;
    });

    const [row] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, eventId));
    expect(row).toBeDefined();
    expect(row.organizationId).toBe(org1Id);
    expect(row.eventType).toBe('TaskCompleted');
  });

  it('rejects outbox publishing without valid organizationId and rolls back transaction', async () => {
    let caughtError: Error | null = null;

    try {
      await db.transaction(async (tx) => {
        // Attempt to call writeOutboxEvent without organizationId
        await writeOutboxEvent(
          tx,
          'TaskCompleted',
          {
            id: `evt_${runId}_invalid`,
            name: 'TaskCompleted',
            version: 1,
            occurredAt: new Date().toISOString(),
            entityType: 'Task',
            entityId: `task_${runId}`,
            payload: {},
          },
          '' as any,
        );
      });
    } catch (err: any) {
      caughtError = err;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError?.message).toContain('organizationId is required');

    // Confirm no row was written
    const rows = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, `evt_${runId}_invalid`));
    expect(rows.length).toBe(0);
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
});
