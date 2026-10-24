/**
 * supplierApi — Org-level supplier CRUD + contacts.
 * LIVE INTEGRATION: uses baseApi.injectEndpoints with real HTTP endpoints.
 *
 * Server: apps/server/src/modules/supplier/supplier.routes.ts
 *   GET    /organizations/:orgId/suppliers
 *   POST   /organizations/:orgId/suppliers
 *   GET    /organizations/:orgId/suppliers/:supplierId
 *   PATCH  /organizations/:orgId/suppliers/:supplierId
 *   POST   /organizations/:orgId/suppliers/:supplierId/contacts
 *   PATCH  /organizations/:orgId/suppliers/:supplierId/contacts/:contactId
 */
import { baseApi } from '../../services/baseApi';
import type {
  SupplierDTO,
  SupplierContactDTO,
  CreateSupplierInput,
  UpdateSupplierInput,
  CreateSupplierContactInput,
  UpdateSupplierContactInput,
} from './supplierTypes';

interface OrgArgs { orgId: string }
interface SupplierArgs extends OrgArgs { supplierId: string }
interface ContactArgs extends SupplierArgs { contactId: string }

interface ListSuppliersResponse { suppliers: SupplierDTO[]; nextCursor: string | null }
interface SingleSupplierResponse { supplier: SupplierDTO }
interface ListContactsResponse { contacts: SupplierContactDTO[] }
interface SingleContactResponse { contact: SupplierContactDTO }

export const supplierApi = baseApi.injectEndpoints({
  endpoints: (b) => ({

    listSuppliers: b.query<{ data: SupplierDTO[]; nextCursor: string | null }, OrgArgs & { status?: string }>({
      query: ({ orgId, status }) => ({
        url: `/organizations/${orgId}/suppliers`,
        params: status ? { status } : {},
      }),
      transformResponse: (raw: { data: SupplierDTO[]; meta: { nextCursor?: string | null } }) => ({
        data: raw.data,
        nextCursor: raw.meta.nextCursor ?? null,
      }),
      providesTags: (_r, _e, { orgId }) => [{ type: 'Supplier', id: `LIST_${orgId}` }],
    }),

    getSupplier: b.query<SupplierDTO, SupplierArgs>({
      query: ({ orgId, supplierId }) => `/organizations/${orgId}/suppliers/${supplierId}`,
      transformResponse: (raw: { data: SupplierDTO }) => raw.data,
      providesTags: (_r, _e, { supplierId }) => [{ type: 'Supplier', id: supplierId }],
    }),

    createSupplier: b.mutation<SupplierDTO, OrgArgs & { body: CreateSupplierInput }>({
      query: ({ orgId, body }) => ({
        url: `/organizations/${orgId}/suppliers`,
        method: 'POST',
        body,
      }),
      transformResponse: (raw: { data: SupplierDTO }) => raw.data,
      invalidatesTags: (_r, _e, { orgId }) => [{ type: 'Supplier', id: `LIST_${orgId}` }],
    }),

    updateSupplier: b.mutation<SupplierDTO, SupplierArgs & { body: UpdateSupplierInput }>({
      query: ({ orgId, supplierId, body }) => ({
        url: `/organizations/${orgId}/suppliers/${supplierId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (raw: { data: SupplierDTO }) => raw.data,
      invalidatesTags: (_r, _e, { orgId, supplierId }) => [
        { type: 'Supplier', id: `LIST_${orgId}` },
        { type: 'Supplier', id: supplierId },
      ],
    }),

    // Note: Backend does not have GET /suppliers/:id/contacts endpoint yet.
    // Contacts are managed via POST and PATCH only.

    createSupplierContact: b.mutation<SupplierContactDTO, SupplierArgs & { body: CreateSupplierContactInput }>({
      query: ({ orgId, supplierId, body }) => ({
        url: `/organizations/${orgId}/suppliers/${supplierId}/contacts`,
        method: 'POST',
        body,
      }),
      transformResponse: (raw: { data: SupplierContactDTO }) => raw.data,
      invalidatesTags: (_r, _e, { supplierId }) => [
        { type: 'SupplierContact', id: supplierId },
        { type: 'Supplier', id: supplierId }, // Invalidate supplier to refetch with contacts
      ],
    }),

    updateSupplierContact: b.mutation<SupplierContactDTO, ContactArgs & { body: UpdateSupplierContactInput }>({
      query: ({ orgId, supplierId, contactId, body }) => ({
        url: `/organizations/${orgId}/suppliers/${supplierId}/contacts/${contactId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (raw: { data: SupplierContactDTO }) => raw.data,
      invalidatesTags: (_r, _e, { supplierId }) => [
        { type: 'SupplierContact', id: supplierId },
        { type: 'Supplier', id: supplierId }, // Invalidate supplier to refetch with contacts
      ],
    }),

  }),
  overrideExisting: false,
});

export const {
  useListSuppliersQuery,
  useGetSupplierQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useCreateSupplierContactMutation,
  useUpdateSupplierContactMutation,
} = supplierApi;
