import { describe, it, expect, beforeEach } from 'vitest';
import { EventDispatcher } from '../../../src/lib/outbox/outbox.dispatcher.js';
import { type DomainEventEnvelope } from '@siteflow/shared';

describe('F.3 Event Dispatcher & Isolated Consumers Integration', () => {
  let dispatcher: EventDispatcher;
  const runId = Math.random().toString(36).substring(7);
  const orgId = `org_${runId}`;

  beforeEach(() => {
    dispatcher = new EventDispatcher();
  });

  it('dispatches event to registered handlers and tracks execution', async () => {
    let handlerExecuted = false;

    dispatcher.register('TaskCompleted', 'handler_1', async (event) => {
      expect(event.organizationId).toBe(orgId);
      handlerExecuted = true;
    });

    const event: DomainEventEnvelope = {
      id: `evt_${runId}_1`,
      name: 'TaskCompleted',
      version: 1,
      occurredAt: new Date().toISOString(),
      organizationId: orgId,
      entityType: 'Task',
      entityId: `task_${runId}`,
      payload: { taskId: `task_${runId}` },
    };

    const result = await dispatcher.dispatch(event);

    expect(handlerExecuted).toBe(true);
    expect(result.succeeded).toContain('handler_1');
    expect(result.failed.length).toBe(0);
  });

  it('isolates handler failure so sibling handlers still execute successfully', async () => {
    let handler2Executed = false;

    dispatcher.register('TaskCompleted', 'failing_handler', async () => {
      throw new Error('Simulated handler crash');
    });

    dispatcher.register('TaskCompleted', 'sibling_handler', async () => {
      handler2Executed = true;
    });

    const event: DomainEventEnvelope = {
      id: `evt_${runId}_2`,
      name: 'TaskCompleted',
      version: 1,
      occurredAt: new Date().toISOString(),
      organizationId: orgId,
      entityType: 'Task',
      entityId: `task_${runId}`,
      payload: {},
    };

    const result = await dispatcher.dispatch(event);

    expect(result.failed).toContain('failing_handler');
    expect(result.succeeded).toContain('sibling_handler');
    expect(handler2Executed).toBe(true);
  });

  it('enforces idempotency on replayed events for the same handler', async () => {
    let callCount = 0;

    dispatcher.register('IssueCreated', 'idempotent_handler', async () => {
      callCount++;
    });

    const event: DomainEventEnvelope = {
      id: `evt_${runId}_3`,
      name: 'IssueCreated',
      version: 1,
      occurredAt: new Date().toISOString(),
      organizationId: orgId,
      entityType: 'Issue',
      entityId: `issue_${runId}`,
      payload: {},
    };

    await dispatcher.dispatch(event);
    await dispatcher.dispatch(event); // Replay

    expect(callCount).toBe(1);
  });

  it('rejects event dispatch if organizationId is missing', async () => {
    const invalidEvent = {
      id: `evt_${runId}_4`,
      name: 'TaskCompleted',
      version: 1,
      occurredAt: new Date().toISOString(),
      entityType: 'Task',
      entityId: `task_${runId}`,
      payload: {},
    } as any;

    await expect(dispatcher.dispatch(invalidEvent)).rejects.toThrow('Cannot dispatch event without organizationId');
  });
});
