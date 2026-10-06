import { and, eq } from 'drizzle-orm';
import { serverEnv } from '@siteflow/env/server';
import { documentEntityLinks, documents, type Document, type DocumentVersion } from '@siteflow/database/schema';
import { auditService } from '../../audit/audit.service.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { generateId } from '../../../lib/id.js';
import { getDb } from '../../../lib/db/index.js';
import { DOCUMENT_QUEUES } from './document.jobs.js';
import { getStorageService } from '../../../lib/storage/index.js';
import { calculateObjectSha256 } from '../../../lib/storage/storage.service.js';
import { DocumentRepository } from './document.repository.js';
import {
  DocumentAccessDeniedError,
  DocumentInvalidCursorError,
  DocumentInvalidStateError,
  DocumentNotFoundError,
  DocumentUploadIncompleteError,
  DocumentVersionConflictError,
} from './document.errors.js';
import type {
  CreateDocumentInput,
  CreateDocumentVersionInput,
  ListDocumentsQuery,
  UpdateDocumentInput,
} from '@siteflow/shared';

export interface DocumentDTO {
  id: string;
  organizationId: string;
  projectId: string;
  category: Document['category'];
  title: string;
  description: string | null;
  status: Document['status'];
  processingStatus: Document['processingStatus'];
  currentVersion: number;
  uploadedBy: string | null;
  fileName: string;
  fileSize: number;
  contentType: string;
  checksum: string | null;
  accessPolicy: Document['accessPolicy'];
  expiryDate: string | null;
  expiresNotified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersionDTO {
  id: string;
  documentId: string;
  versionNumber: number;
  uploadedBy: string | null;
  fileName: string;
  fileSize: number;
  contentType: string;
  checksum: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ProjectDocumentAccess {
  organizationId: string;
  projectId: string;
  projectMembership: { role: string; status: string } | null;
  organizationPermissions: string[];
}

function toDocumentDTO(row: Document): DocumentDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    category: row.category,
    title: row.title,
    description: row.description,
    status: row.status,
    processingStatus: row.processingStatus,
    currentVersion: row.currentVersion,
    uploadedBy: row.uploadedBy,
    fileName: row.fileName,
    fileSize: row.fileSize,
    contentType: row.contentType,
    checksum: row.checksum,
    accessPolicy: row.accessPolicy,
    expiryDate: row.expiryDate,
    expiresNotified: row.expiresNotified,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toVersionDTO(row: DocumentVersion): DocumentVersionDTO {
  return {
    id: row.id,
    documentId: row.documentId,
    versionNumber: row.versionNumber,
    uploadedBy: row.uploadedBy,
    fileName: row.fileName,
    fileSize: row.fileSize,
    contentType: row.contentType,
    checksum: row.checksum,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

function fileExtension(fileName: string): string {
  const suffix = fileName.slice(fileName.lastIndexOf('.') + 1);
  return /^[a-zA-Z0-9_-]{1,16}$/.test(suffix) ? suffix.toLowerCase() : 'bin';
}

function encodeCursor(row: Pick<Document, 'createdAt' | 'id'>): string {
  return Buffer.from(JSON.stringify({ createdAt: row.createdAt.toISOString(), id: row.id })).toString('base64url');
}

function decodeCursor(cursor?: string): { createdAt: Date; id: string } | undefined {
  if (!cursor) return undefined;
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error('Invalid cursor encoding');
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      parsed === null
      || typeof parsed !== 'object'
      || !('createdAt' in parsed)
      || !('id' in parsed)
      || typeof parsed.createdAt !== 'string'
      || typeof parsed.id !== 'string'
      || parsed.id.length === 0
    ) {
      throw new Error('Invalid cursor payload');
    }
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.valueOf())) throw new Error('Invalid cursor timestamp');
    return { createdAt, id: parsed.id };
  } catch {
    throw new DocumentInvalidCursorError();
  }
}

function assertAccessPolicy(row: Document, access: ProjectDocumentAccess): void {
  if (row.accessPolicy === 'PROJECT_MEMBERS') {
    if (!access.projectMembership || access.projectMembership.status !== 'ACTIVE') {
      throw new DocumentAccessDeniedError();
    }
    return;
  }
  if (row.accessPolicy === 'PROJECT_MANAGERS_ONLY') {
    if (
      !access.projectMembership
      || access.projectMembership.status !== 'ACTIVE'
      || !['PROJECT_MANAGER', 'SITE_SUPERVISOR'].includes(access.projectMembership.role)
    ) {
      throw new DocumentAccessDeniedError();
    }
    return;
  }
  if (!access.organizationPermissions.includes('project:admin')) {
    throw new DocumentAccessDeniedError();
  }
}

export class DocumentService {
  constructor(
    private readonly repo = new DocumentRepository(),
    private readonly storage = getStorageService(),
  ) {}

  private get db() {
    return getDb();
  }

  async initiateUpload(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    input: CreateDocumentInput,
  ): Promise<{ document: DocumentDTO; uploadUrl: string }> {
    const id = generateId();
    const storageKey = this.storage.objectKey(
      organizationId,
      projectId,
      input.category,
      id,
      fileExtension(input.fileName),
    );
    const uploadUrl = await this.storage.putPresignedUrl(
      storageKey,
      input.contentType,
      serverEnv.STORAGE_PRESIGN_EXPIRY_SECONDS,
    );
    const row = await this.db.transaction(async (tx) => {
      const document = await this.repo.create(tx, {
        id,
        organizationId,
        projectId,
        category: input.category,
        title: input.title,
        description: input.description ?? null,
        status: 'PENDING_UPLOAD',
        processingStatus: 'NOT_STARTED',
        currentVersion: 1,
        uploadedBy: actorUserId,
        fileName: input.fileName,
        fileSize: input.fileSize,
        contentType: input.contentType,
        accessPolicy: input.accessPolicy ?? 'PROJECT_MEMBERS',
        expiryDate: input.expiryDate ?? null,
        storageKey,
      });
      await auditService.log(
        {
          organizationId,
          actorUserId,
          action: 'document.upload_initiated',
          resourceType: 'document',
          resourceId: id,
          metadata: { projectId, category: input.category },
        },
        tx,
      );
      return document;
    });
    return { document: toDocumentDTO(row), uploadUrl };
  }

  async completeUpload(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    documentId: string,
    checksum: string,
    ipAddress?: string,
  ): Promise<DocumentDTO> {
    const existing = await this.repo.findById(this.db, organizationId, projectId, documentId);
    if (!existing || existing.status === 'DELETED') throw new DocumentNotFoundError(documentId);
    if (existing.status === 'ACTIVE') {
      if (existing.checksum === checksum) return toDocumentDTO(existing);
      throw new DocumentInvalidStateError(existing.status, 'complete upload for');
    }
    if (existing.status !== 'PENDING_UPLOAD' || !existing.storageKey) {
      throw new DocumentInvalidStateError(existing.status, 'complete upload for');
    }

    const object = await this.storage.headObject(existing.storageKey);
    if (
      !object
      || object.size !== existing.fileSize
      || object.contentType.toLowerCase() !== existing.contentType.toLowerCase()
    ) {
      throw new DocumentUploadIncompleteError();
    }

    return this.db.transaction(async (tx) => {
      const row = await this.repo.findByIdForUpdate(tx, organizationId, projectId, documentId);
      if (!row || row.status === 'DELETED') throw new DocumentNotFoundError(documentId);
      if (row.status === 'ACTIVE') {
        if (row.checksum === checksum) return toDocumentDTO(row);
        throw new DocumentInvalidStateError(row.status, 'complete upload for');
      }
      if (row.status !== 'PENDING_UPLOAD' || row.storageKey !== existing.storageKey) {
        throw new DocumentInvalidStateError(row.status, 'complete upload for');
      }
      const storageKey = row.storageKey;
      if (!storageKey) throw new DocumentUploadIncompleteError();

      const updated = await this.repo.update(tx, organizationId, projectId, documentId, {
        status: 'ACTIVE',
        processingStatus: 'PENDING',
        checksum,
      });
      if (!updated) throw new DocumentNotFoundError(documentId);

      const version = await this.repo.createVersion(tx, {
        id: generateId(),
        documentId,
        organizationId,
        versionNumber: 1,
        uploadedBy: actorUserId,
        fileName: row.fileName,
        fileSize: row.fileSize,
        contentType: row.contentType,
        checksum,
        storageKey,
      });
      await this.repo.createAccessLog(tx, {
        id: generateId(),
        organizationId,
        documentId,
        accessedBy: actorUserId,
        accessType: 'UPLOAD_COMPLETE',
        ipAddress: ipAddress ?? null,
      });
      await auditService.log(
        {
          organizationId,
          actorUserId,
          action: 'document.uploaded',
          resourceType: 'document',
          resourceId: documentId,
          metadata: { projectId, versionNumber: version.versionNumber },
        },
        tx,
      );
      await writeOutboxEvent(
        tx,
        DOCUMENT_QUEUES.UPLOADED,
        {
          organizationId,
          projectId,
          documentId,
          versionNumber: 1,
          category: row.category,
        },
        organizationId,
      );
      return toDocumentDTO(updated);
    });
  }

  async listDocuments(
    organizationId: string,
    projectId: string,
    query: ListDocumentsQuery,
  ): Promise<{ data: DocumentDTO[]; nextCursor: string | null }> {
    const rows = await this.repo.listByProject(this.db, {
      organizationId,
      projectId,
      limit: query.limit,
      category: query.category,
      status: query.status,
      cursor: decodeCursor(query.cursor),
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      data: page.map(toDocumentDTO),
      nextCursor: hasMore && page.length > 0 ? encodeCursor(page[page.length - 1]!) : null,
    };
  }

  async getDocument(organizationId: string, projectId: string, documentId: string): Promise<DocumentDTO> {
    const row = await this.repo.findById(this.db, organizationId, projectId, documentId);
    if (!row || row.status === 'DELETED') throw new DocumentNotFoundError(documentId);
    return toDocumentDTO(row);
  }

  async getDownloadUrl(
    actorUserId: string,
    access: ProjectDocumentAccess,
    documentId: string,
    ipAddress?: string,
  ): Promise<{ downloadUrl: string; expiresIn: number }> {
    const row = await this.repo.findById(
      this.db,
      access.organizationId,
      access.projectId,
      documentId,
    );
    if (!row || row.status === 'DELETED') throw new DocumentNotFoundError(documentId);
    if (row.status !== 'ACTIVE' || !row.storageKey || row.processingStatus !== 'COMPLETED') {
      throw new DocumentInvalidStateError(row.status, 'download');
    }
    assertAccessPolicy(row, access);
    const expiresIn = serverEnv.STORAGE_PRESIGN_EXPIRY_SECONDS;
    const downloadUrl = await this.storage.getPresignedUrl(row.storageKey, expiresIn);

    await this.db.transaction(async (tx) => {
      const locked = await this.repo.findByIdForUpdate(
        tx,
        access.organizationId,
        access.projectId,
        documentId,
      );
      if (!locked || locked.status === 'DELETED') throw new DocumentNotFoundError(documentId);
      if (
        locked.status !== 'ACTIVE'
        || !locked.storageKey
        || locked.processingStatus !== 'COMPLETED'
      ) {
        throw new DocumentInvalidStateError(locked.status, 'download');
      }
      assertAccessPolicy(locked, access);
      await this.repo.createAccessLog(tx, {
        id: generateId(),
        organizationId: access.organizationId,
        documentId,
        accessedBy: actorUserId,
        accessType: 'DOWNLOAD',
        ipAddress: ipAddress ?? null,
      });
    });
    return { downloadUrl, expiresIn };
  }

  async updateDocument(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    documentId: string,
    input: UpdateDocumentInput,
  ): Promise<DocumentDTO> {
    return this.db.transaction(async (tx) => {
      const row = await this.repo.findByIdForUpdate(tx, organizationId, projectId, documentId);
      if (!row || row.status === 'DELETED') throw new DocumentNotFoundError(documentId);
      const patch: Record<string, unknown> = {};
      if (input.title !== undefined) patch['title'] = input.title;
      if (input.description !== undefined) patch['description'] = input.description;
      if (input.accessPolicy !== undefined) patch['accessPolicy'] = input.accessPolicy;
      if (input.expiryDate !== undefined) {
        patch['expiryDate'] = input.expiryDate;
        if (input.expiryDate !== row.expiryDate) patch['expiresNotified'] = false;
      }
      const updated = await this.repo.update(
        tx,
        organizationId,
        projectId,
        documentId,
        patch,
      );
      if (!updated) throw new DocumentNotFoundError(documentId);
      await auditService.log(
        {
          organizationId,
          actorUserId,
          action: 'document.updated',
          resourceType: 'document',
          resourceId: documentId,
          metadata: { projectId },
        },
        tx,
      );
      return toDocumentDTO(updated);
    });
  }

  async deleteDocument(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    documentId: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const row = await this.repo.findByIdForUpdate(tx, organizationId, projectId, documentId);
      if (!row) throw new DocumentNotFoundError(documentId);
      if (row.status === 'DELETED') return;
      await this.repo.update(tx, organizationId, projectId, documentId, { status: 'DELETED' });
      await auditService.log(
        {
          organizationId,
          actorUserId,
          action: 'document.deleted',
          resourceType: 'document',
          resourceId: documentId,
          metadata: { projectId },
        },
        tx,
      );
    });
  }

  async initiateNewVersion(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    documentId: string,
    input: CreateDocumentVersionInput,
  ): Promise<{ version: DocumentVersionDTO; uploadUrl: string }> {
    const version = await this.db.transaction(async (tx) => {
      const row = await this.repo.findByIdForUpdate(tx, organizationId, projectId, documentId);
      if (!row || row.status === 'DELETED') throw new DocumentNotFoundError(documentId);
      if (row.status !== 'ACTIVE') throw new DocumentInvalidStateError(row.status, 'create a version for');
      if (row.processingStatus !== 'COMPLETED') {
        throw new DocumentInvalidStateError(row.processingStatus, 'create a version for');
      }

      const nextVersion = row.currentVersion + 1;
      const pending = await this.repo.findVersionByNumber(tx, organizationId, documentId, nextVersion);
      if (pending) {
        if (pending.checksum !== null) throw new DocumentVersionConflictError();
        return pending;
      }

      const versionId = generateId();
      const storageKey = this.storage.objectKey(
        organizationId,
        projectId,
        row.category,
        versionId,
        fileExtension(input.fileName),
      );
      const created = await this.repo.createVersion(tx, {
        id: versionId,
        documentId,
        organizationId,
        versionNumber: nextVersion,
        uploadedBy: actorUserId,
        fileName: input.fileName,
        fileSize: input.fileSize,
        contentType: input.contentType,
        storageKey,
        notes: input.notes ?? null,
      });
      await auditService.log(
        {
          organizationId,
          actorUserId,
          action: 'document.version_upload_initiated',
          resourceType: 'document',
          resourceId: documentId,
          metadata: { projectId, versionNumber: nextVersion },
        },
        tx,
      );
      return created;
    });
    const uploadUrl = await this.storage.putPresignedUrl(
      version.storageKey,
      version.contentType,
      serverEnv.STORAGE_PRESIGN_EXPIRY_SECONDS,
    );
    return { version: toVersionDTO(version), uploadUrl };
  }

  async completeVersion(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    documentId: string,
    versionId: string,
    checksum: string,
    ipAddress?: string,
  ): Promise<{ version: DocumentVersionDTO; document: DocumentDTO }> {
    const currentDocument = await this.repo.findById(this.db, organizationId, projectId, documentId);
    if (!currentDocument || currentDocument.status === 'DELETED') {
      throw new DocumentNotFoundError(documentId);
    }
    const currentVersion = await this.repo.findVersionById(
      this.db,
      organizationId,
      documentId,
      versionId,
    );
    if (!currentVersion) throw new DocumentNotFoundError(documentId);
    if (currentVersion.checksum !== null) {
      if (currentVersion.checksum !== checksum || currentDocument.currentVersion < currentVersion.versionNumber) {
        throw new DocumentVersionConflictError();
      }
      return {
        version: toVersionDTO(currentVersion),
        document: toDocumentDTO(currentDocument),
      };
    }

    const object = await this.storage.headObject(currentVersion.storageKey);
    if (
      !object
      || object.size !== currentVersion.fileSize
      || object.contentType.toLowerCase() !== currentVersion.contentType.toLowerCase()
    ) {
      throw new DocumentUploadIncompleteError();
    }

    return this.db.transaction(async (tx) => {
      const document = await this.repo.findByIdForUpdate(tx, organizationId, projectId, documentId);
      if (!document || document.status === 'DELETED') throw new DocumentNotFoundError(documentId);
      if (document.status !== 'ACTIVE') {
        throw new DocumentInvalidStateError(document.status, 'create a version for');
      }
      const version = await this.repo.findVersionByIdForUpdate(
        tx,
        organizationId,
        documentId,
        versionId,
      );
      if (!version) throw new DocumentNotFoundError(documentId);
      if (version.checksum !== null) {
        if (version.checksum !== checksum || document.currentVersion < version.versionNumber) {
          throw new DocumentVersionConflictError();
        }
        return { version: toVersionDTO(version), document: toDocumentDTO(document) };
      }
      if (version.versionNumber !== document.currentVersion + 1) {
        throw new DocumentVersionConflictError();
      }

      const updatedVersion = await this.repo.updateVersion(
        tx,
        organizationId,
        documentId,
        versionId,
        { checksum },
      );
      const updatedDocument = await this.repo.update(tx, organizationId, projectId, documentId, {
        currentVersion: version.versionNumber,
        processingStatus: 'PENDING',
        processingError: null,
        fileName: version.fileName,
        fileSize: version.fileSize,
        contentType: version.contentType,
        checksum,
        storageKey: version.storageKey,
      });
      if (!updatedVersion || !updatedDocument) throw new DocumentNotFoundError(documentId);

      await this.repo.createAccessLog(tx, {
        id: generateId(),
        organizationId,
        documentId,
        accessedBy: actorUserId,
        accessType: 'VERSION_CREATED',
        ipAddress: ipAddress ?? null,
      });
      await auditService.log(
        {
          organizationId,
          actorUserId,
          action: 'document.version_created',
          resourceType: 'document',
          resourceId: documentId,
          metadata: { projectId, versionNumber: version.versionNumber },
        },
        tx,
      );
      await writeOutboxEvent(
        tx,
        DOCUMENT_QUEUES.VERSION_CREATED,
        { organizationId, projectId, documentId, versionNumber: version.versionNumber },
        organizationId,
      );
      return {
        version: toVersionDTO(updatedVersion),
        document: toDocumentDTO(updatedDocument),
      };
    });
  }

  async listVersions(
    organizationId: string,
    projectId: string,
    documentId: string,
  ): Promise<DocumentVersionDTO[]> {
    const document = await this.repo.findById(this.db, organizationId, projectId, documentId);
    if (!document || document.status === 'DELETED') throw new DocumentNotFoundError(documentId);
    const versions = await this.repo.listVersions(this.db, organizationId, documentId);
    return versions.map(toVersionDTO);
  }

  async processUploadedVersion(
    organizationId: string,
    projectId: string,
    documentId: string,
    versionNumber: number,
  ): Promise<void> {
    const document = await this.repo.findById(
      this.db,
      organizationId,
      projectId,
      documentId,
    );
    if (!document || document.status !== 'ACTIVE') return;
    if (document.currentVersion !== versionNumber) return;
    if (document.processingStatus === 'COMPLETED' || document.processingStatus === 'FAILED') return;

    const version = await this.repo.findVersionByNumber(
      this.db,
      organizationId,
      documentId,
      versionNumber,
    );
    if (!version || !version.checksum) {
      throw new DocumentUploadIncompleteError();
    }

    let shouldProcess = false;
    await this.db.transaction(async (tx) => {
      const locked = await this.repo.findByIdForUpdate(
        tx,
        organizationId,
        projectId,
        documentId,
      );
      if (!locked || locked.status !== 'ACTIVE' || locked.currentVersion !== versionNumber) return;
      if (locked.processingStatus === 'COMPLETED' || locked.processingStatus === 'FAILED') return;
      await this.repo.update(tx, organizationId, projectId, documentId, {
        processingStatus: 'PROCESSING',
        processingError: null,
      });
      shouldProcess = true;
    });
    if (!shouldProcess) return;

    const actualChecksum = await calculateObjectSha256(version.storageKey);
    const checksumMatches = actualChecksum.toLowerCase() === version.checksum.toLowerCase();

    await this.db.transaction(async (tx) => {
      const locked = await this.repo.findByIdForUpdate(
        tx,
        organizationId,
        projectId,
        documentId,
      );
      if (!locked || locked.status !== 'ACTIVE' || locked.currentVersion !== versionNumber) return;
      if (locked.processingStatus === 'COMPLETED' || locked.processingStatus === 'FAILED') return;

      await this.repo.update(tx, organizationId, projectId, documentId, {
        processingStatus: checksumMatches ? 'COMPLETED' : 'FAILED',
        processingError: checksumMatches ? null : 'SHA-256 checksum mismatch',
      });
      await auditService.log(
        {
          organizationId,
          actorUserId: null,
          action: checksumMatches ? 'document.processing_completed' : 'document.processing_failed',
          resourceType: 'document',
          resourceId: documentId,
          metadata: { projectId, versionNumber },
        },
        tx,
      );
    });
    if (!checksumMatches) {
      throw new DocumentUploadIncompleteError();
    }
  }
}

export async function linkDocument(
  tx: any,
  input: {
    orgId: string;
    projectId: string;
    docId: string;
    entityType: string;
    entityId: string;
    createdBy: string;
  },
): Promise<void> {
  const [document] = await tx
    .select({ id: documents.id, status: documents.status })
    .from(documents)
    .where(and(
      eq(documents.id, input.docId),
      eq(documents.organizationId, input.orgId),
      eq(documents.projectId, input.projectId),
    ))
    .limit(1);
  if (!document || document.status !== 'ACTIVE') throw new DocumentNotFoundError(input.docId);
  await tx.insert(documentEntityLinks).values({
    id: generateId(),
    organizationId: input.orgId,
    documentId: input.docId,
    entityType: input.entityType,
    entityId: input.entityId,
    createdBy: input.createdBy,
  }).onConflictDoNothing({
    target: [
      documentEntityLinks.documentId,
      documentEntityLinks.entityType,
      documentEntityLinks.entityId,
    ],
  });
}

export const documentService = new DocumentService();
