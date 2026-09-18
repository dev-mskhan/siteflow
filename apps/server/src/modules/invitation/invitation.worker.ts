// apps/server/src/modules/invitation/invitation.worker.ts
import type PgBoss from 'pg-boss';
import { createLogger } from '@siteflow/observability/server';
import { registerWorker } from '../../lib/queue/worker-factory.js';
import { ORG_QUEUES, type SendInvitationEmailPayload } from './invitation.jobs.js';
import { InvitationRepository } from './invitation.repository.js';
import { emailService } from '../../lib/email/email.service.js';

const logger = createLogger({ name: 'invitation-worker' });

export async function registerOrgWorkers(boss: PgBoss): Promise<void> {
  const repository = new InvitationRepository();

  await registerWorker<SendInvitationEmailPayload>(
    boss,
    {
      queue: ORG_QUEUES.SEND_INVITATION_EMAIL,
      concurrency: 5,
      timeoutSecs: 30,
      tenantIdExtractor: (data: SendInvitationEmailPayload) => data.organizationId,
    },
    async (job) => {
      const { invitationId, email, orgName, inviterName, token } = job.data;

      // Idempotency: check invitation is still PENDING before sending
      const invite = await repository.findById(invitationId);
      if (!invite || invite.status !== 'PENDING') {
        logger.info({ invitationId }, 'Invitation no longer PENDING — skipping email send');
        return;
      }

      await emailService.sendInvitationEmail(email, {
        orgName,
        inviterName,
        token,
      });
    },
  );

  logger.info('Registered org module PgBoss workers');
}
