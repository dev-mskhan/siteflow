/**
 * documentApi — Group 9 RTK Query slice.
 *
 * S3 Upload flow (mock bypasses actual S3):
 *   1. initiateUpload → returns { document, uploadUrl }
 *   2. Frontend calls uploadToS3(file, uploadUrl) → returns checksum (skipped in mock)
 *   3. completeUpload({ checksum }) → sets status ACTIVE
 *
 * Version flow:
 *   1. initiateDocumentVersion → returns { version, uploadUrl }
 *   2. uploadToS3 → checksum
 *   3. completeDocumentVersion({ checksum })
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { mockBaseQuery } from './mockBaseQuery';
import type {
  DocumentDTO, DocumentVersionDTO,
  InitiateUploadInput, InitiateVersionInput, UpdateDocumentInput,
  DocumentCategory, DocumentStatus,
} from '../types/documentTypes';
import { MOCK_DOCUMENTS, MOCK_DOCUMENT_VERSIONS } from '../fixtures/document.fixtures';

const delay = (ms = 150) => new Promise<void>((r) => setTimeout(r, ms));

// Fake SHA-256-like checksum for mock
function fakeChecksum(): string {
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export const documentApi = createApi({
  reducerPath: 'documentApi',
  baseQuery: mockBaseQuery,
  tagTypes: ['Document', 'DocumentVersion'],
  endpoints: (build) => ({

    listDocuments: build.query<{ data: DocumentDTO[]; nextCursor: string | null }, { orgId: string; projectId: string; category?: DocumentCategory; status?: DocumentStatus }>({
      queryFn: async ({ projectId, category, status }) => {
        await delay();
        let items = MOCK_DOCUMENTS[projectId] ?? [];
        if (category) items = items.filter((d) => d.category === category);
        if (status) items = items.filter((d) => d.status === status);
        else items = items.filter((d) => d.status !== 'DELETED');
        return { data: { data: items, nextCursor: null } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'Document', id: projectId }],
    }),

    getDocument: build.query<DocumentDTO, { orgId: string; projectId: string; documentId: string }>({
      queryFn: async ({ projectId, documentId }) => {
        await delay(120);
        const doc = (MOCK_DOCUMENTS[projectId] ?? []).find((d) => d.id === documentId);
        if (!doc) return { error: { status: 404, error: 'DOCUMENT_NOT_FOUND' } };
        return { data: doc };
      },
      providesTags: (_r, _e, { documentId }) => [{ type: 'Document', id: documentId }],
    }),

    initiateUpload: build.mutation<{ document: DocumentDTO; uploadUrl: string }, { orgId: string; projectId: string; input: InitiateUploadInput }>({
      queryFn: async ({ orgId, projectId, input }) => {
        await delay(250);
        const now = new Date().toISOString();
        const doc: DocumentDTO = {
          id: `doc_${Date.now()}`,
          organizationId: orgId,
          projectId,
          category: input.category,
          title: input.title,
          description: input.description ?? null,
          status: 'PENDING_UPLOAD',
          processingStatus: 'NOT_STARTED',
          currentVersion: 0,
          uploadedBy: 'usr_01',
          fileName: input.fileName,
          fileSize: input.fileSize,
          contentType: input.contentType,
          checksum: null,
          accessPolicy: input.accessPolicy ?? 'PROJECT_MEMBERS',
          expiryDate: input.expiryDate ?? null,
          expiresNotified: false,
          createdAt: now,
          updatedAt: now,
        };
        MOCK_DOCUMENTS[projectId] = [...(MOCK_DOCUMENTS[projectId] ?? []), doc];
        MOCK_DOCUMENT_VERSIONS[doc.id] = [];
        return { data: { document: doc, uploadUrl: `https://mock-s3.example.com/upload/${doc.id}` } };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Document', id: projectId }],
    }),

    completeUpload: build.mutation<{ document: DocumentDTO }, { orgId: string; projectId: string; documentId: string; checksum: string }>({
      queryFn: async ({ projectId, documentId }) => {
        await delay(300);
        const list = MOCK_DOCUMENTS[projectId] ?? [];
        const doc = list.find((d) => d.id === documentId);
        if (!doc) return { error: { status: 404, error: 'DOCUMENT_NOT_FOUND' } };
        const now = new Date().toISOString();
        const checksum = fakeChecksum();
        const updated: DocumentDTO = {
          ...doc,
          status: 'ACTIVE',
          processingStatus: 'COMPLETED',
          currentVersion: 1,
          checksum,
          updatedAt: now,
        };
        MOCK_DOCUMENTS[projectId] = list.map((d) => d.id === documentId ? updated : d);
        // Add version record
        MOCK_DOCUMENT_VERSIONS[documentId] = [{
          id: `ver_${Date.now()}`,
          documentId,
          versionNumber: 1,
          uploadedBy: 'usr_01',
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          contentType: doc.contentType,
          checksum,
          notes: null,
          createdAt: now,
        }];
        return { data: { document: updated } };
      },
      invalidatesTags: (_r, _e, { projectId, documentId }) => [
        { type: 'Document', id: documentId }, { type: 'Document', id: projectId },
      ],
    }),

    updateDocument: build.mutation<{ document: DocumentDTO }, { orgId: string; projectId: string; documentId: string; input: UpdateDocumentInput }>({
      queryFn: async ({ projectId, documentId, input }) => {
        await delay(180);
        const list = MOCK_DOCUMENTS[projectId] ?? [];
        const doc = list.find((d) => d.id === documentId);
        if (!doc) return { error: { status: 404, error: 'DOCUMENT_NOT_FOUND' } };
        const updated = { ...doc, ...input, updatedAt: new Date().toISOString() };
        MOCK_DOCUMENTS[projectId] = list.map((d) => d.id === documentId ? updated : d);
        return { data: { document: updated } };
      },
      invalidatesTags: (_r, _e, { projectId, documentId }) => [
        { type: 'Document', id: documentId }, { type: 'Document', id: projectId },
      ],
    }),

    deleteDocument: build.mutation<void, { orgId: string; projectId: string; documentId: string }>({
      queryFn: async ({ projectId, documentId }) => {
        await delay(180);
        const list = MOCK_DOCUMENTS[projectId] ?? [];
        MOCK_DOCUMENTS[projectId] = list.map((d) =>
          d.id === documentId ? { ...d, status: 'DELETED', updatedAt: new Date().toISOString() } : d,
        );
        return { data: undefined };
      },
      invalidatesTags: (_r, _e, { projectId, documentId }) => [
        { type: 'Document', id: documentId }, { type: 'Document', id: projectId },
      ],
    }),

    getDownloadUrl: build.query<{ downloadUrl: string; expiresIn: number }, { orgId: string; projectId: string; documentId: string }>({
      queryFn: async ({ documentId }) => {
        await delay(100);
        return { data: { downloadUrl: `https://mock-s3.example.com/download/${documentId}?expires=3600`, expiresIn: 3600 } };
      },
    }),

    listDocumentVersions: build.query<{ versions: DocumentVersionDTO[] }, { orgId: string; projectId: string; documentId: string }>({
      queryFn: async ({ documentId }) => {
        await delay(120);
        return { data: { versions: MOCK_DOCUMENT_VERSIONS[documentId] ?? [] } };
      },
      providesTags: (_r, _e, { documentId }) => [{ type: 'DocumentVersion', id: documentId }],
    }),

    initiateDocumentVersion: build.mutation<{ version: DocumentVersionDTO; uploadUrl: string }, { orgId: string; projectId: string; documentId: string; input: InitiateVersionInput }>({
      queryFn: async ({ documentId, input }) => {
        await delay(250);
        const existing = MOCK_DOCUMENT_VERSIONS[documentId] ?? [];
        const versionNumber = (existing[existing.length - 1]?.versionNumber ?? 0) + 1;
        const now = new Date().toISOString();
        const version: DocumentVersionDTO = {
          id: `ver_${Date.now()}`,
          documentId,
          versionNumber,
          uploadedBy: 'usr_01',
          fileName: input.fileName,
          fileSize: input.fileSize,
          contentType: input.contentType,
          checksum: null,
          notes: input.notes ?? null,
          createdAt: now,
        };
        MOCK_DOCUMENT_VERSIONS[documentId] = [...existing, version];
        return { data: { version, uploadUrl: `https://mock-s3.example.com/upload/${documentId}/v${versionNumber}` } };
      },
      invalidatesTags: (_r, _e, { documentId }) => [{ type: 'DocumentVersion', id: documentId }],
    }),

    completeDocumentVersion: build.mutation<{ version: DocumentVersionDTO; document: DocumentDTO }, { orgId: string; projectId: string; documentId: string; versionId: string; checksum: string }>({
      queryFn: async ({ projectId, documentId, versionId }) => {
        await delay(300);
        const checksum = fakeChecksum();
        const now = new Date().toISOString();
        const versions = MOCK_DOCUMENT_VERSIONS[documentId] ?? [];
        const ver = versions.find((v) => v.id === versionId);
        if (!ver) return { error: { status: 404, error: 'VERSION_NOT_FOUND' } };
        const updated = { ...ver, checksum };
        MOCK_DOCUMENT_VERSIONS[documentId] = versions.map((v) => v.id === versionId ? updated : v);
        const list = MOCK_DOCUMENTS[projectId] ?? [];
        const doc = list.find((d) => d.id === documentId);
        if (doc) {
          const updatedDoc = { ...doc, currentVersion: ver.versionNumber, checksum, updatedAt: now };
          MOCK_DOCUMENTS[projectId] = list.map((d) => d.id === documentId ? updatedDoc : d);
          return { data: { version: updated, document: updatedDoc } };
        }
        return { data: { version: updated, document: doc! } };
      },
      invalidatesTags: (_r, _e, { projectId, documentId }) => [
        { type: 'DocumentVersion', id: documentId },
        { type: 'Document', id: documentId },
        { type: 'Document', id: projectId },
      ],
    }),
  }),
});

export const {
  useListDocumentsQuery,
  useGetDocumentQuery,
  useInitiateUploadMutation,
  useCompleteUploadMutation,
  useUpdateDocumentMutation,
  useDeleteDocumentMutation,
  useGetDownloadUrlQuery,
  useListDocumentVersionsQuery,
  useInitiateDocumentVersionMutation,
  useCompleteDocumentVersionMutation,
} = documentApi;
