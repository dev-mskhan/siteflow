import { describe, it, expect } from 'vitest';
import { getDb } from '../../../src/lib/db/index.js';
import { writeOutboxEvent } from '../../../src/lib/outbox/outbox.service.js';
import { outboxEvents } from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';
import {
  DomainEventEnvelopeSchema,
  parseDomainEvent,
  safeParseDomainEvent,
} from '@siteflow/shared';

describe('F.1 Domain Event Contract & Outbox Persistence Integration', () => {
  const runId = Math.random().toString(36).substring(7);
  const org1Id = `org1_${runId}`;
  const org2Id = `org2_${runId}`;
  const db = getDb();

  it('validates a valid versioned event envelope successfully', () => {
    const validEvent = {
      id: `evt_${runId}_1`,
      name: 'TaskCompleted',
      version: 1,
      occurredAt: new Date().toISOString(),
      organizationId: org1Id,
      projectId: `proj_${runId}`,
      actor: { id: `usr_${runId}`, type: 'USER' as const },
      entityType: 'Task',
      entityId: `task_${runId}`,
      correlationId: `corr_${runId}`,
      causationId: `cause_${runId}`,
      payload: { taskId: `task_${runId}`, status: 'COMPLETED' },
    };

    const parsed = parseDomainEvent(validEvent);
    expect(parsed.name).toBe('TaskCompleted');
    expect(parsed.organizationId).toBe(org1Id);
    expect(parsed.version).toBe(1);
  });

  it('rejects an event with missing organizationId', () => {
    const invalidEvent = {
      id: `evt_${runId}_2`,
      name: 'TaskCompleted',
      version: 1,
      occurredAt: new Date().toISOString(),
      // missing organizationId
      entityType: 'Task',
      entityId: `task_${runId}`,
      payload: {},
    };

    const result = safeParseDomainEvent(invalidEvent);
    expect(result.success).toBe(false);
  });

  it('rejects an unsupported event type', () => {
    const invalidType = {
      id: `evt_${runId}_3`,
      name: 'UnsupportedFakeEvent',
      version: 1,
      occurredAt: new Date().toISOString(),
      organizationId: org1Id,
      entityType: 'Task',
      entityId: `task_${runId}`,
      payload: {},
    };

    const result = safeParseDomainEvent(invalidType);
    expect(result.success).toBe(false);
  });

  it('persists a versioned outbox event within a transaction and verifies multi-tenant isolation', async () => {
    const event1Payload = {
      id: `evt_${runId}_10`,
      name: 'TaskCompleted',
      version: 1,
      occurredAt: new Date().toISOString(),
      organizationId: org1Id,
      projectId: `proj1_${runId}`,
      actor: { id: `usr_${runId}`, type: 'USER' as const },
      entityType: 'Task',
      entityId: `task1_${runId}`,
      payload: { taskId: `task1_${runId}` },
    };

    const event2Payload = {
      id: `evt_${runId}_11`,
      name: 'IssueCreated',
      version: 1,
      occurredAt: new Date().toISOString(),
      organizationId: org2Id,
      projectId: `proj2_${runId}`,
      actor: { id: `usr_${runId}`, type: 'USER' as const },
      entityType: 'Issue',
      entityId: `issue1_${runId}`,
      payload: { issueId: `issue1_${runId}` },
    };

    let createdId1 = '';
    let createdId2 = '';

    await db.transaction(async (tx) => {
      const e1 = await writeOutboxEvent(tx, event1Payload.name, event1Payload, org1Id);
      const e2 = await writeOutboxEvent(tx, event2Payload.name, event2Payload, org2Id);
      createdId1 = e1.id;
      createdId2 = e2.id;
    });

    const [row1] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, createdId1));
    const [row2] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, createdId2));

    expect(row1).toBeDefined();
    expect(row1.organizationId).toBe(org1Id);
    expect(row1.eventType).toBe('TaskCompleted');

    expect(row2).toBeDefined();
    expect(row2.organizationId).toBe(org2Id);
    expect(row2.eventType).toBe('IssueCreated');
  });
});
