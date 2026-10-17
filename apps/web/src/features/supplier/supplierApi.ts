/**
 * supplierApi — Org-level supplier CRUD + contacts.
 *
 * Endpoints:
 *   GET    /:orgId/suppliers                          supplier:read
 *   POST   /:orgId/suppliers                          supplier:create
 *   GET    /:orgId/suppliers/:supplierId              supplier:read
 *   PATCH  /:orgId/suppliers/:supplierId              supplier:update
 *   POST   /:orgId/suppliers/:supplierId/contacts     supplier:update
 *   PATCH  /:orgId/suppliers/:supplierId/contacts/:contactId  supplier:update
 *
 * MOCK PHASE: queryFn returns fixture data. Real swap: replace with baseApi injection.
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import type {
  SupplierDTO,
  SupplierContactDTO,
  CreateSupplierInput,
  UpdateSupplierInput,
  CreateSupplierContactInput,
  UpdateSupplierContactInput,
} from './supplierTypes';
import {
  MOCK_SUPPLIERS_LIST,
  MOCK_SUPPLIERS,
  MOCK_SUPPLIER_CONTACTS,
} from '../../mocks/supplier.fixtures';

interface OrgArgs { orgId: string }
interface SupplierArgs extends OrgArgs { supplierId: string }
interface ContactArgs extends SupplierArgs { contactId: string }

interface ListSuppliersResponse { suppliers: SupplierDTO[]; nextCursor: string | null }
interface SingleSupplierResponse { supplier: SupplierDTO }
interface ListContactsResponse { contacts: SupplierContactDTO[] }
interface SingleContactResponse { contact: SupplierContactDTO }

// In-memory mutable list for mock mutations
let _suppliers = [...MOCK_SUPPLIERS_LIST];

export const supplierApi = createApi({
  reducerPath: 'supplierApi',
  baseQuery: async () => ({ data: undefined as unknown }),
  tagTypes: ['Supplier', 'SupplierContact'],
  endpoints: (b) => ({

    // REAL: query: ({ orgId, params }) => `/organizations/${orgId}/suppliers?${qs}`
    listSuppliers: b.query<ListSuppliersResponse, OrgArgs & { status?: string }>({
      queryFn: ({ status }) => {
        const filtered = _suppliers.filter(
          (s) => s.organizationId === 'org_01' && (!status || s.status === status),
        );
        return { data: { suppliers: filtered, nextCursor: null } };
      },
      providesTags: (_r, _e, { orgId }) => [{ type: 'Supplier', id: orgId }],
    }),

    // REAL: query: ({ orgId, supplierId }) => `/organizations/${orgId}/suppliers/${supplierId}`
    getSupplier: b.query<SingleSupplierResponse, SupplierArgs>({
      queryFn: ({ supplierId }) => {
        const supplier = _suppliers.find((s) => s.id === supplierId);
        if (!supplier) return { error: { status: 404, error: 'Not found' } };
        return { data: { supplier } };
      },
      providesTags: (_r, _e, { supplierId }) => [{ type: 'Supplier', id: supplierId }],
    }),

    // REAL: query: ({ orgId, body }) => ({ url: `.../suppliers`, method: 'POST', body })
    createSupplier: b.mutation<SingleSupplierResponse, OrgArgs & { body: CreateSupplierInput }>({
      queryFn: ({ orgId, body }) => {
        const supplier: SupplierDTO = {
          id: `sup_${Date.now()}`,
          organizationId: orgId,
          supplierCode: body.supplierCode,
          legalName: body.legalName,
          displayName: body.displayName,
          supplierType: body.supplierType ?? 'GENERAL_SUPPLIER',
          status: 'ACTIVE',
          taxReference: body.taxReference ?? null,
          email: body.email ?? null,
          phone: body.phone ?? null,
          address: body.address ?? null,
          website: body.website ?? null,
          paymentTerms: body.paymentTerms ?? null,
          currencyCode: body.currencyCode ?? null,
          notes: body.notes ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        _suppliers = [..._suppliers, supplier];
        MOCK_SUPPLIER_CONTACTS[supplier.id] = [];
        return { data: { supplier } };
      },
      invalidatesTags: (_r, _e, { orgId }) => [{ type: 'Supplier', id: orgId }],
    }),

    // REAL: query: ({ orgId, supplierId, body }) => ({ url: `.../suppliers/${supplierId}`, method: 'PATCH', body })
    updateSupplier: b.mutation<SingleSupplierResponse, SupplierArgs & { body: UpdateSupplierInput }>({
      queryFn: ({ supplierId, body }) => {
        const idx = _suppliers.findIndex((s) => s.id === supplierId);
        if (idx === -1) return { error: { status: 404, error: 'Not found' } };
        const updated = { ..._suppliers[idx]!, ...body, updatedAt: new Date().toISOString() };
        _suppliers = _suppliers.map((s, i) => (i === idx ? updated : s));
        return { data: { supplier: updated } };
      },
      invalidatesTags: (_r, _e, { orgId, supplierId }) => [
        { type: 'Supplier', id: orgId },
        { type: 'Supplier', id: supplierId },
      ],
    }),

    // REAL: query: ({ orgId, supplierId }) => `.../suppliers/${supplierId}/contacts`
    listSupplierContacts: b.query<ListContactsResponse, SupplierArgs>({
      queryFn: ({ supplierId }) => ({
        data: { contacts: MOCK_SUPPLIER_CONTACTS[supplierId] ?? [] },
      }),
      providesTags: (_r, _e, { supplierId }) => [{ type: 'SupplierContact', id: supplierId }],
    }),

    // REAL: query: ({ orgId, supplierId, body }) => ({ url: `.../contacts`, method: 'POST', body })
    createSupplierContact: b.mutation<SingleContactResponse, SupplierArgs & { body: CreateSupplierContactInput }>({
      queryFn: ({ orgId, supplierId, body }) => {
        const contact: SupplierContactDTO = {
          id: `sc_${Date.now()}`,
          organizationId: orgId,
          supplierId,
          name: body.name,
          role: body.role ?? null,
          email: body.email ?? null,
          phone: body.phone ?? null,
          isPrimary: body.isPrimary ?? false,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        MOCK_SUPPLIER_CONTACTS[supplierId] = [...(MOCK_SUPPLIER_CONTACTS[supplierId] ?? []), contact];
        return { data: { contact } };
      },
      invalidatesTags: (_r, _e, { supplierId }) => [{ type: 'SupplierContact', id: supplierId }],
    }),

    // REAL: query: ({ orgId, supplierId, contactId, body }) => ({ url: `.../contacts/${contactId}`, method: 'PATCH', body })
    updateSupplierContact: b.mutation<SingleContactResponse, ContactArgs & { body: UpdateSupplierContactInput }>({
      queryFn: ({ supplierId, contactId, body }) => {
        const contacts = MOCK_SUPPLIER_CONTACTS[supplierId] ?? [];
        const idx = contacts.findIndex((c) => c.id === contactId);
        if (idx === -1) return { error: { status: 404, error: 'Not found' } };
        const updated = { ...contacts[idx]!, ...body, updatedAt: new Date().toISOString() };
        MOCK_SUPPLIER_CONTACTS[supplierId] = contacts.map((c, i) => (i === idx ? updated : c));
        return { data: { contact: updated } };
      },
      invalidatesTags: (_r, _e, { supplierId }) => [{ type: 'SupplierContact', id: supplierId }],
    }),

  }),
});

export const {
  useListSuppliersQuery,
  useGetSupplierQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useListSupplierContactsQuery,
  useCreateSupplierContactMutation,
  useUpdateSupplierContactMutation,
} = supplierApi;
