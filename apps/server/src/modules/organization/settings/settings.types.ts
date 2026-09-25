// apps/server/src/modules/organization/settings/settings.types.ts

export interface OrgSettingsDTO {
  organizationId: string;
  timezone: string;
  currency: string;
  locale: string;
  dateFormat: 'DD_MM_YYYY' | 'MM_DD_YYYY' | 'YYYY_MM_DD';
  timeFormat: 'H12' | 'H24';
  unitSystem: 'METRIC' | 'IMPERIAL';
  weekStartsOn: number;
  fiscalYearStartMonth: number;
  createdAt: string;
  updatedAt: string;
}

export type UpdateSettingsInput = {
  timezone?: string;
  currency?: string;
  locale?: string;
  dateFormat?: 'DD_MM_YYYY' | 'MM_DD_YYYY' | 'YYYY_MM_DD';
  timeFormat?: 'H12' | 'H24';
  unitSystem?: 'METRIC' | 'IMPERIAL';
  weekStartsOn?: number;
  fiscalYearStartMonth?: number;
};
