// apps/server/src/modules/organization/sequences/sequences.service.ts
import { trace } from '@opentelemetry/api';
import { createLogger, withSpan } from '@siteflow/observability/server';
import { getDb } from '../../../lib/db/index.js';
import { DocumentSequenceRepository } from './sequences.repository.js';
import { auditService } from '../../audit/audit.service.js';
import { NotFoundError } from '../organization.errors.js';
import type { DocumentSequenceDTO, UpdateSequenceInput, AllocateNextResult, DocumentSequenceType } from './sequences.types.js';
import type { OrganizationContext } from '../../rbac/rbac.types.js';
import type { DocumentSequence } from '@siteflow/database/schema';

const logger = createLogger({ name: 'document-sequence-service' });
const tracer = trace.getTracer('document-sequence-service');

export function toDocumentSequenceDTO(seq: DocumentSequence): DocumentSequenceDTO {
  return {
    id: seq.id,
    organizationId: seq.organizationId,
    type: seq.type as DocumentSequenceType,
    prefix: seq.prefix,
    padding: seq.padding,
    nextValue: seq.nextValue,
    updatedAt: seq.updatedAt.toISOString(),
  };
}

export class DocumentSequenceService {
  constructor(private repo = new DocumentSequenceRepository()) {}

  private get db() {
    return getDb();
  }

  async listSequences(orgId: string): Promise<DocumentSequenceDTO[]> {
    return withSpan(tracer, 'sequences.listSequences', async (span) => {
      span.setAttribute('organization.id', orgId);
      const sequences = await this.repo.findByOrg(orgId);
      return sequences.map(toDocumentSequenceDTO);
    });
  }

  async getSequence(orgId: string, type: DocumentSequenceType): Promise<DocumentSequenceDTO> {
    return withSpan(tracer, 'sequences.getSequence', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('sequence.type', type);
      const seq = await this.repo.findByOrgAndType(orgId, type);
      if (!seq) throw new NotFoundError(`Document sequence '${type}' not found`);
      return toDocumentSequenceDTO(seq);
    });
  }

  async updateSequence(
    orgId: string,
    type: DocumentSequenceType,
    actorCtx: OrganizationContext,
    input: UpdateSequenceInput,
  ): Promise<DocumentSequenceDTO> {
    return withSpan(tracer, 'sequences.updateSequence', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('sequence.type', type);
      span.setAttribute('user.id', actorCtx.userId);
      logger.info({ orgId, type, userId: actorCtx.userId }, 'Updating document sequence config');

      const existing = await this.repo.findByOrgAndType(orgId, type);
      if (!existing) throw new NotFoundError(`Document sequence '${type}' not found`);

      const updated = await this.db.transaction(async (tx) => {
        const result = await this.repo.updateConfig(orgId, type, input, tx);

        await auditService.log(
          {
            organizationId: orgId,
            actorUserId: actorCtx.userId,
            action: 'organization.document_sequence_updated',
            resourceType: 'DocumentSequence',
            resourceId: existing.id,
            metadata: { type, ...input },
          },
          tx,
        );

        return result!;
      });

      return toDocumentSequenceDTO(updated);
    });
  }

  /**
   * Allocates the next sequence number atomically.
   * Must be called inside a transaction passed as `tx`.
   */
  async allocateNext(orgId: string, type: DocumentSequenceType, tx: any): Promise<AllocateNextResult> {
    return withSpan(tracer, 'sequences.allocateNext', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('sequence.type', type);
      return this.repo.allocateNext(orgId, type, tx);
    });
  }
}
