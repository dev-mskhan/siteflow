import { type ReportFilter, ReportFilterSchema } from '@siteflow/shared';
import { projectSettingsService } from '../project/settings/project-settings.service.js';
import { OrgSettingsRepository } from '../organization/settings/settings.repository.js';

export interface ReportDateOptions {
  timezone?: string;
  weekStartsOn?: number;
  now?: Date;
}

const orgSettingsRepository = new OrgSettingsRepository();

export async function getReportDateOptions(
  organizationId: string,
  projectId?: string,
): Promise<Pick<ReportDateOptions, 'timezone' | 'weekStartsOn'>> {
  if (projectId) {
    const settings = await projectSettingsService.getEffectiveSettings(organizationId, projectId);
    return { timezone: settings.timezone || 'UTC', weekStartsOn: settings.weekStartsOn };
  }
  const settings = await orgSettingsRepository.findByOrgId(organizationId);
  return {
    timezone: settings?.timezone || 'UTC',
    weekStartsOn: settings?.weekStartsOn ?? 1,
  };
}

function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDate(date: Date, days: number): Date {
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted;
}

function localCalendarDate(now: Date, timezone: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((item) => item.type === type)?.value;
    if (!value) throw new Error(`Unable to determine ${type} in timezone ${timezone}`);
    return Number(value);
  };
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
}

export function normalizeReportFilters(
  rawFilters: unknown,
  options: ReportDateOptions = {},
): ReportFilter {
  const parsed = ReportFilterSchema.parse(rawFilters);
  if (parsed.datePreset === 'CUSTOM') {
    if (!parsed.startDate || !parsed.endDate) {
      throw new Error('CUSTOM date preset requires both startDate and endDate');
    }
    for (const [name, value] of [
      ['startDate', parsed.startDate],
      ['endDate', parsed.endDate],
    ] as const) {
      const date = new Date(`${value}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || dateString(date) !== value) {
        throw new Error(`${name} must be a valid YYYY-MM-DD calendar date`);
      }
    }
    if (parsed.startDate > parsed.endDate) {
      throw new Error('endDate must be on or after startDate');
    }
  }
  const timezone = options.timezone ?? 'UTC';
  const now = options.now ?? new Date();
  const today = localCalendarDate(now, timezone);
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  let presetStart = today;
  let presetEnd = today;

  switch (parsed.datePreset) {
    case 'TODAY':
      break;
    case 'THIS_WEEK': {
      const weekStartsOn = options.weekStartsOn ?? 1;
      if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) {
        throw new Error('weekStartsOn must be an integer from 0 to 6');
      }
      const daysSinceStart = (today.getUTCDay() - weekStartsOn + 7) % 7;
      presetStart = shiftDate(today, -daysSinceStart);
      presetEnd = shiftDate(presetStart, 6);
      break;
    }
    case 'THIS_MONTH':
      presetStart = new Date(Date.UTC(year, month, 1));
      presetEnd = new Date(Date.UTC(year, month + 1, 0));
      break;
    case 'LAST_30_DAYS':
      presetStart = shiftDate(today, -29);
      break;
    case 'THIS_QUARTER': {
      const quarterStartMonth = Math.floor(month / 3) * 3;
      presetStart = new Date(Date.UTC(year, quarterStartMonth, 1));
      presetEnd = new Date(Date.UTC(year, quarterStartMonth + 3, 0));
      break;
    }
    case 'THIS_YEAR':
      presetStart = new Date(Date.UTC(year, 0, 1));
      presetEnd = new Date(Date.UTC(year, 12, 0));
      break;
    case 'CUSTOM':
      presetStart = new Date(`${parsed.startDate}T00:00:00Z`);
      presetEnd = new Date(`${parsed.endDate}T00:00:00Z`);
      break;
  }

  return {
    ...parsed,
    startDate: parsed.startDate ?? dateString(presetStart),
    endDate: parsed.endDate ?? dateString(presetEnd),
    asOfDate: parsed.asOfDate ?? now.toISOString(),
  };
}
