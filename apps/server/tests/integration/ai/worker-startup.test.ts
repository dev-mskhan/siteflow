// apps/server/tests/integration/ai/worker-startup.test.ts
import { describe, it, expect, afterAll } from 'vitest';
import { postgres } from '@siteflow/database';
import { startQueue, stopQueue, getQueueInstance } from '../../../src/lib/queue/index.js';
import { registerWorkers } from '../../../src/worker-registration.js';
import { serverEnv } from '../../../src/config/env.js';
import { AI_QUEUES } from '../../../src/modules/ai/ai.jobs.js';
import { REAPER_QUEUE } from '../../../src/modules/ai/workers/reaper.worker.js';

describe('AI Worker Startup & PgBoss Queue Initialization', () => {
  let sql: ReturnType<typeof postgres>;

  afterAll(async () => {
    try {
      await stopQueue();
    } catch {
      // ignore
    }
    if (sql) {
      await sql.end();
    }
  });

  it(
    'initializes queues, registers workers, and schedules reaper without throwing',
    async () => {
      sql = postgres(serverEnv.DATABASE_URL, { max: 2 });

    // 1. Start queue (ensures all queues are configured via ensureQueueConfigured)
    const boss = await startQueue();
    expect(boss).toBeDefined();

    // 2. Register all workers (including AI workers and reaper schedule)
    await expect(registerWorkers(boss)).resolves.not.toThrow();

    // 3. Verify in pgboss.queue that AI queues were created
    const queueRows = await sql`
      SELECT name FROM pgboss.queue
      WHERE name IN (
        ${AI_QUEUES.AGENT_RUN},
        ${AI_QUEUES.TRANSCRIBE},
        ${AI_QUEUES.REAPER}
      )
    `;

    const foundQueues = queueRows.map((r) => r.name);
    expect(foundQueues).toContain(AI_QUEUES.AGENT_RUN);
    expect(foundQueues).toContain(AI_QUEUES.TRANSCRIBE);
    expect(foundQueues).toContain(AI_QUEUES.REAPER);

    // 4. Verify in pgboss.schedule that the reaper schedule row exists
    const scheduleRows = await sql`
      SELECT name, cron FROM pgboss.schedule
      WHERE name = ${REAPER_QUEUE}
    `;

    expect(scheduleRows.length).toBeGreaterThan(0);
    expect(scheduleRows[0].name).toBe(REAPER_QUEUE);
    expect(scheduleRows[0].cron).toBe('*/5 * * * *');
  }, 90000);
});
