// apps/server/src/modules/platform/platform-account-notice.worker.ts
import type PgBoss from 'pg-boss';
import { eq } from 'drizzle-orm';
import { users } from '@siteflow/database/schema';
import { createLogger } from '@siteflow/observability/server';
import { getDb } from '../../lib/db/index.js';
import { registerWorker } from '../../lib/queue/worker-factory.js';
import { emailService } from '../../lib/email/email.service.js';
import { PLATFORM_QUEUES } from './platform.jobs.js';

const logger = createLogger({ name: 'platform-account-notice-worker' });

interface PlatformAccountNoticePayload {
  targetUserId: string;
  actorUserId: string;
  reasonCode: string;
  reasonNote: string;
}

const NOTICE_COPY = {
  [PLATFORM_QUEUES.ACCOUNT_SUSPENDED]: {
    subject: 'Your SiteFlow account has been suspended',
    heading: 'Account suspended',
    body: 'Your SiteFlow account has been suspended by the SiteFlow operations team. Your active sessions have been signed out.',
  },
  [PLATFORM_QUEUES.ACCOUNT_REACTIVATED]: {
    subject: 'Your SiteFlow account has been reactivated',
    heading: 'Account reactivated',
    body: 'Your SiteFlow account has been reactivated. Please sign in again to continue.',
  },
} as const;

function renderNotice(copy: { heading: string; body: string }): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2563eb;">${copy.heading}</h2>
      <p>${copy.body}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #999; font-size: 12px;">If you believe this was a mistake, contact SiteFlow support.</p>
    </div>
  `;
}

/**
 * Account-level notices are security notices and bypass the email opt-out
 * preference (see P1-5). They are sent by email only because the in-app
 * notification table is tenant-scoped and an account notice has no org.
 */
export async function registerPlatformAccountNoticeWorkers(boss: PgBoss): Promise<void> {
  for (const queue of [PLATFORM_QUEUES.ACCOUNT_SUSPENDED, PLATFORM_QUEUES.ACCOUNT_REACTIVATED] as const) {
    await registerWorker<PlatformAccountNoticePayload>(
      boss,
      { queue, concurrency: 5, timeoutSecs: 30 },
      async (job) => {
        const { targetUserId } = job.data;
        const [target] = await getDb()
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, targetUserId))
          .limit(1);

        if (!target?.email) {
          logger.warn({ jobId: job.id, targetUserId, queue }, 'Account notice skipped: user has no email');
          return;
        }

        const copy = NOTICE_COPY[queue];
        await emailService.sendMail({
          to: target.email,
          subject: copy.subject,
          html: renderNotice(copy),
        });
        logger.info({ jobId: job.id, targetUserId, queue }, 'Account notice email sent');
      },
    );
  }
  logger.info('Registered platform account notice workers');
}
