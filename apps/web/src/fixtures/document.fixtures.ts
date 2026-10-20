import type { DocumentDTO, DocumentVersionDTO } from '../types/documentTypes';

export const MOCK_DOCUMENTS: Record<string, DocumentDTO[]> = {
  proj_01: [
    { id: 'doc_01', organizationId: 'org_01', projectId: 'proj_01', category: 'DRAWING', title: 'Foundation Layout Plan', description: 'Structural foundation layout — Rev C', status: 'ACTIVE', processingStatus: 'COMPLETED', currentVersion: 2, uploadedBy: 'usr_01', fileName: 'foundation-layout-rev-c.pdf', fileSize: 2457600, contentType: 'application/pdf', checksum: 'a3f8c1d2e4b7f9a1c3d5e7b2f4a6c8d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3', accessPolicy: 'PROJECT_MEMBERS', expiryDate: null, expiresNotified: false, createdAt: '2024-01-15T08:00:00.000Z', updatedAt: '2024-02-10T10:00:00.000Z' },
    { id: 'doc_02', organizationId: 'org_01', projectId: 'proj_01', category: 'PERMIT', title: 'Building Permit 2024-B-041', description: null, status: 'ACTIVE', processingStatus: 'COMPLETED', currentVersion: 1, uploadedBy: 'usr_01', fileName: 'building-permit-2024-B-041.pdf', fileSize: 891904, contentType: 'application/pdf', checksum: 'b2e4a6c8d1f3a5b7c9e1d3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5', accessPolicy: 'PROJECT_MANAGERS_ONLY', expiryDate: '2025-06-30', expiresNotified: false, createdAt: '2024-01-20T09:00:00.000Z', updatedAt: '2024-01-20T09:00:00.000Z' },
    { id: 'doc_03', organizationId: 'org_01', projectId: 'proj_01', category: 'SPECIFICATION', title: 'Structural Steel Specification', description: 'Spec for high-tensile steel columns', status: 'ACTIVE', processingStatus: 'COMPLETED', currentVersion: 1, uploadedBy: 'usr_01', fileName: 'structural-steel-spec.pdf', fileSize: 1548288, contentType: 'application/pdf', checksum: 'c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9e1d3f5a7b9c1d3', accessPolicy: 'PROJECT_MEMBERS', expiryDate: null, expiresNotified: false, createdAt: '2024-02-01T08:30:00.000Z', updatedAt: '2024-02-01T08:30:00.000Z' },
  ],
};

export const MOCK_DOCUMENT_VERSIONS: Record<string, DocumentVersionDTO[]> = {
  doc_01: [
    { id: 'ver_01', documentId: 'doc_01', versionNumber: 1, uploadedBy: 'usr_01', fileName: 'foundation-layout-rev-b.pdf', fileSize: 2200000, contentType: 'application/pdf', checksum: 'd1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9e1d3', notes: 'Initial upload Rev B', createdAt: '2024-01-15T08:00:00.000Z' },
    { id: 'ver_02', documentId: 'doc_01', versionNumber: 2, uploadedBy: 'usr_01', fileName: 'foundation-layout-rev-c.pdf', fileSize: 2457600, contentType: 'application/pdf', checksum: 'a3f8c1d2e4b7f9a1c3d5e7b2f4a6c8d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3', notes: 'Updated column grid spacing per RFI-001 response', createdAt: '2024-02-10T10:00:00.000Z' },
  ],
  doc_02: [
    { id: 'ver_03', documentId: 'doc_02', versionNumber: 1, uploadedBy: 'usr_01', fileName: 'building-permit-2024-B-041.pdf', fileSize: 891904, contentType: 'application/pdf', checksum: 'b2e4a6c8d1f3a5b7c9e1d3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5', notes: null, createdAt: '2024-01-20T09:00:00.000Z' },
  ],
  doc_03: [
    { id: 'ver_04', documentId: 'doc_03', versionNumber: 1, uploadedBy: 'usr_01', fileName: 'structural-steel-spec.pdf', fileSize: 1548288, contentType: 'application/pdf', checksum: 'c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9e1d3f5a7b9c1d3', notes: null, createdAt: '2024-02-01T08:30:00.000Z' },
  ],
};
