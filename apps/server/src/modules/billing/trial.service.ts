// apps/server/src/modules/billing/trial.service.ts
import { getDb } from '../../lib/db/index.js';
import type { TrialRepository } from './trial.repository.js';
import { trialRepository } from './trial.repository.js';
import type { AuditService } from '../audit/audit.service.js';
import { auditService } from '../audit/audit.service.js';
import type { TrialDTO } from '@siteflow/shared';
import type { SaasTrial } from '@siteflow/database/schema';

export function toTrialDTO(trial: SaasTrial): TrialDTO {
  return {
    id: trial.id,
    organizationId: trial.organizationId,
    tier: trial.tier,
    status: trial.status as TrialDTO['status'],
    startedAt: trial.startedAt.toISOString(),
    expiresAt: trial.expiresAt.toISOString(),
    createdAt: trial.createdAt.toISOString(),
    updatedAt: trial.updatedAt.toISOString(),
  };
}

export class TrialService {
  constructor(
    private repo: TrialRepository = trialRepository,
    private audit: AuditService = auditService,
  ) {}

  async provisionTrial(params: {
    organizationId: string;
    actorUserId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<{ trial: TrialDTO; isNew: boolean }> {
    const db = getDb();

    try {
      return await db.transaction(async (tx) => {
        // 1. Idempotency check: see if organization already has a trial
        const existing = await this.repo.findByOrganizationId(params.organizationId, tx);
        if (existing) {
          return { trial: toTrialDTO(existing), isNew: false };
        }

        // 2. Provision new 14-day no-card trial
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

        const created = await this.repo.create(
          {
            id: crypto.randomUUID(),
            organizationId: params.organizationId,
            tier: 'Professional',
            status: 'ACTIVE',
            startedAt: now,
            expiresAt,
          },
          tx,
        );

        // 3. Atomically persist audit record
        await this.audit.log(
          {
            organizationId: params.organizationId,
            actorUserId: params.actorUserId,
            action: 'billing.trial.started',
            resourceType: 'SaaSTrial',
            resourceId: created.id,
            metadata: {
              tier: created.tier,
              durationDays: 14,
              expiresAt: created.expiresAt.toISOString(),
            },
            ipAddress: params.ipAddress ?? null,
            userAgent: params.userAgent ?? null,
          },
          tx,
        );

        return { trial: toTrialDTO(created), isNew: true };
      });
    } catch (err: any) {
      // Concurrency race: if unique constraint on organizationId tripped, retrieve existing winner
      if (err?.code === '23505' || err?.message?.includes('saas_trials_org_unique_idx') || err?.constraint === 'saas_trials_org_unique_idx') {
        const existing = await this.repo.findByOrganizationId(params.organizationId);
        if (existing) {
          return { trial: toTrialDTO(existing), isNew: false };
        }
      }
      throw err;
    }
  }

  async getTrial(organizationId: string): Promise<TrialDTO | null> {
    const trial = await this.repo.findByOrganizationId(organizationId);
    if (!trial) {
      return null;
    }

    // Auto-expire check
    if (trial.status === 'ACTIVE' && new Date() > trial.expiresAt) {
      const updated = await this.repo.updateStatus(trial.id, 'EXPIRED');
      return toTrialDTO(updated);
    }

    return toTrialDTO(trial);
  }
}

export const trialService = new TrialService();
