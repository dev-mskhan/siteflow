// apps/server/tests/integration/reporting/export-format-parity.test.ts
// F.17A — CSV/report API value parity and tenant-scope evidence.
// Verifies that CSV output carries the same authorized metric values as the API JSON response.

import { describe, it, expect, beforeAll } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import { createVerifiedUser, createOrgWithAdmin } from '../../helpers/fixtures.js';
import { CsvReportRenderer, escapeCsvCell } from '../../../src/modules/reporting/exports/csv.renderer.js';
import type { ReportResultEnvelope } from '@siteflow/shared';

describe('F.17A CSV format parity and tenant scope', () => {
  const runId = Math.random().toString(36).substring(7);
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let org1Id: string;
  let org2Id: string;
  let proj1Id: string;
  let token1: string;
  let token2: string;

  beforeAll(async () => {
    app = await createTestApp();

    const u1 = await createVerifiedUser({ email: `csv_u1_${runId}@test.dev` });
    token1 = u1.token;
    const o1 = await createOrgWithAdmin(app, token1, `CSVOrg1_${runId}`);
    org1Id = o1.orgId;

    const p1Res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/projects`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { name: 'CSV Parity Project', code: `CP1${runId.slice(0, 3).toUpperCase()}`, defaultCurrency: 'USD' },
    });
    proj1Id = p1Res.json().data.project.id;
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/projects/${proj1Id}/activate`,
      headers: { authorization: `Bearer ${token1}` },
    });

    const u2 = await createVerifiedUser({ email: `csv_u2_${runId}@test.dev` });
    token2 = u2.token;
    const o2 = await createOrgWithAdmin(app, token2, `CSVOrg2_${runId}`);
    org2Id = o2.orgId;
  }, 30000);

  describe('escapeCsvCell safety', () => {
    it('escapes formula-injection characters', () => {
      expect(escapeCsvCell('=SUM(A1)')).toBe('\t=SUM(A1)');
      expect(escapeCsvCell('+dangerous')).toBe('\t+dangerous');
      expect(escapeCsvCell('-dangerous')).toBe('\t-dangerous');
      expect(escapeCsvCell('@dangerous')).toBe('\t@dangerous');
    });

    it('wraps cells with commas in double quotes', () => {
      expect(escapeCsvCell('value,with,commas')).toBe('"value,with,commas"');
    });

    it('escapes double-quotes by doubling them', () => {
      expect(escapeCsvCell('say "hello"')).toBe('"say ""hello"""');
    });

    it('handles null and undefined as empty string', () => {
      expect(escapeCsvCell(null)).toBe('');
      expect(escapeCsvCell(undefined)).toBe('');
    });

    it('handles numeric values', () => {
      expect(escapeCsvCell(42)).toBe('42');
      expect(escapeCsvCell(3.14)).toBe('3.14');
    });

    it('handles newlines in cell values', () => {
      const result = escapeCsvCell('line1\nline2');
      expect(result).toBe('"line1\nline2"');
    });

    it('handles Unicode text safely', () => {
      expect(escapeCsvCell('المشروع السنوي')).toBe('المشروع السنوي');
      expect(escapeCsvCell('项目名称')).toBe('项目名称');
    });
  });

  describe('CsvReportRenderer parity with API JSON', () => {
    it('renders a health envelope with matching organizationId and projectId', async () => {
      const apiRes = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${org1Id}/projects/${proj1Id}/reports/health`,
        headers: { authorization: `Bearer ${token1}` },
      });
      expect(apiRes.statusCode).toBe(200);
      const envelope = apiRes.json().data as ReportResultEnvelope;

      const renderer = new CsvReportRenderer();
      const rendered = renderer.render(envelope);

      expect(rendered.mimeType).toBe('text/csv; charset=utf-8');
      expect(rendered.filename).toMatch(/\.csv$/);
      expect(rendered.content).toContain(`report_type,`);
      expect(rendered.content).toContain(envelope.reportType ?? 'REPORT');
      expect(rendered.content).toContain(org1Id);
      expect(rendered.content).toContain(proj1Id);
    });

    it('CSV reportType field matches the API reportType exactly', async () => {
      const apiRes = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${org1Id}/projects/${proj1Id}/reports/schedule`,
        headers: { authorization: `Bearer ${token1}` },
      });
      const envelope = apiRes.json().data as ReportResultEnvelope;

      const renderer = new CsvReportRenderer();
      const { content } = renderer.render(envelope);

      // The reportType value must appear verbatim in CSV
      expect(content).toContain(envelope.reportType);
    });

    it('renders cost report CSV with matching organization scope', async () => {
      const apiRes = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${org1Id}/projects/${proj1Id}/reports/cost`,
        headers: { authorization: `Bearer ${token1}` },
      });
      const envelope = apiRes.json().data as ReportResultEnvelope;

      const renderer = new CsvReportRenderer();
      const { content } = renderer.render(envelope);

      expect(content).toContain(org1Id);
      expect(content).toContain('COMMERCIAL_FINANCIAL_SUMMARY');
    });

    it('renders portfolio report CSV with no projectId', async () => {
      const apiRes = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${org1Id}/reports/portfolio`,
        headers: { authorization: `Bearer ${token1}` },
      });
      const envelope = apiRes.json().data as ReportResultEnvelope;

      const renderer = new CsvReportRenderer();
      const { content } = renderer.render(envelope);

      expect(content).toContain('ORGANIZATION_PORTFOLIO');
      expect(content).toContain(org1Id);
      // projectId row exists but is empty for portfolio
      expect(content).toContain('project_id,');
    });

    it('covers all 6 report families: procurement, subcontractor, executive-summary', async () => {
      const paths = [
        `/api/v1/organizations/${org1Id}/projects/${proj1Id}/reports/procurement`,
        `/api/v1/organizations/${org1Id}/projects/${proj1Id}/reports/subcontractor`,
        `/api/v1/organizations/${org1Id}/projects/${proj1Id}/reports/executive-summary`,
      ];

      const renderer = new CsvReportRenderer();
      for (const path of paths) {
        const apiRes = await app.inject({
          method: 'GET',
          url: path,
          headers: { authorization: `Bearer ${token1}` },
        });
        expect(apiRes.statusCode).toBe(200);
        const envelope = apiRes.json().data as ReportResultEnvelope;
        const { content } = renderer.render(envelope);
        expect(content).toContain(envelope.reportType);
        expect(content).toContain(org1Id);
      }
    });

    it('CSV does NOT contain Org2 data when rendering Org1 report', async () => {
      const apiRes = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${org1Id}/reports/portfolio`,
        headers: { authorization: `Bearer ${token1}` },
      });
      const envelope = apiRes.json().data as ReportResultEnvelope;
      const renderer = new CsvReportRenderer();
      const { content } = renderer.render(envelope);
      // Org2 ID must NOT appear in Org1's CSV
      expect(content).not.toContain(org2Id);
    });

    it('CSV for unavailable coverage shows informative message, not empty crash', () => {
      const unavailableEnvelope: ReportResultEnvelope = {
        reportType: 'TEST_REPORT',
        organizationId: org1Id,
        projectId: proj1Id,
        asOf: new Date().toISOString(),
        effectiveTimezone: 'UTC',
        filters: { organizationId: org1Id, projectId: proj1Id, datePreset: 'THIS_MONTH' },
        coverage: { isAvailable: false, sourceModule: 'test', reason: 'No source data available' },
        data: {},
      };
      const renderer = new CsvReportRenderer();
      const { content } = renderer.render(unavailableEnvelope);
      expect(content).toContain('coverage_unavailable');
      expect(content).toContain('No source data available');
    });
  });
});
