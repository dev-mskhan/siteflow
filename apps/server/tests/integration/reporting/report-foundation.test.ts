// apps/server/tests/integration/reporting/report-foundation.test.ts
// F.10 — Reporting Foundation contract validation
import { describe, it, expect } from 'vitest';
import { normalizeReportFilters } from '../../../src/modules/reporting/report.filters.js';
import { REPORT_SOURCE_CATALOG } from '../../../src/modules/reporting/report.sources.js';
import { ReportFilterSchema, ReportResultEnvelopeSchema } from '@siteflow/shared';

describe('F.10 Report Foundation — Filter Normalization', () => {
  it('normalizes THIS_MONTH preset into start/end date pair', () => {
    const result = normalizeReportFilters({
      organizationId: 'org_abc',
      datePreset: 'THIS_MONTH',
    });
    expect(result.organizationId).toBe('org_abc');
    expect(result.startDate).toMatch(/^\d{4}-\d{2}-01$/);
    expect(result.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.asOfDate).toBeDefined();
  });

  it('normalizes TODAY preset to same start and end date', () => {
    const result = normalizeReportFilters({
      organizationId: 'org_abc',
      datePreset: 'TODAY',
    });
    expect(result.startDate).toBe(result.endDate);
    expect(result.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('normalizes THIS_WEEK preset to a Mon-Sun range within 7 days', () => {
    const result = normalizeReportFilters({
      organizationId: 'org_abc',
      datePreset: 'THIS_WEEK',
    });
    const start = new Date(result.startDate!);
    const end = new Date(result.endDate!);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeLessThanOrEqual(6);
  });

  it('passes CUSTOM dates through unchanged', () => {
    const result = normalizeReportFilters({
      organizationId: 'org_abc',
      datePreset: 'CUSTOM',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
    });
    expect(result.startDate).toBe('2026-01-01');
    expect(result.endDate).toBe('2026-03-31');
  });

  it('rejects missing organizationId', () => {
    expect(() =>
      normalizeReportFilters({ datePreset: 'THIS_MONTH' }),
    ).toThrow();
  });

  it('rejects empty organizationId (caller-injection guard)', () => {
    expect(() =>
      normalizeReportFilters({ organizationId: '', datePreset: 'THIS_MONTH' }),
    ).toThrow();
  });

  it('rejects invalid datePreset enum', () => {
    expect(() =>
      normalizeReportFilters({ organizationId: 'org_abc', datePreset: 'NEXT_YEAR' }),
    ).toThrow();
  });
});

describe('F.10 Report Foundation — ReportFilterSchema Zod Contract', () => {
  it('parses valid filter with all fields', () => {
    const parsed = ReportFilterSchema.parse({
      organizationId: 'org_123',
      projectId: 'proj_456',
      datePreset: 'THIS_QUARTER',
      startDate: '2026-07-01',
      endDate: '2026-09-30',
      asOfDate: '2026-09-30T00:00:00Z',
    });
    expect(parsed.organizationId).toBe('org_123');
    expect(parsed.datePreset).toBe('THIS_QUARTER');
  });

  it('defaults datePreset to THIS_MONTH when absent', () => {
    const parsed = ReportFilterSchema.parse({ organizationId: 'org_123' });
    expect(parsed.datePreset).toBe('THIS_MONTH');
  });

  it('rejects organizationId shorter than 1 char', () => {
    expect(() => ReportFilterSchema.parse({ organizationId: '' })).toThrow();
  });
});

describe('F.10 Report Foundation — ReportResultEnvelopeSchema', () => {
  it('validates a complete report result envelope', () => {
    const result = ReportResultEnvelopeSchema.parse({
      reportType: 'PROJECT_EXECUTIVE_SUMMARY',
      organizationId: 'org_123',
      projectId: 'proj_456',
      asOf: new Date().toISOString(),
      effectiveTimezone: 'America/New_York',
      filters: {
        organizationId: 'org_123',
        datePreset: 'THIS_MONTH',
      },
      coverage: {
        isAvailable: true,
        sourceModule: 'project-core',
      },
      data: { someKey: 'someValue' },
    });
    expect(result.reportType).toBe('PROJECT_EXECUTIVE_SUMMARY');
    expect(result.coverage.isAvailable).toBe(true);
  });

  it('defaults effectiveTimezone to UTC when not provided', () => {
    const result = ReportResultEnvelopeSchema.parse({
      reportType: 'DAILY_SITE_ACTIVITY',
      organizationId: 'org_123',
      asOf: new Date().toISOString(),
      filters: { organizationId: 'org_123' },
      coverage: { isAvailable: false, reason: 'No data', sourceModule: 'field-log' },
      data: {},
    });
    expect(result.effectiveTimezone).toBe('UTC');
  });

  it('requires reportType and organizationId', () => {
    expect(() =>
      ReportResultEnvelopeSchema.parse({
        asOf: new Date().toISOString(),
        filters: { organizationId: 'org_123' },
        coverage: { isAvailable: true, sourceModule: 'x' },
        data: {},
      }),
    ).toThrow();
  });
});

describe('F.10 Report Foundation — Source Catalog', () => {
  const expectedFamilies = [
    'PROJECT_EXECUTIVE_SUMMARY',
    'DAILY_SITE_ACTIVITY',
    'COMMERCIAL_FINANCIAL_SUMMARY',
    'SCHEDULE_VARIANCE_PROGRESS',
    'SUBCONTRACTOR_PERFORMANCE',
  ];

  it('contains all expected report families', () => {
    for (const family of expectedFamilies) {
      expect(REPORT_SOURCE_CATALOG[family]).toBeDefined();
    }
  });

  it('every catalog entry has required fields: reportFamily, sourceModules, supportedSemantics', () => {
    for (const [key, entry] of Object.entries(REPORT_SOURCE_CATALOG)) {
      expect(entry.reportFamily).toBe(key);
      expect(Array.isArray(entry.sourceModules)).toBe(true);
      expect(entry.sourceModules.length).toBeGreaterThan(0);
      expect(['AS_OF', 'DATE_RANGE', 'LOOKAHEAD']).toContain(entry.supportedSemantics);
    }
  });

  it('PROJECT_EXECUTIVE_SUMMARY uses AS_OF semantics', () => {
    expect(REPORT_SOURCE_CATALOG.PROJECT_EXECUTIVE_SUMMARY.supportedSemantics).toBe('AS_OF');
  });

  it('DAILY_SITE_ACTIVITY uses DATE_RANGE semantics', () => {
    expect(REPORT_SOURCE_CATALOG.DAILY_SITE_ACTIVITY.supportedSemantics).toBe('DATE_RANGE');
  });

  it('COMMERCIAL_FINANCIAL_SUMMARY includes budget and change-order source modules', () => {
    const modules = REPORT_SOURCE_CATALOG.COMMERCIAL_FINANCIAL_SUMMARY.sourceModules;
    expect(modules).toContain('budget');
    expect(modules).toContain('change-order');
  });
});
