// apps/server/src/modules/billing/feature-gate.middleware.ts
// Feature gate middleware — checks plan feature flags before allowing access

import type { FastifyRequest, FastifyReply } from 'fastify';
import { entitlementService } from './entitlement.service.js';
import { getDb } from '../../lib/db/index.js';
import type { PlanLimits } from '@siteflow/shared';

/**
 * Feature gate middleware factory.
 * Checks if the organization's current plan includes the specified feature.
 * Must be used AFTER organizationContext middleware (requires req.organizationId).
 * Can be used standalone or chained with permission checks.
 */
export function requirePlanFeature(feature: keyof PlanLimits['features']) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const organizationId = (request as any).organizationId;
    
    if (!organizationId) {
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Feature gate middleware requires organizationContext',
      });
    }

    try {
      await entitlementService.assertPlanFeature(organizationId, feature, getDb());
    } catch (err: any) {
      if (err.entitlementCode === 'FEATURE_RESTRICTED' || err.entitlementCode === 'NO_ENTITLEMENT') {
        return reply.code(403).send({
          error: 'Forbidden',
          code: err.entitlementCode,
          message: err.message,
          metadata: err.metadata,
        });
      }
      throw err;
    }
  };
}
