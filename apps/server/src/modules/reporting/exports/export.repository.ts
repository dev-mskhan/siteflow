// apps/server/src/modules/reporting/exports/export.repository.ts
// F.17B — Repository for report export lifecycle records.
// All lookups require trusted organizationId (from authenticated context).

import { eq, and, lt, or, isNull } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import { reportExports, type ReportExportRecord, type NewReportExportRecord } from '@siteflow/database/schema';
import { generateId } from '../../../lib/id.js';
import { serverEnv } from '../../../config/env.js';

export class ExportRepository {
  private get db() {
    return getDb();
  }

  private scope(exportId: string, organizationId: string, projectId: string | null) {
    return and(
      eq(reportExports.id, exportId),
      eq(reportExports.organizationId, organizationId),
      projectId === null ? isNull(reportExports.projectId) : eq(reportExports.projectId, projectId),
    );
  }

  /** Create a new PENDING export record scoped to the organization. */
  async create(params: {
    organizationId: string;
    projectId: string | null;
    requestedBy: string;
    reportType: string;
    filterSnapshot: Record<string, unknown>;
  }): Promise<ReportExportRecord> {
    const id = generateId();
    const expiresAt = new Date(Date.now() + serverEnv.REPORT_EXPORT_RETENTION_HOURS * 60 * 60 * 1000);

    const [record] = await this.db
      .insert(reportExports)
      .values({
        id,
        organizationId: params.organizationId,
        projectId: params.projectId,
        requestedBy: params.requestedBy,
        reportType: params.reportType,
        format: 'csv',
        filterSnapshot: params.filterSnapshot,
        status: 'PENDING',
        expiresAt,
      } satisfies NewReportExportRecord)
      .returning();

    return record!;
  }

  /** Find export by ID, enforcing organization scope. Returns null if not found or wrong org. */
  async findById(exportId: string, organizationId: string): Promise<ReportExportRecord | null> {
    const [record] = await this.db
      .select()
      .from(reportExports)
      .where(and(eq(reportExports.id, exportId), eq(reportExports.organizationId, organizationId)))
      .limit(1);
    return record ?? null;
  }

  /** List exports for a specific user in an organization (most recent first, max 20). */
  async listByUser(organizationId: string, userId: string): Promise<ReportExportRecord[]> {
    return this.db
      .select()
      .from(reportExports)
      .where(and(eq(reportExports.organizationId, organizationId), eq(reportExports.requestedBy, userId)))
      .orderBy(reportExports.createdAt)
      .limit(20);
  }

  /** Transition status to PROCESSING. */
  async markProcessing(exportId: string, organizationId: string, projectId: string | null): Promise<void> {
    await this.db
      .update(reportExports)
      .set({ status: 'PROCESSING', updatedAt: new Date() })
      .where(this.scope(exportId, organizationId, projectId));
  }

  /** Transition status to READY and record the server-generated object key. */
  async markReady(
    exportId: string,
    organizationId: string,
    projectId: string | null,
    objectKey: string,
  ): Promise<void> {
    await this.db
      .update(reportExports)
      .set({ status: 'READY', objectKey, updatedAt: new Date() })
      .where(this.scope(exportId, organizationId, projectId));
  }

  /** Transition status to FAILED and record the error message. */
  async markFailed(
    exportId: string,
    organizationId: string,
    projectId: string | null,
    lastError: string,
  ): Promise<void> {
    await this.db
      .update(reportExports)
      .set({ status: 'FAILED', lastError, updatedAt: new Date() })
      .where(this.scope(exportId, organizationId, projectId));
  }

  /** Transition status to EXPIRED. */
  async markExpired(exportId: string, organizationId: string, projectId: string | null): Promise<void> {
    await this.db
      .update(reportExports)
      .set({ status: 'EXPIRED', updatedAt: new Date() })
      .where(this.scope(exportId, organizationId, projectId));
  }

  /** Find all READY or PENDING exports that have passed their expiresAt timestamp. */
  async findExpired(): Promise<ReportExportRecord[]> {
    const now = new Date();
    return this.db
      .select()
      .from(reportExports)
      .where(
        and(
          lt(reportExports.expiresAt, now),
          or(
            eq(reportExports.status, 'READY'),
            eq(reportExports.status, 'PENDING'),
            eq(reportExports.status, 'PROCESSING'),
          ),
        ),
      );
  }
}

export const exportRepository = new ExportRepository();
