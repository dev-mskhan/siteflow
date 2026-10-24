/**
 * materialApi — Org-level material catalog CRUD.
 * LIVE INTEGRATION: uses baseApi.injectEndpoints with real HTTP endpoints.
 *
 * Server: apps/server/src/modules/material/material.routes.ts
 *   GET   /organizations/:orgId/materials
 *   POST  /organizations/:orgId/materials
 *   GET   /organizations/:orgId/materials/:materialId
 *   PATCH /organizations/:orgId/materials/:materialId
 */
import { baseApi } from '../../services/baseApi';
import type {
  MaterialDTO,
  CreateMaterialInput,
  UpdateMaterialInput,
} from './materialTypes';

interface OrgArgs { orgId: string }
interface MaterialArgs extends OrgArgs { materialId: string }

interface ListMaterialsResponse { materials: MaterialDTO[]; nextCursor: string | null }
interface SingleMaterialResponse { material: MaterialDTO }

export const materialApi = baseApi.injectEndpoints({
  endpoints: (b) => ({

    listMaterials: b.query<{ data: MaterialDTO[]; nextCursor: string | null }, OrgArgs & { status?: string; category?: string }>({
      query: ({ orgId, status, category }) => ({
        url: `/organizations/${orgId}/materials`,
        params: {
          ...(status ? { status } : {}),
          ...(category ? { category } : {}),
        },
      }),
      transformResponse: (raw: { data: MaterialDTO[]; meta: { nextCursor?: string | null } }) => ({
        data: raw.data,
        nextCursor: raw.meta.nextCursor ?? null,
      }),
      providesTags: (_r, _e, { orgId }) => [{ type: 'Material', id: `LIST_${orgId}` }],
    }),

    getMaterial: b.query<MaterialDTO, MaterialArgs>({
      query: ({ orgId, materialId }) => `/organizations/${orgId}/materials/${materialId}`,
      transformResponse: (raw: { data: MaterialDTO }) => raw.data,
      providesTags: (_r, _e, { materialId }) => [{ type: 'Material', id: materialId }],
    }),

    createMaterial: b.mutation<MaterialDTO, OrgArgs & { body: CreateMaterialInput }>({
      query: ({ orgId, body }) => ({
        url: `/organizations/${orgId}/materials`,
        method: 'POST',
        body,
      }),
      transformResponse: (raw: { data: MaterialDTO }) => raw.data,
      invalidatesTags: (_r, _e, { orgId }) => [{ type: 'Material', id: `LIST_${orgId}` }],
    }),

    updateMaterial: b.mutation<MaterialDTO, MaterialArgs & { body: UpdateMaterialInput }>({
      query: ({ orgId, materialId, body }) => ({
        url: `/organizations/${orgId}/materials/${materialId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (raw: { data: MaterialDTO }) => raw.data,
      invalidatesTags: (_r, _e, { orgId, materialId }) => [
        { type: 'Material', id: `LIST_${orgId}` },
        { type: 'Material', id: materialId },
      ],
    }),

  }),
  overrideExisting: false,
});

export const {
  useListMaterialsQuery,
  useGetMaterialQuery,
  useCreateMaterialMutation,
  useUpdateMaterialMutation,
} = materialApi;
