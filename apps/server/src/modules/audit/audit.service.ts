// apps/server/src/modules/audit/audit.service.ts
import { AuditRepository } from './audit.repository.js';
import type { AuditLog, NewAuditLog, AuditLogDTO } from './audit.types.js';

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
    const created = await this.repo.create(entry, tx);
    return toAuditLogDTO(created);
  }

  async listForOrg(
    orgId: string,
    limit = 50,
    offset = 0,
  ): Promise<AuditLogDTO[]> {
    const logs = await this.repo.findByOrganizationId(orgId, limit, offset);
    return logs.map(toAuditLogDTO);
  }
}

export const auditService = new AuditService();
