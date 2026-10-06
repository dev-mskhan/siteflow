import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Document, DocumentVersion } from '@siteflow/database/schema';
import type { StorageService } from '../../../src/lib/storage/storage.interface.js';
import { DocumentRepository } from '../../../src/modules/project/documents/document.repository.js';
import { DocumentService } from '../../../src/modules/project/documents/document.service.js';
import { DocumentAccessDeniedError, DocumentNotFoundError } from '../../../src/modules/project/documents/document.errors.js';
import { DOCUMENT_QUEUES } from '../../../src/modules/project/documents/document.jobs.js';

const { database } = vi.hoisted(() => ({
  database: { transaction: vi.fn() },
}));

vi.mock('../../../src/lib/db/index.js', () => ({
  getDb: () => database,
}));

vi.mock('../../../src/modules/audit/audit.service.js', () => ({
  auditService: { log: vi.fn() },
}));

vi.mock('../../../src/lib/outbox/outbox.service.js', () => ({
  writeOutboxEvent: vi.fn(),
}));

function documentFixture(overrides: Partial<Document> = {}): Document {
  return {
    id: 'document-1',
    organizationId: 'organization-1',
    projectId: 'project-1',
    category: 'REPORT',
    title: 'Progress report',
    description: null,
    status: 'ACTIVE',
    processingStatus: 'COMPLETED',
    processingError: null,
    currentVersion: 1,
    uploadedBy: 'user-1',
    fileName: 'report.pdf',
    fileSize: 100,
    contentType: 'application/pdf',
    checksum: 'a'.repeat(64),
    storageKey: 'organization-1/project-1/REPORT/2026/10/file-1.pdf',
    accessPolicy: 'PROJECT_MEMBERS',
    expiryDate: null,
    expiresNotified: false,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides,
  };
}

function versionFixture(overrides: Partial<DocumentVersion> = {}): DocumentVersion {
  return {
    id: 'version-1',
    documentId: 'document-1',
    organizationId: 'organization-1',
    versionNumber: 1,
    uploadedBy: 'user-1',
    fileName: 'report.pdf',
    fileSize: 100,
    contentType: 'application/pdf',
    checksum: 'a'.repeat(64),
    storageKey: 'organization-1/project-1/REPORT/2026/10/file-1.pdf',
    notes: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('DocumentService', () => {
  const repo = new DocumentRepository();
  const storage: StorageService = {
    putPresignedUrl: vi.fn().mockResolvedValue('https://storage.test/upload'),
    getPresignedUrl: vi.fn().mockResolvedValue('https://storage.test/download'),
    deleteObject: vi.fn(),
    headObject: vi.fn().mockResolvedValue({
      size: 100,
      etag: 'etag',
      contentType: 'application/pdf',
    }),
    objectKey: vi.fn().mockReturnValue(
      'organization-1/project-1/REPORT/2026/10/file-2.pdf',
    ),
  };
  const service = new DocumentService(repo, storage);

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(storage.putPresignedUrl).mockResolvedValue('https://storage.test/upload');
    vi.mocked(storage.getPresignedUrl).mockResolvedValue('https://storage.test/download');
    vi.mocked(storage.headObject).mockResolvedValue({
      size: 100,
      etag: 'etag',
      contentType: 'application/pdf',
    });
    vi.mocked(database.transaction).mockImplementation(async (callback) => callback({}));
  });

  it('returns 404 for a document outside the requested tenant without signing a URL', async () => {
    vi.spyOn(DocumentRepository.prototype, 'findById').mockResolvedValue(undefined);

    await expect(
      service.getDownloadUrl(
        'user-1',
        {
          organizationId: 'organization-2',
          projectId: 'project-2',
          projectMembership: { role: 'PROJECT_MANAGER', status: 'ACTIVE' },
          organizationPermissions: [],
        },
        'document-from-another-organization',
      ),
    ).rejects.toBeInstanceOf(DocumentNotFoundError);

    expect(storage.getPresignedUrl).not.toHaveBeenCalled();
  });

  it('blocks project members from downloading manager-only documents', async () => {
    vi.spyOn(DocumentRepository.prototype, 'findById').mockResolvedValue(
      documentFixture({ accessPolicy: 'PROJECT_MANAGERS_ONLY' }),
    );

    await expect(
      service.getDownloadUrl(
        'user-1',
        {
          organizationId: 'organization-1',
          projectId: 'project-1',
          projectMembership: { role: 'PROJECT_MEMBER', status: 'ACTIVE' },
          organizationPermissions: [],
        },
        'document-1',
      ),
    ).rejects.toBeInstanceOf(DocumentAccessDeniedError);

    expect(storage.getPresignedUrl).not.toHaveBeenCalled();
  });

  it('blocks non-admin users from downloading admin-only documents', async () => {
    vi.spyOn(DocumentRepository.prototype, 'findById').mockResolvedValue(
      documentFixture({ accessPolicy: 'ADMIN_ONLY' }),
    );

    await expect(
      service.getDownloadUrl(
        'user-1',
        {
          organizationId: 'organization-1',
          projectId: 'project-1',
          projectMembership: { role: 'PROJECT_MANAGER', status: 'ACTIVE' },
          organizationPermissions: [],
        },
        'document-1',
      ),
    ).rejects.toBeInstanceOf(DocumentAccessDeniedError);

    expect(storage.getPresignedUrl).not.toHaveBeenCalled();
  });

  it('completes a verified upload and emits the document-uploaded queue event', async () => {
    const pendingDocument = documentFixture({
      status: 'PENDING_UPLOAD',
      processingStatus: 'NOT_STARTED',
      checksum: null,
    });
    vi.spyOn(DocumentRepository.prototype, 'findById').mockResolvedValue(pendingDocument);
    vi.spyOn(DocumentRepository.prototype, 'findByIdForUpdate').mockResolvedValue(pendingDocument);
    vi.spyOn(DocumentRepository.prototype, 'update').mockResolvedValue(
      documentFixture({ processingStatus: 'PENDING' }),
    );
    vi.spyOn(DocumentRepository.prototype, 'createVersion').mockResolvedValue(versionFixture());
    vi.spyOn(DocumentRepository.prototype, 'createAccessLog').mockResolvedValue();

    const document = await service.completeUpload(
      'user-1',
      'organization-1',
      'project-1',
      'document-1',
      'a'.repeat(64),
    );

    expect(document.status).toBe('ACTIVE');
    expect(document.processingStatus).toBe('PENDING');
    const { writeOutboxEvent } = await import('../../../src/lib/outbox/outbox.service.js');
    expect(writeOutboxEvent).toHaveBeenCalledWith(
      {},
      DOCUMENT_QUEUES.UPLOADED,
      expect.objectContaining({
        organizationId: 'organization-1',
        projectId: 'project-1',
        documentId: 'document-1',
        versionNumber: 1,
      }),
      'organization-1',
    );
  });

  it('creates a new version without changing the current document storage key', async () => {
    const currentDocument = documentFixture();
    const createdVersion = versionFixture({
      id: 'version-2',
      versionNumber: 2,
      checksum: null,
      storageKey: 'organization-1/project-1/REPORT/2026/10/file-2.pdf',
    });
    vi.spyOn(DocumentRepository.prototype, 'findByIdForUpdate').mockResolvedValue(currentDocument);
    vi.spyOn(DocumentRepository.prototype, 'findVersionByNumber').mockResolvedValue(undefined);
    vi.spyOn(DocumentRepository.prototype, 'createVersion').mockResolvedValue(createdVersion);
    const updateSpy = vi.spyOn(DocumentRepository.prototype, 'update');

    const result = await service.initiateNewVersion(
      'user-1',
      'organization-1',
      'project-1',
      'document-1',
      { fileName: 'report-v2.pdf', fileSize: 120, contentType: 'application/pdf' },
    );

    expect(result.version.versionNumber).toBe(2);
    expect(currentDocument.storageKey).toBe(
      'organization-1/project-1/REPORT/2026/10/file-1.pdf',
    );
    expect(updateSpy).not.toHaveBeenCalled();
    expect(storage.putPresignedUrl).toHaveBeenCalledWith(
      createdVersion.storageKey,
      createdVersion.contentType,
      expect.any(Number),
    );
  });
});
