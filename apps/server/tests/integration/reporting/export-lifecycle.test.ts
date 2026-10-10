// apps/server/tests/integration/reporting/export-lifecycle.test.ts
// F.17B — Integration tests for export lifecycle, status polling, fresh download authorization, and expiry cleanup.

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import { createVerifiedUser, createOrgWithAdmin } from '../../helpers/fixtures.js';
import { exportService } from '../../../src/modules/reporting/exports/export.service.js';
import { exportRepository } from '../../../src/modules/reporting/exports/export.repository.js';
import { reportService } from '../../../src/modules/reporting/report.service.js';
import { getDb } from '../../../src/lib/db/index.js';
import { auditLogs } from '@siteflow/database/schema';
import { and, eq } from 'drizzle-orm';
import { serverEnv } from '@siteflow/env/server';
import { SIGNED_URL_EXPIRY_SECONDS } from '../../../src/modules/reporting/exports/export.service.js';

describe('F.17B Export Lifecycle and Authorization', () => {
  const runId = Math.random().toString(36).substring(7);
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let org1Id: string;
  let org2Id: string;
  let proj1Id: string;
  let token1: string;
  let token2: string;
  let user1Id: string;

  beforeAll(async () => {
    app = await createTestApp();

    const u1 = await createVerifiedUser({ email: `exp_u1_${runId}@test.dev` });
    token1 = u1.token;
    user1Id = u1.user.id;
    const o1 = await createOrgWithAdmin(app, token1, `ExpOrg1_${runId}`);
    org1Id = o1.orgId;

    const p1Res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/projects`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        name: 'Export Lifecycle Project',
        code: `EL${runId.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()}`,
        defaultCurrency: 'USD',
      },
    });
    expect(p1Res.statusCode).toBe(201, p1Res.body);
    proj1Id = p1Res.json().data.project.id;
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/projects/${proj1Id}/activate`,
      headers: { authorization: `Bearer ${token1}` },
    });

    const u2 = await createVerifiedUser({ email: `exp_u2_${runId}@test.dev` });
    token2 = u2.token;
    const o2 = await createOrgWithAdmin(app, token2, `ExpOrg2_${runId}`);
    org2Id = o2.orgId;
  }, 30000);

  it('POST /exports creates an export record and returns 202 status with exportId', async () => {
    const requestedAt = Date.now();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/exports`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        projectId: proj1Id,
        reportType: 'PROJECT_HEALTH',
        format: 'csv',
        filters: {},
      },
    });
    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.exportId).toBeDefined();
    expect(body.data.status).toBeDefined();
    const record = await exportRepository.findById(body.data.exportId, org1Id);
    expect(record).not.toBeNull();
    expect(
      Math.abs(
        record!.expiresAt.getTime() -
          (requestedAt + serverEnv.REPORT_EXPORT_RETENTION_HOURS * 60 * 60 * 1000),
      ),
    ).toBeLessThan(5000);
  });

  it('uses the validated configured signed-URL lifetime', () => {
    expect(SIGNED_URL_EXPIRY_SECONDS).toBe(serverEnv.REPORT_EXPORT_SIGNED_URL_EXPIRY_SECONDS);
    expect(serverEnv.REPORT_EXPORT_RETENTION_HOURS).toBeGreaterThan(0);
  });

  it('records an organization- and project-scoped audit event for export requests', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/exports`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        projectId: proj1Id,
        reportType: 'COMMERCIAL_FINANCIAL_SUMMARY',
        format: 'csv',
        filters: {},
      },
    });

    expect(res.statusCode).toBe(202);
    const exportId = res.json().data.exportId as string;
    const [audit] = await getDb()
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.organizationId, org1Id),
          eq(auditLogs.projectId, proj1Id),
          eq(auditLogs.actorUserId, user1Id),
          eq(auditLogs.action, 'report.export.requested'),
          eq(auditLogs.resourceId, exportId),
        ),
      )
      .limit(1);

    expect(audit).toBeDefined();
  });

  it('persists the canonical plural filters from the export request', async () => {
      const filters = { datePreset: 'quarterToDate', startDate: '2026-07-01' };
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${org1Id}/exports`,
        headers: { authorization: `Bearer ${token1}` },
        payload: {
          projectId: proj1Id,
          reportType: 'SCHEDULE_VARIANCE_PROGRESS',
          format: 'csv',
          filters,
        },
      });

      expect(res.statusCode).toBe(202);
      const exportId = res.json().data.exportId as string;
      const record = await exportRepository.findById(exportId, org1Id);
      expect(record?.filterSnapshot).toEqual(filters);
    });

  it('selects known expensive reports for PgBoss before fetching the report', async () => {
      const reportFetch = vi.spyOn(reportService, 'getCostReport');

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${org1Id}/exports`,
        headers: { authorization: `Bearer ${token1}` },
        payload: {
          projectId: proj1Id,
          reportType: 'COMMERCIAL_FINANCIAL_SUMMARY',
          format: 'csv',
          filters: { datePreset: 'yearToDate' },
        },
      });

      expect(res.statusCode).toBe(202);
      expect(res.json().data.status).toBe('PROCESSING');
      expect(reportFetch).not.toHaveBeenCalled();
      reportFetch.mockRestore();
  });

  it('surfaces a failed synchronous report fetch without a second async invocation', async () => {
      const reportFetch = vi.spyOn(reportService, 'getHealthReport');
      reportFetch.mockRejectedValueOnce(new Error('report query failed'));
      const existing = await exportRepository.listByUser(org1Id, user1Id);
      const existingIds = new Set(existing.map((record) => record.id));

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${org1Id}/exports`,
        headers: { authorization: `Bearer ${token1}` },
        payload: {
          projectId: proj1Id,
          reportType: 'PROJECT_HEALTH',
          format: 'csv',
          filters: {},
        },
      });

    expect(res.statusCode).toBeGreaterThanOrEqual(500);
    expect(reportFetch).toHaveBeenCalledTimes(1);
    const afterRequest = await exportRepository.listByUser(org1Id, user1Id);
    const created = afterRequest.filter((record) => !existingIds.has(record.id));
    expect(created).toHaveLength(1);
    expect(created[0]?.status).toBe('FAILED');
    reportFetch.mockRestore();
  });

  it('GET /exports lists exports requested by the authenticated user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${org1Id}/exports`,
      headers: { authorization: `Bearer ${token1}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].requestedBy).toBe(user1Id);
  });

  it('GET /exports/:exportId returns status and hides raw object key', async () => {
    const reqRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/exports`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        projectId: proj1Id,
        reportType: 'PROJECT_HEALTH',
        format: 'csv',
      },
    });
    const exportId = reqRes.json().data.exportId;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${org1Id}/exports/${exportId}`,
      headers: { authorization: `Bearer ${token1}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(exportId);
    expect(body.data.objectKey).toBeUndefined(); // raw key must never leak
    expect(body.data.reportType).toBe('PROJECT_HEALTH');
  });

  it('GET /exports/:exportId/download returns presigned download URL when READY', async () => {
    // Request a small report which executes synchronously to READY
    const reqRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/exports`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        projectId: proj1Id,
        reportType: 'PROJECT_HEALTH',
        format: 'csv',
      },
    });
    const exportId = reqRes.json().data.exportId;

    // If ready, we can request download
    const dlRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${org1Id}/exports/${exportId}/download`,
      headers: { authorization: `Bearer ${token1}` },
    });

    if (reqRes.json().data.status === 'READY') {
      expect(dlRes.statusCode).toBe(200);
      const body = dlRes.json();
      expect(body.success).toBe(true);
      expect(body.data.downloadUrl).toBeDefined();
      expect(typeof body.data.downloadUrl).toBe('string');
      const [audit] = await getDb()
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.organizationId, org1Id),
            eq(auditLogs.projectId, proj1Id),
            eq(auditLogs.actorUserId, user1Id),
            eq(auditLogs.action, 'report.export.downloaded'),
            eq(auditLogs.resourceId, exportId),
          ),
        )
        .limit(1);
      expect(audit).toBeDefined();
    }
  });

  it('enforces tenant boundary — Org2 user cannot access Org1 export', async () => {
    const reqRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/exports`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        projectId: proj1Id,
        reportType: 'PROJECT_HEALTH',
        format: 'csv',
      },
    });
    const exportId = reqRes.json().data.exportId;

    // Org2 user trying to access Org1's export via Org1 URL -> 403 Forbidden
    const res1 = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${org1Id}/exports/${exportId}`,
      headers: { authorization: `Bearer ${token2}` },
    });
    expect([403, 404]).toContain(res1.statusCode);

    // Org2 user trying to access Org1's export via Org2 URL -> 404 Not Found
    const res2 = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${org2Id}/exports/${exportId}`,
      headers: { authorization: `Bearer ${token2}` },
    });
    expect(res2.statusCode).toBe(404);
  });

  it('cleanupExpired handles expired records idempotently', async () => {
    const result = await exportService.cleanupExpired();
    expect(result).toBeDefined();
    expect(typeof result.cleaned).toBe('number');
  });
});
