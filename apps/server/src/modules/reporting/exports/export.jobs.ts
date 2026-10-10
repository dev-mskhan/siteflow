// apps/server/src/modules/reporting/exports/export.jobs.ts
// F.17B — Job name constants and payload types for the reporting export worker.

import type { PortfolioActor } from '../report.service.js';

export const EXPORT_QUEUES = {
  GENERATE: 'reporting:export:generate',
  CLEANUP: 'reporting:export:cleanup',
} as const;

export interface ExportGeneratePayload {
  exportId: string;
  organizationId: string;
  projectId: string | null;
  reportType: string;
  filterSnapshot: Record<string, unknown>;
  portfolioActor: PortfolioActor | null;
}

export interface ExportCleanupPayload {
  // No specific payload needed — cleanup runs globally across all expired exports
  triggeredAt?: string;
}
