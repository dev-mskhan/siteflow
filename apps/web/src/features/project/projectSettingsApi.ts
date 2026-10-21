/**
 * projectSettingsApi — Effective project settings (read + update).
 * LIVE INTEGRATION: uses baseApi.injectEndpoints with real HTTP endpoints.
 *
 * Server: apps/server/src/modules/project/project.routes.ts
 *   GET   /organizations/:orgId/projects/:projectId/settings
 *   PATCH /organizations/:orgId/projects/:projectId/settings
 *
 * EffectiveProjectSettings is a MERGED view: project_settings row overrides
 * fall back to org_settings, with currency always from the project row.
 */
import { baseApi } from '../../services/baseApi';
import type { EffectiveProjectSettings } from './projectTypes';

interface Args { orgId: string; projectId: string }
interface SettingsResponse { settings: EffectiveProjectSettings }

export const projectSettingsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    getProjectSettings: build.query<SettingsResponse, Args>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/settings`,
      transformResponse: (raw: { data: SettingsResponse }) => raw.data,
      providesTags: (_result, _error, { projectId }) => [{ type: 'ProjectSettings' as const, id: projectId }],
    }),

    updateProjectSettings: build.mutation<SettingsResponse, Args & {
      body: Partial<Omit<EffectiveProjectSettings, 'currency'>>;
    }>({
      query: ({ orgId, projectId, body }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/settings`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (raw: { data: SettingsResponse }) => raw.data,
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'ProjectSettings' as const, id: projectId }],
    }),
  }),
  overrideExisting: false,
});

export const { useGetProjectSettingsQuery, useUpdateProjectSettingsMutation } = projectSettingsApi;
