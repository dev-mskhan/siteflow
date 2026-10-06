import { and, asc, eq, inArray, isNotNull, lte } from 'drizzle-orm';
import {
  complianceRecords,
  documents,
  permits,
} from '@siteflow/database/schema';
import type { ListExpiringItemsQuery } from '@siteflow/shared';
import { serverEnv } from '../../../config/env.js';
import { getDb } from '../../../lib/db/index.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'compliance-expiry-scanner' });

type ExpiringEntityType = 'document' | 'permit' | 'compliance_record';
type ExpiringSource = {
  table: any;
  titleColumn: any;
  entityType: ExpiringEntityType;
  activeStatuses: string[];
};

const expiringSources: ExpiringSource[] = [
  { table: documents, titleColumn: documents.title, entityType: 'document', activeStatuses: ['ACTIVE'] },
  { table: permits, titleColumn: permits.permitType, entityType: 'permit', activeStatuses: ['ISSUED', 'ACTIVE'] },
  { table: complianceRecords, titleColumn: complianceRecords.requirementType, entityType: 'compliance_record', activeStatuses: ['ACTIVE'] },
];

function isoDatePlusDays(days: number, from = new Date()): string {
  const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysUntil(expiryDate: string, from = new Date()): number {
  const today = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const expiry = new Date(`${expiryDate}T00:00:00.000Z`).valueOf();
  return Math.round((expiry - today) / 86_400_000);
}

export interface ExpiringItem {
  entityType: ExpiringEntityType;
  entityId: string;
  title: string;
  expiryDate: string;
  daysUntilExpiry: number;
}

export class ExpiryScannerService {
  private get db() {
    return getDb();
  }

  async listExpiring(scope: {
    organizationId: string;
    projectId: string;
  }, options: ListExpiringItemsQuery): Promise<{ items: ExpiringItem[]; total: number }> {
    const cutoff = isoDatePlusDays(options.days);
    const sources = expiringSources.filter((source) => (
      options.entityType === undefined || source.entityType === options.entityType
    ));
    const resultSets = await Promise.all(sources.map((source) => this.db
      .select({
        entityId: source.table.id,
        expiryDate: source.table.expiryDate,
        title: source.titleColumn,
      })
      .from(source.table)
      .where(and(
        eq(source.table.organizationId, scope.organizationId),
        eq(source.table.projectId, scope.projectId),
        inArray(source.table.status, source.activeStatuses),
        isNotNull(source.table.expiryDate),
        lte(source.table.expiryDate, cutoff),
      ))));
    const items = resultSets.flatMap((rows, index) => rows.map((row) => ({
      entityType: sources[index]!.entityType,
      entityId: row.entityId,
      title: row.title,
      expiryDate: row.expiryDate,
      daysUntilExpiry: daysUntil(row.expiryDate),
    }))).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)
      || a.entityType.localeCompare(b.entityType)
      || a.entityId.localeCompare(b.entityId));
    return { items, total: items.length };
  }

  async scan(daysAhead = serverEnv.EXPIRY_SCAN_DAYS_AHEAD): Promise<number> {
    const cutoff = isoDatePlusDays(daysAhead);
    let emitted = 0;

    for (const source of expiringSources) {
      const candidates = await this.db.select({
        id: source.table.id,
        organizationId: source.table.organizationId,
        projectId: source.table.projectId,
        expiryDate: source.table.expiryDate,
        title: source.titleColumn,
      })
        .from(source.table)
        .where(and(
          inArray(source.table.status, source.activeStatuses),
          isNotNull(source.table.expiryDate),
          lte(source.table.expiryDate, cutoff),
          eq(source.table.expiresNotified, false),
        ))
        .orderBy(asc(source.table.expiryDate))
        .limit(500);

      for (const candidate of candidates) {
        const wasNotified = await this.db.transaction(async (tx) => {
          const [current] = await tx.select({
            id: source.table.id,
            organizationId: source.table.organizationId,
            projectId: source.table.projectId,
            expiryDate: source.table.expiryDate,
            expiresNotified: source.table.expiresNotified,
            status: source.table.status,
            title: source.titleColumn,
          }).from(source.table).where(and(
            eq(source.table.id, candidate.id),
            eq(source.table.organizationId, candidate.organizationId),
            eq(source.table.projectId, candidate.projectId),
            inArray(source.table.status, source.activeStatuses),
            isNotNull(source.table.expiryDate),
            lte(source.table.expiryDate, cutoff),
            eq(source.table.expiresNotified, false),
          )).limit(1).for('update');
          if (!current) return false;

          await writeOutboxEvent(tx, `${source.entityType}.expiring`, {
            organizationId: current.organizationId,
            projectId: current.projectId,
            entityType: source.entityType,
            entityId: current.id,
            expiryDate: current.expiryDate,
            title: current.title,
          }, current.organizationId);
          await tx.update(source.table).set({ expiresNotified: true }).where(and(
            eq(source.table.id, current.id),
            eq(source.table.organizationId, current.organizationId),
            eq(source.table.projectId, current.projectId),
          ));
          return true;
        });
        if (wasNotified) emitted += 1;
      }
    }

    logger.info({ emitted, daysAhead, cutoff }, 'Compliance expiry scan complete');
    return emitted;
  }
}

export const expiryScannerService = new ExpiryScannerService();
