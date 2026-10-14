/**
 * sequenceApi — Document sequence endpoints
 *   GET    /organizations/:orgId/document-sequences
 *   GET    /organizations/:orgId/document-sequences/:type
 *   PATCH  /organizations/:orgId/document-sequences/:type
 *
 * Response envelope: { success: true, data: { sequences | sequence } }
 *
 * Exact fields from sequences.service.ts → toDocumentSequenceDTO():
 *   id, organizationId, type, prefix, padding, nextValue, updatedAt
 *
 * NOTE: nextValue is intentionally READ-ONLY per sequences.validation.ts.
 * The PATCH body only accepts { prefix?, padding? }.
 *
 * Permissions:
 *   GET   → settings:read
 *   PATCH → settings:update
 */
import { baseApi } from '../../services/baseApi';

export type DocumentSequenceType =
  | 'PROJECT'
  | 'ESTIMATE'
  | 'INVOICE'
  | 'PURCHASE_ORDER'
  | 'CHANGE_ORDER'
  | 'RFI'
  | 'SUBMITTAL';

export interface DocumentSequenceDTO {
  id: string;
  organizationId: string;
  type: DocumentSequenceType;
  prefix: string;
  padding: number;
  nextValue: number;
  updatedAt: string;
}

export interface UpdateSequenceInput {
  prefix?: string;   // min 1, max 10 chars
  padding?: number;  // 1–10
  // nextValue intentionally excluded — server rejects it
}

interface ListSeqResponse   { sequences: DocumentSequenceDTO[] }
interface SingleSeqResponse { sequence: DocumentSequenceDTO }

export const sequenceApi = baseApi.injectEndpoints({
  endpoints: (b) => ({

    listSequences: b.query<ListSeqResponse, string>({
      query: (orgId) => `/organizations/${orgId}/document-sequences`,
      transformResponse: (r: { data: ListSeqResponse }) => r.data,
      providesTags: (_r, _e, orgId) => [{ type: 'DocSequence', id: orgId }],
    }),

    getSequence: b.query<SingleSeqResponse, { orgId: string; type: DocumentSequenceType }>({
      query: ({ orgId, type }) => `/organizations/${orgId}/document-sequences/${type}`,
      transformResponse: (r: { data: SingleSeqResponse }) => r.data,
      providesTags: (_r, _e, { orgId, type }) => [{ type: 'DocSequence', id: `${orgId}:${type}` }],
    }),

    updateSequence: b.mutation<SingleSeqResponse, {
      orgId: string;
      type: DocumentSequenceType;
      body: UpdateSequenceInput;
    }>({
      query: ({ orgId, type, body }) => ({
        url: `/organizations/${orgId}/document-sequences/${type}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (r: { data: SingleSeqResponse }) => r.data,
      invalidatesTags: (_r, _e, { orgId, type }) => [
        { type: 'DocSequence', id: orgId },
        { type: 'DocSequence', id: `${orgId}:${type}` },
      ],
    }),

  }),
  overrideExisting: false,
});

export const {
  useListSequencesQuery,
  useGetSequenceQuery,
  useUpdateSequenceMutation,
} = sequenceApi;
