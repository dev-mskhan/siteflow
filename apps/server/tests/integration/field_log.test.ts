// apps/server/tests/integration/field_log.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestApp } from '../helpers/test-app.js';
import { createVerifiedUser, createOrgWithAdmin } from '../helpers/fixtures.js';

describe('Chunk 3.6 — Field Execution & Daily Logs', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let token: string;
  let organizationId: string;
  let projectId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const email = `fieldlog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`;
    const user = await createVerifiedUser({ email });
    token = user.token;
    const org = await createOrgWithAdmin(app, token, 'FieldLog Org');
    organizationId = org.orgId;

    // Create project
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'FieldLog Project', code: 'FLP', defaultCurrency: 'USD' },
    });
    projectId = res.json().data.project.id;
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/activate`,
      headers: { authorization: `Bearer ${token}` },
    });
  }, 30000);

  it('should create a DRAFT field log', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/field-logs`,
      headers: { authorization: `Bearer ${token}` },
      payload: { logDate: '2025-11-01', notes: 'Day 1 on site' },
    });
    expect(res.statusCode).toBe(201);
    const data = res.json().data;
    expect(data.status).toBe('DRAFT');
    expect(data.logDate).toBe('2025-11-01');
    expect(data.notes).toBe('Day 1 on site');
  });

  it('should reject duplicate date for same project', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/field-logs`,
      headers: { authorization: `Bearer ${token}` },
      payload: { logDate: '2025-11-01' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('should list field logs for project', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/field-logs`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toBeInstanceOf(Array);
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
  });

  it('should get a field log by id', async () => {
    // Create a fresh log
    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/field-logs`,
      headers: { authorization: `Bearer ${token}` },
      payload: { logDate: '2025-11-02' },
    });
    const logId = created.json().data.id;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/field-logs/${logId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(logId);
  });

  it('should update a DRAFT field log notes', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/field-logs`,
      headers: { authorization: `Bearer ${token}` },
      payload: { logDate: '2025-11-03', notes: 'original' },
    });
    const logId = created.json().data.id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/field-logs/${logId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { notes: 'updated notes' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.notes).toBe('updated notes');
  });

  it('should transition DRAFT → SUBMITTED → LOCKED', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/field-logs`,
      headers: { authorization: `Bearer ${token}` },
      payload: { logDate: '2025-11-04' },
    });
    const logId = created.json().data.id;

    // Submit
    const submitted = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/field-logs/${logId}/submit`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(submitted.statusCode).toBe(200);
    expect(submitted.json().data.status).toBe('SUBMITTED');

    // Lock
    const locked = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/field-logs/${logId}/lock`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(locked.statusCode).toBe(200);
    expect(locked.json().data.status).toBe('LOCKED');
    expect(locked.json().data.lockedAt).not.toBeNull();
  });

  it('should reject updates to a LOCKED field log', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/field-logs`,
      headers: { authorization: `Bearer ${token}` },
      payload: { logDate: '2025-11-05' },
    });
    const logId = created.json().data.id;

    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/field-logs/${logId}/submit`,
      headers: { authorization: `Bearer ${token}` },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/field-logs/${logId}/lock`,
      headers: { authorization: `Bearer ${token}` },
    });

    // Attempt update on LOCKED
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/field-logs/${logId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { notes: 'should fail' },
    });
    expect(res.statusCode).toBe(422);
  });

  it('should reject locking a DRAFT log (must be SUBMITTED first)', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/field-logs`,
      headers: { authorization: `Bearer ${token}` },
      payload: { logDate: '2025-11-06' },
    });
    const logId = created.json().data.id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/field-logs/${logId}/lock`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(422);
  });
});
