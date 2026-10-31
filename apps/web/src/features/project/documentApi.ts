/**
 * documentApi — Live integration for document management.
 * LIVE INTEGRATION: Connected to real backend via baseApi.injectEndpoints.
 *
 * Upload flow:
 *   1. initiateUpload → { document, uploadUrl }
 *   2. PUT to uploadUrl (handled by frontend)
 *   3. completeUpload({ checksum }) → activates document
 */
import { baseApi } from '../../services/baseApi';
import type {
  DocumentDTO,
  DocumentVersionDTO,
  InitiateUploadInput,
  InitiateVersionInput,
  UpdateDocumentInput,
  DocumentCategory,
  DocumentStatus,
} from '../../types/documentTypes';

interface OrgProjectArgs {
  orgId: string;
  projectId: string;
}

export const documentApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    // ── Documents ──────────────────────────────────────────────────────────

    listDocuments: build.query<
      { data: DocumentDTO[]; nextCursor: string | null },
      OrgProjectArgs & { category?: DocumentCategory; status?: DocumentStatus; cursor?: string }
    >({
      query: ({ orgId, projectId, category, status, cursor }) => {
        const params = new URLSearchParams();
        if (category) params.set('category', category);
        if (status) params.set('status', status);
        if (cursor) params.set('cursor', cursor);
        const query = params.toString() ? `?${params.toString()}` : '';
        return `/organizations/${orgId}/projects/${projectId}/documents${query}`;
      },
      transformResponse: (raw: {
        data: { data: DocumentDTO[]; nextCursor: string | null };
      }) => ({
        data: raw.data.data,
        nextCursor: raw.data.nextCursor,
      }),
      providesTags: (_r, _e, { projectId }) => [{ type: 'Document', id: projectId }],
    }),

    getDocument: build.query<DocumentDTO, OrgProjectArgs & { documentId: string }>({
      query: ({ orgId, projectId, documentId }) =>
        `/organizations/${orgId}/projects/${projectId}/documents/${documentId}`,
      transformResponse: (raw: { data: { document: DocumentDTO } }) => raw.data.document,
      providesTags: (_r, _e, { documentId }) => [{ type: 'Document', id: documentId }],
    }),

    initiateUpload: build.mutation<
      { document: DocumentDTO; uploadUrl: string },
      OrgProjectArgs & { input: InitiateUploadInput }
    >({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/documents`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: { document: DocumentDTO; uploadUrl: string } }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Document', id: projectId }],
    }),

    completeUpload: build.mutation<
      DocumentDTO,
      OrgProjectArgs & { documentId: string; checksum: string }
    >({
      query: ({ orgId, projectId, documentId, checksum }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/documents/${documentId}/complete`,
        method: 'POST',
        body: { checksum },
      }),
      transformResponse: (raw: { data: { document: DocumentDTO } }) => raw.data.document,
      invalidatesTags: (_r, _e, { documentId, projectId }) => [
        { type: 'Document', id: documentId },
        { type: 'Document', id: projectId },
      ],
    }),

    updateDocument: build.mutation<
      DocumentDTO,
      OrgProjectArgs & { documentId: string; input: UpdateDocumentInput }
    >({
      query: ({ orgId, projectId, documentId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/documents/${documentId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (raw: { data: DocumentDTO }) => raw.data,
      invalidatesTags: (_r, _e, { documentId }) => [{ type: 'Document', id: documentId }],
    }),

    deleteDocument: build.mutation<void, OrgProjectArgs & { documentId: string }>({
      query: ({ orgId, projectId, documentId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/documents/${documentId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { documentId, projectId }) => [
        { type: 'Document', id: documentId },
        { type: 'Document', id: projectId },
      ],
    }),

    // ── Document Versions ──────────────────────────────────────────────────

    listDocumentVersions: build.query<
      { versions: DocumentVersionDTO[] },
      OrgProjectArgs & { documentId: string }
    >({
      query: ({ orgId, projectId, documentId }) =>
        `/organizations/${orgId}/projects/${projectId}/documents/${documentId}/versions`,
      transformResponse: (raw: { data: { versions: DocumentVersionDTO[] } }) => raw.data,
      providesTags: (_r, _e, { documentId }) => [{ type: 'DocumentVersion', id: documentId }],
    }),

    initiateDocumentVersion: build.mutation<
      { version: DocumentVersionDTO; uploadUrl: string },
      OrgProjectArgs & { documentId: string; input: InitiateVersionInput }
    >({
      query: ({ orgId, projectId, documentId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/documents/${documentId}/versions`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: { version: DocumentVersionDTO; uploadUrl: string } }) => raw.data,
      invalidatesTags: (_r, _e, { documentId }) => [{ type: 'DocumentVersion', id: documentId }],
    }),

    completeDocumentVersion: build.mutation<
      DocumentVersionDTO,
      OrgProjectArgs & { documentId: string; versionId: string; checksum: string }
    >({
      query: ({ orgId, projectId, documentId, versionId, checksum }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/documents/${documentId}/versions/${versionId}/complete`,
        method: 'POST',
        body: { checksum },
      }),
      transformResponse: (raw: { data: { version: DocumentVersionDTO; document: DocumentDTO } }) =>
        raw.data.version,
      invalidatesTags: (_r, _e, { documentId }) => [
        { type: 'DocumentVersion', id: documentId },
        { type: 'Document', id: documentId },
      ],
    }),

  }),
  overrideExisting: false,
});

export const {
  useListDocumentsQuery,
  useGetDocumentQuery,
  useInitiateUploadMutation,
  useCompleteUploadMutation,
  useUpdateDocumentMutation,
  useDeleteDocumentMutation,
  useListDocumentVersionsQuery,
  useInitiateDocumentVersionMutation,
  useCompleteDocumentVersionMutation,
} = documentApi;
