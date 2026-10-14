/**
 * projectSettingsApi — Effective project settings (read + update).
 * EffectiveProjectSettings is a MERGED view: project_settings row overrides
 * fall back to org_settings, with currency always from the project row.
 * MOCK PHASE: queryFn returns MOCK_PROJECT_SETTINGS fixture data.
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import type { EffectiveProjectSettings } from './projectTypes';
import { MOCK_PROJECT_SETTINGS } from '../../mocks/project.fixtures';

interface Args { orgId: string; projectId: string }
interface SettingsResponse { settings: EffectiveProjectSettings }

export const projectSettingsApi = createApi({
  reducerPath: 'projectSettingsApi',
  baseQuery: async () => ({ data: undefined as unknown }),
  tagTypes: ['ProjectSettings'],
  endpoints: (b) => ({

    // REAL: query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/settings`
    getProjectSettings: b.query<SettingsResponse, Args>({
      queryFn: ({ projectId }) => ({
        data: {
          settings: MOCK_PROJECT_SETTINGS[projectId] ?? {
            timezone: 'Asia/Karachi', locale: 'en-PK',
            dateFormat: 'DD_MM_YYYY', timeFormat: 'H12',
            unitSystem: 'METRIC', weekStartsOn: 1, currency: 'PKR',
          },
        },
      }),
      providesTags: (_r, _e, { projectId }) => [{ type: 'ProjectSettings', id: projectId }],
    }),

    // REAL: query: ({ orgId, projectId, body }) => ({ url: `.../settings`, method: 'PATCH', body })
    updateProjectSettings: b.mutation<SettingsResponse, Args & {
      body: Partial<Omit<EffectiveProjectSettings, 'currency'>>;
    }>({
      queryFn: ({ projectId, body }) => {
        const current = MOCK_PROJECT_SETTINGS[projectId] ?? {
          timezone: 'Asia/Karachi', locale: 'en-PK',
          dateFormat: 'DD_MM_YYYY' as const, timeFormat: 'H12' as const,
          unitSystem: 'METRIC' as const, weekStartsOn: 1, currency: 'PKR',
        };
        const updated = { ...current, ...body };
        MOCK_PROJECT_SETTINGS[projectId] = updated;
        return { data: { settings: updated } };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'ProjectSettings', id: projectId }],
    }),

  }),
});

export const { useGetProjectSettingsQuery, useUpdateProjectSettingsMutation } = projectSettingsApi;
