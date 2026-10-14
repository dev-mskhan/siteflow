/**
 * orgApi — Organization CRUD endpoints.
 * Response envelope: { success: true, data: { organization | organizations } }
 */
import { baseApi } from '../../services/baseApi';
import type { OrgDTO } from './orgSlice';

interface ListOrgsResponse    { organizations: OrgDTO[] }
interface SingleOrgResponse   { organization: OrgDTO }

export const orgApi = baseApi.injectEndpoints({
  endpoints: (b) => ({

    listOrgs: b.query<ListOrgsResponse, void>({
      query: () => '/organizations',
      transformResponse: (r: { data: ListOrgsResponse }) => r.data,
      providesTags: ['Organization'],
    }),

    getOrg: b.query<SingleOrgResponse, string>({
      query: (orgId) => `/organizations/${orgId}`,
      transformResponse: (r: { data: SingleOrgResponse }) => r.data,
      providesTags: (_r, _e, orgId) => [{ type: 'Organization', id: orgId }],
    }),

    createOrg: b.mutation<SingleOrgResponse, { name: string; slug?: string }>({
      query: (body) => ({ url: '/organizations', method: 'POST', body }),
      transformResponse: (r: { data: SingleOrgResponse }) => r.data,
      invalidatesTags: ['Organization'],
    }),

    updateOrg: b.mutation<SingleOrgResponse, { orgId: string; name: string }>({
      query: ({ orgId, name }) => ({ url: `/organizations/${orgId}`, method: 'PATCH', body: { name } }),
      transformResponse: (r: { data: SingleOrgResponse }) => r.data,
      invalidatesTags: (_r, _e, { orgId }) => [{ type: 'Organization', id: orgId }],
    }),

  }),
  overrideExisting: false,
});

export const {
  useListOrgsQuery,
  useGetOrgQuery,
  useCreateOrgMutation,
  useUpdateOrgMutation,
} = orgApi;
