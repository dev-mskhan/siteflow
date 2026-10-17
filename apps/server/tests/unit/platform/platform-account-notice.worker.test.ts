// apps/server/tests/unit/platform/platform-account-notice.worker.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const handlers = new Map<string, (job: { id: string; data: unknown }) => Promise<void>>();
const selectLimit = vi.fn();
const sendMail = vi.fn();

vi.mock('../../../src/lib/queue/worker-factory.js', () => ({
  registerWorker: vi.fn(async (_boss: unknown, opts: { queue: string }, handler: never) => {
    handlers.set(opts.queue, handler);
  }),
}));

vi.mock('../../../src/lib/email/email.service.js', () => ({
  emailService: { sendMail: (...args: unknown[]) => sendMail(...args) },
}));

vi.mock('../../../src/lib/db/index.js', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => selectLimit() }),
      }),
    }),
  }),
}));

vi.mock('@siteflow/observability/server', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { registerPlatformAccountNoticeWorkers } from '../../../src/modules/platform/platform-account-notice.worker.js';
import { PLATFORM_QUEUES } from '../../../src/modules/platform/platform.jobs.js';

const payload = {
  targetUserId: 'user-1',
  actorUserId: 'admin-1',
  reasonCode: 'POLICY',
  reasonNote: 'test',
};

describe('platform account notice worker', () => {
  beforeEach(async () => {
    handlers.clear();
    selectLimit.mockReset();
    sendMail.mockReset();
    await registerPlatformAccountNoticeWorkers({} as never);
  });

  it('registers consumers for account suspended and reactivated queues', () => {
    expect(handlers.has(PLATFORM_QUEUES.ACCOUNT_SUSPENDED)).toBe(true);
    expect(handlers.has(PLATFORM_QUEUES.ACCOUNT_REACTIVATED)).toBe(true);
  });

  it('emails the target user on suspension', async () => {
    selectLimit.mockResolvedValue([{ email: 'user@example.com' }]);
    await handlers.get(PLATFORM_QUEUES.ACCOUNT_SUSPENDED)!({ id: 'j1', data: payload });

    expect(sendMail).toHaveBeenCalledTimes(1);
    const arg = sendMail.mock.calls[0][0];
    expect(arg.to).toBe('user@example.com');
    expect(arg.subject).toBe('Your SiteFlow account has been suspended');
  });

  it('emails the target user on reactivation', async () => {
    selectLimit.mockResolvedValue([{ email: 'user@example.com' }]);
    await handlers.get(PLATFORM_QUEUES.ACCOUNT_REACTIVATED)!({ id: 'j2', data: payload });

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0].subject).toBe('Your SiteFlow account has been reactivated');
  });

  it('skips sending when the user has no email', async () => {
    selectLimit.mockResolvedValue([{ email: null }]);
    await handlers.get(PLATFORM_QUEUES.ACCOUNT_SUSPENDED)!({ id: 'j3', data: payload });

    expect(sendMail).not.toHaveBeenCalled();
  });

  it('skips sending when the user is not found', async () => {
    selectLimit.mockResolvedValue([]);
    await handlers.get(PLATFORM_QUEUES.ACCOUNT_REACTIVATED)!({ id: 'j4', data: payload });

    expect(sendMail).not.toHaveBeenCalled();
  });
});
