// apps/server/src/modules/invitation/invitation.worker.ts
import type PgBoss from 'pg-boss';
import { createLogger } from '@siteflow/observability/server';
import { registerWorker } from '../../lib/queue/worker-factory.js';
import { ORG_QUEUES, type SendInvitationEmailPayload, type ExpireInvitationsPayload } from './invitation.jobs.js';
import { InvitationRepository } from './invitation.repository.js';
import { emailService } from '../../lib/email/email.service.js';
import { auditService } from '../audit/audit.service.js';
import { getDb } from '../../lib/db/index.js';

const logger = createLogger({ name: 'invitation-worker' });

export async function registerOrgWorkers(boss: PgBoss): Promise<void> {
  const repository = new InvitationRepository();

  // ─── Send Invitation Email ─────────────────────────────────────────────────
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

  // ─── Expire Overdue Invitations ────────────────────────────────────────────
  await registerWorker<ExpireInvitationsPayload>(
    boss,
    {
      queue: ORG_QUEUES.EXPIRE_INVITATIONS,
      concurrency: 1,
      timeoutSecs: 120,
    },
    async (_job) => {
      const db = getDb();
      const overdue = await repository.findOverduePending(100);

      if (overdue.length === 0) {
        logger.debug('No overdue invitations to expire');
        return;
      }

      logger.info({ count: overdue.length }, 'Expiring overdue invitations');

      for (const invite of overdue) {
        try {
          await db.transaction(async (tx) => {
            await repository.updateStatus(invite.id, 'EXPIRED', tx);

            await auditService.log(
              {
                organizationId: invite.organizationId,
                actorUserId: null,
                action: 'invitation.expired',
                resourceType: 'Invitation',
                resourceId: invite.id,
                metadata: { email: invite.email, roleId: invite.roleId, expiresAt: invite.expiresAt.toISOString() },
              },
              tx,
            );
          });
        } catch (err) {
          logger.error({ invitationId: invite.id, err }, 'Failed to expire invitation');
          // Continue processing others
        }
      }

      logger.info({ count: overdue.length }, 'Invitation expiry batch complete');
    },
  );

  logger.info('Registered org module PgBoss workers');
}
