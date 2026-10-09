// apps/server/src/modules/reporting/subcontractor/subcontractor-report.repository.ts
// F.15 — Repository for subcontractor report facts.
// Scoped strictly by organizationId and projectId.

import { getDb } from '../../../lib/db/index.js';
import {
  projectSubcontractors,
  subcontractorTaskAssignments,
  purchaseOrders,
} from '@siteflow/database/schema';
import { and, eq, count } from 'drizzle-orm';

export interface SubcontractorFacts {
  activeSubcontractorCount: number;
  totalTaskAssignments: number;
  purchaseOrderCount: number;
}

export class SubcontractorReportRepository {
  private get db() {
    return getDb();
  }

  async getSubcontractorFacts(
    organizationId: string,
    projectId: string,
  ): Promise<SubcontractorFacts> {
    const [subRows, taskRows, poRows] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(projectSubcontractors)
        .where(
          and(
            eq(projectSubcontractors.organizationId, organizationId),
            eq(projectSubcontractors.projectId, projectId),
          ),
        ),

      this.db
        .select({ count: count() })
        .from(subcontractorTaskAssignments)
        .where(
          and(
            eq(subcontractorTaskAssignments.organizationId, organizationId),
            eq(subcontractorTaskAssignments.projectId, projectId),
          ),
        ),

      this.db
        .select({ count: count() })
        .from(purchaseOrders)
        .where(
          and(
            eq(purchaseOrders.organizationId, organizationId),
            eq(purchaseOrders.projectId, projectId),
          ),
        ),
    ]);

    return {
      activeSubcontractorCount: Number(subRows[0]?.count ?? 0),
      totalTaskAssignments: Number(taskRows[0]?.count ?? 0),
      purchaseOrderCount: Number(poRows[0]?.count ?? 0),
    };
  }
}
