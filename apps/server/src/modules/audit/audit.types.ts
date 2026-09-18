// apps/server/src/modules/audit/audit.types.ts
import type { AuditLog, NewAuditLog } from '@siteflow/database/schema';

export type { AuditLog, NewAuditLog };

export interface AuditLogDTO {
  id: string;
  organizationId: string;
  actorUserId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface ListAuditLogsQuery {
  limit?: number;
  offset?: number;
}
