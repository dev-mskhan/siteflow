import { getDb } from '../../../lib/db/index.js';
import type { DatabaseTransaction } from '@siteflow/database';
import { generateId } from '../../../lib/id.js';
import { writeFinancialAuditEvent } from '../../../lib/commercial/financial-audit.service.js';
import { FINANCIAL_AUDIT_ACTIONS } from '../../../lib/commercial/financial-audit.types.js';
import { assertFinancialActorSeparation } from '../../../lib/commercial/financial-policy.js';
import type {
  MaterialRateResolveQuery,
  MaterialRateVersionCreateInput,
} from '@siteflow/shared';
import { projectPricingRepository } from './pricing.repository.js';
import {
  PricingConflictError,
  PricingNotFoundError,
  PricingValidationError,
} from './pricing.errors.js';

type Scope = {
  organizationId: string;
  projectId: string;
  actorUserId: string;
  requestId: string;
};

type DatabaseTransactionLike = Parameters<typeof writeFinancialAuditEvent>[0];
type PricingDatabase = DatabaseTransaction | ReturnType<typeof getDb>;

export class ProjectPricingService {
  private readonly repository = projectPricingRepository;

  private get db() {
    return getDb();
  }

  async createRateVersion(scope: Scope, input: MaterialRateVersionCreateInput) {
    if (input.scope === 'PROJECT' && input.projectId != null && input.projectId !== scope.projectId) {
      throw new PricingValidationError('projectId must match the project in the route.');
    }
    const projectId = input.scope === 'PROJECT' ? scope.projectId : null;

    return this.db.transaction(async (tx) => {
      const material = await this.repository.lockMaterial(tx, scope.organizationId, input.materialId);
      if (!material) throw new PricingNotFoundError('Material not found.');
      if (material.defaultUnitCode !== input.unitCode) {
        throw new PricingValidationError('Rate unit must match the material default unit.');
      }

      const versionNumber = await this.repository.nextVersionNumber(
        tx,
        scope.organizationId,
        input.materialId,
        input.scope,
        projectId,
      );
      const rate = await this.repository.createRateVersion(tx, {
        id: generateId(),
        organizationId: scope.organizationId,
        materialId: input.materialId,
        scope: input.scope,
        projectId,
        versionNumber,
        unitCode: input.unitCode,
        unitPrice: input.unitPrice,
        currencyCode: input.currencyCode,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        status: 'DRAFT',
        createdBy: scope.actorUserId,
      });
      await this.audit(tx, scope, FINANCIAL_AUDIT_ACTIONS.MATERIAL_RATE_VERSION_CREATED, rate.id, null, {
        status: 'DRAFT',
        versionNumber,
        unitPrice: rate.unitPrice,
      });
      return rate;
    });
  }

  async approveRateVersion(scope: Scope, rateId: string) {
    return this.db.transaction(async (tx) => {
      const existing = await this.requireRate(tx, scope, rateId, true);
      if (existing.status !== 'DRAFT') {
        throw new PricingConflictError('Only draft rate versions can be approved.');
      }
      assertFinancialActorSeparation('approve', {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        actorUserId: scope.actorUserId,
        creatorUserId: existing.createdBy,
        preparerUserId: existing.createdBy,
      });
      await this.repository.lockMaterial(tx, scope.organizationId, existing.materialId);

      const overlap = await this.repository.overlappingApproved(
        tx,
        scope.organizationId,
        existing.materialId,
        existing.scope,
        existing.projectId,
        existing.effectiveFrom,
        existing.effectiveTo,
        existing.id,
      );
      if (overlap) {
        throw new PricingConflictError('An approved rate version already covers this period.');
      }

      const updated = await this.repository.updateRateVersion(tx, scope.organizationId, rateId, {
        status: 'APPROVED',
        approvedBy: scope.actorUserId,
        approvedAt: new Date(),
      });
      await this.audit(tx, scope, FINANCIAL_AUDIT_ACTIONS.MATERIAL_RATE_VERSION_APPROVED, rateId, {
        status: existing.status,
      }, { status: 'APPROVED', versionNumber: existing.versionNumber });
      return updated!;
    });
  }

  async retireRateVersion(scope: Scope, rateId: string, effectiveTo: string) {
    return this.db.transaction(async (tx) => {
      const existing = await this.requireRate(tx, scope, rateId, true);
      if (existing.status !== 'APPROVED') {
        throw new PricingConflictError('Only approved rate versions can be retired.');
      }
      if (effectiveTo <= existing.effectiveFrom) {
        throw new PricingValidationError('effectiveTo must be after effectiveFrom.');
      }
      if (existing.effectiveTo != null && effectiveTo > existing.effectiveTo) {
        throw new PricingValidationError('effectiveTo cannot extend the approved period.');
      }

      const updated = await this.repository.updateRateVersion(tx, scope.organizationId, rateId, {
        status: 'RETIRED',
        effectiveTo,
        retiredAt: new Date(),
      });
      await this.audit(tx, scope, FINANCIAL_AUDIT_ACTIONS.MATERIAL_RATE_VERSION_RETIRED, rateId, {
        status: existing.status,
        effectiveTo: existing.effectiveTo,
      }, { status: 'RETIRED', effectiveTo });
      return updated!;
    });
  }

  async listRateVersions(scope: Scope, materialId: string) {
    const rows = await this.repository.listRateVersions(
      this.db,
      scope.organizationId,
      materialId,
      scope.projectId,
      200,
    );
    return rows.filter((row) => row.scope === 'ORGANIZATION' || row.projectId === scope.projectId);
  }

  async getRateVersion(scope: Scope, rateId: string) {
    return this.requireRate(this.db, scope, rateId);
  }

  async resolveRate(scope: Scope, query: MaterialRateResolveQuery) {
    const accepted = await this.repository.findAcceptedQuoteRate(
      this.db,
      scope.organizationId,
      scope.projectId,
      query.materialId,
      query.asOf,
    );
    if (accepted) {
      return { source: 'ACCEPTED_QUOTE' as const, ...accepted };
    }

    const projectRate = await this.repository.findEffectiveApproved(
      this.db,
      scope.organizationId,
      query.materialId,
      'PROJECT',
      scope.projectId,
      query.asOf,
    );
    if (projectRate) {
      return { source: 'PROJECT_RATE' as const, rateVersion: projectRate };
    }

    const orgRate = await this.repository.findEffectiveApproved(
      this.db,
      scope.organizationId,
      query.materialId,
      'ORGANIZATION',
      null,
      query.asOf,
    );
    if (orgRate) {
      return { source: 'ORGANIZATION_RATE' as const, rateVersion: orgRate };
    }

    throw new PricingNotFoundError('No approved rate is effective for this material and date.');
  }

  private async requireRate(
    db: PricingDatabase,
    scope: Scope,
    rateId: string,
    lock = false,
  ) {
    const rate = await this.repository.findRateVersion(db, scope.organizationId, rateId, lock);
    if (!rate) throw new PricingNotFoundError();
    if (rate.scope === 'PROJECT' && rate.projectId !== scope.projectId) {
      throw new PricingNotFoundError();
    }
    return rate;
  }

  private async audit(
    tx: DatabaseTransactionLike,
    scope: Scope,
    action: string,
    rateId: string,
    previousState: Record<string, unknown> | null,
    newState: Record<string, unknown> | null,
  ) {
    await writeFinancialAuditEvent(tx, {
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      actorUserId: scope.actorUserId,
      action,
      entityType: 'MATERIAL_RATE_VERSION',
      entityId: rateId,
      previousState,
      newState,
      requestId: scope.requestId,
    } as Parameters<typeof writeFinancialAuditEvent>[1]);
  }
}

export const projectPricingService = new ProjectPricingService();
