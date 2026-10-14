/**
 * profileApi — GET/PATCH /organizations/:orgId/profile
 * Response envelope: { success: true, data: { profile } }
 *
 * Exact fields from profile.service.ts → toOrgProfileDTO():
 *   organizationId, legalName, businessName, businessType, registrationNumber,
 *   taxIdentificationNumber, primaryEmail, primaryPhone, secondaryPhone,
 *   website, addressLine1, addressLine2, city, stateProvince, postalCode,
 *   country (ISO 3166-1 alpha-2), createdAt, updatedAt
 *
 * Permissions:
 *   GET   → organization:read
 *   PATCH → organization:update
 */
import { baseApi } from '../../services/baseApi';

export type BusinessType =
  | 'GENERAL_CONTRACTOR'
  | 'SUBCONTRACTOR'
  | 'SPECIALTY_CONTRACTOR'
  | 'DESIGN_BUILD'
  | 'DEVELOPER'
  | 'CONSULTANT'
  | 'OTHER';

export interface OrgProfileDTO {
  organizationId: string;
  legalName: string | null;
  businessName: string | null;
  businessType: BusinessType | null;
  registrationNumber: string | null;
  taxIdentificationNumber: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  secondaryPhone: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  country: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UpdateProfileInput = Partial<
  Omit<OrgProfileDTO, 'organizationId' | 'createdAt' | 'updatedAt'>
>;

interface ProfileResponse { profile: OrgProfileDTO }

export const profileApi = baseApi.injectEndpoints({
  endpoints: (b) => ({

    getProfile: b.query<ProfileResponse, string>({
      query: (orgId) => `/organizations/${orgId}/profile`,
      transformResponse: (r: { data: ProfileResponse }) => r.data,
      providesTags: (_r, _e, orgId) => [{ type: 'OrgProfile', id: orgId }],
    }),

    updateProfile: b.mutation<ProfileResponse, { orgId: string; body: UpdateProfileInput }>({
      query: ({ orgId, body }) => ({
        url: `/organizations/${orgId}/profile`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (r: { data: ProfileResponse }) => r.data,
      invalidatesTags: (_r, _e, { orgId }) => [{ type: 'OrgProfile', id: orgId }],
    }),

  }),
  overrideExisting: false,
});

export const { useGetProfileQuery, useUpdateProfileMutation } = profileApi;
