// apps/server/src/modules/audit/audit.service.ts
import { trace } from '@opentelemetry/api';
import { withSpan } from '@siteflow/observability/server';
import { AuditRepository } from './audit.repository.js';
import type { AuditLog, NewAuditLog, AuditLogDTO } from './audit.types.js';

const tracer = trace.getTracer('audit-service');

export function toAuditLogDTO(log: AuditLog): AuditLogDTO {
  return {
    id: log.id,
    organizationId: log.organizationId,
    actorUserId: log.actorUserId,
    action: log.action,
    resourceType: log.resourceType,
    resourceId: log.resourceId,
    metadata: log.metadata,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: log.createdAt.toISOString(),
  };
}

export class AuditService {
  constructor(private repo = new AuditRepository()) {}

  /**
   * Log an audit event. Optional transaction (`tx`) allows this to be part of atomic mutations.
   */
  async log(
    entry: Omit<NewAuditLog, 'id' | 'createdAt'>,
    tx?: any,
  ): Promise<AuditLogDTO> {
    return withSpan(tracer, 'audit.log', async (span) => {
      span.setAttribute('organization.id', entry.organizationId);
      span.setAttribute('audit.action', entry.action);
      if (entry.actorUserId) span.setAttribute('user.id', entry.actorUserId);

      const created = await this.repo.create(entry, tx);
      return toAuditLogDTO(created);
    });
  }

  async listForOrg(
    orgId: string,
    limit = 50,
    offset = 0,
  ): Promise<AuditLogDTO[]> {
    return withSpan(tracer, 'audit.listForOrg', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('query.limit', limit);
      span.setAttribute('query.offset', offset);

      const logs = await this.repo.findByOrganizationId(orgId, limit, offset);
      return logs.map(toAuditLogDTO);
    });
  }
}

export const auditService = new AuditService();
