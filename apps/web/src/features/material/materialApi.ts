/**
 * materialApi — Org-level material catalog CRUD.
 *
 * Endpoints:
 *   GET   /:orgId/materials                    material:read
 *   POST  /:orgId/materials                    material:create
 *   GET   /:orgId/materials/:materialId        material:read
 *   PATCH /:orgId/materials/:materialId        material:update
 *
 * MOCK PHASE: queryFn returns fixture data.
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import type {
  MaterialDTO,
  CreateMaterialInput,
  UpdateMaterialInput,
} from './materialTypes';
import { MOCK_MATERIALS_LIST } from '../../mocks/material.fixtures';

interface OrgArgs { orgId: string }
interface MaterialArgs extends OrgArgs { materialId: string }

interface ListMaterialsResponse { materials: MaterialDTO[]; nextCursor: string | null }
interface SingleMaterialResponse { material: MaterialDTO }

let _materials = [...MOCK_MATERIALS_LIST];

export const materialApi = createApi({
  reducerPath: 'materialApi',
  baseQuery: async () => ({ data: undefined as unknown }),
  tagTypes: ['Material'],
  endpoints: (b) => ({

    // REAL: query: ({ orgId, params }) => `/organizations/${orgId}/materials?${qs}`
    listMaterials: b.query<ListMaterialsResponse, OrgArgs & { status?: string; category?: string }>({
      queryFn: ({ status, category }) => {
        let filtered = _materials.filter((m) => m.organizationId === 'org_01');
        if (status) filtered = filtered.filter((m) => m.status === status);
        if (category) filtered = filtered.filter((m) => m.category === category);
        return { data: { materials: filtered, nextCursor: null } };
      },
      providesTags: (_r, _e, { orgId }) => [{ type: 'Material', id: orgId }],
    }),

    // REAL: query: ({ orgId, materialId }) => `/organizations/${orgId}/materials/${materialId}`
    getMaterial: b.query<SingleMaterialResponse, MaterialArgs>({
      queryFn: ({ materialId }) => {
        const material = _materials.find((m) => m.id === materialId);
        if (!material) return { error: { status: 404, error: 'Not found' } };
        return { data: { material } };
      },
      providesTags: (_r, _e, { materialId }) => [{ type: 'Material', id: materialId }],
    }),

    // REAL: query: ({ orgId, body }) => ({ url: `.../materials`, method: 'POST', body })
    createMaterial: b.mutation<SingleMaterialResponse, OrgArgs & { body: CreateMaterialInput }>({
      queryFn: ({ orgId, body }) => {
        const material: MaterialDTO = {
          id: `mat_${Date.now()}`,
          organizationId: orgId,
          materialCode: body.materialCode,
          name: body.name,
          description: body.description ?? null,
          category: body.category ?? null,
          defaultUnitCode: body.defaultUnitCode.toUpperCase(),
          materialType: body.materialType ?? 'MATERIAL',
          status: 'ACTIVE',
          defaultTaxCode: body.defaultTaxCode ?? null,
          defaultCurrencyCode: body.defaultCurrencyCode ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        _materials = [..._materials, material];
        return { data: { material } };
      },
      invalidatesTags: (_r, _e, { orgId }) => [{ type: 'Material', id: orgId }],
    }),

    // REAL: query: ({ orgId, materialId, body }) => ({ url: `.../materials/${materialId}`, method: 'PATCH', body })
    updateMaterial: b.mutation<SingleMaterialResponse, MaterialArgs & { body: UpdateMaterialInput }>({
      queryFn: ({ materialId, body }) => {
        const idx = _materials.findIndex((m) => m.id === materialId);
        if (idx === -1) return { error: { status: 404, error: 'Not found' } };
        const updated = {
          ..._materials[idx]!,
          ...body,
          ...(body.defaultUnitCode ? { defaultUnitCode: body.defaultUnitCode.toUpperCase() } : {}),
          updatedAt: new Date().toISOString(),
        };
        _materials = _materials.map((m, i) => (i === idx ? updated : m));
        return { data: { material: updated } };
      },
      invalidatesTags: (_r, _e, { orgId, materialId }) => [
        { type: 'Material', id: orgId },
        { type: 'Material', id: materialId },
      ],
    }),

  }),
});

export const {
  useListMaterialsQuery,
  useGetMaterialQuery,
  useCreateMaterialMutation,
  useUpdateMaterialMutation,
} = materialApi;
