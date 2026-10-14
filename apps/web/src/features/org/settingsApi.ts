/**
 * settingsApi — GET/PATCH /organizations/:orgId/settings
 * Response envelope: { success: true, data: { settings } }
 *
 * Exact fields from settings.service.ts → toOrgSettingsDTO():
 *   organizationId, timezone (IANA), currency (3-char ISO),
 *   locale, dateFormat, timeFormat, unitSystem,
 *   weekStartsOn (0–6), fiscalYearStartMonth (1–12),
 *   createdAt, updatedAt
 *
 * Permissions:
 *   GET   → settings:read
 *   PATCH → settings:update
 */
import { baseApi } from '../../services/baseApi';

export type DateFormat = 'DD_MM_YYYY' | 'MM_DD_YYYY' | 'YYYY_MM_DD';
export type TimeFormat = 'H12' | 'H24';
export type UnitSystem = 'METRIC' | 'IMPERIAL';

export interface OrgSettingsDTO {
  organizationId: string;
  timezone: string;
  currency: string;
  locale: string;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  unitSystem: UnitSystem;
  weekStartsOn: number;
  fiscalYearStartMonth: number;
  createdAt: string;
  updatedAt: string;
}

export type UpdateSettingsInput = Partial<
  Omit<OrgSettingsDTO, 'organizationId' | 'createdAt' | 'updatedAt'>
>;

interface SettingsResponse { settings: OrgSettingsDTO }

export const settingsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({

    getSettings: b.query<SettingsResponse, string>({
      query: (orgId) => `/organizations/${orgId}/settings`,
      transformResponse: (r: { data: SettingsResponse }) => r.data,
      providesTags: (_r, _e, orgId) => [{ type: 'OrgSettings', id: orgId }],
    }),

    updateSettings: b.mutation<SettingsResponse, { orgId: string; body: UpdateSettingsInput }>({
      query: ({ orgId, body }) => ({
        url: `/organizations/${orgId}/settings`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (r: { data: SettingsResponse }) => r.data,
      invalidatesTags: (_r, _e, { orgId }) => [{ type: 'OrgSettings', id: orgId }],
    }),

  }),
  overrideExisting: false,
});

export const { useGetSettingsQuery, useUpdateSettingsMutation } = settingsApi;
