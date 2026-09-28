// apps/server/tests/integration/issue.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestApp } from '../helpers/test-app.js';
import { createVerifiedUser, createOrgWithAdmin } from '../helpers/fixtures.js';

describe('Chunk 3.7 — Issues & Impact Reporting', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let token: string;
  let organizationId: string;
  let projectId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const email = `issue_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`;
    const user = await createVerifiedUser({ email });
    token = user.token;
    const org = await createOrgWithAdmin(app, token, 'Issue Org');
    organizationId = org.orgId;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Issue Project', code: 'ISP', defaultCurrency: 'USD' },
    });
    projectId = res.json().data.project.id;
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/activate`,
      headers: { authorization: `Bearer ${token}` },
    });
  }, 30000);

  it('should create an issue with reported impact days', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/issues`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Foundation delay', description: 'Soil issue', reportedImpactDays: 5 },
    });
    expect(res.statusCode).toBe(201);
    const data = res.json().data;
    expect(data.status).toBe('OPEN');
    expect(data.reportedImpactDays).toBe(5);
    expect(data.approvedImpactDays).toBe(0);
  });

  it('should list issues for project', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/issues`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toBeInstanceOf(Array);
  });

  it('should get an issue by id', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/issues`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Weather delay' },
    });
    const issueId = created.json().data.id;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/issues/${issueId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(issueId);
  });

  it('should update reported and approved impact days separately', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/issues`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Material delay', reportedImpactDays: 10 },
    });
    const issueId = created.json().data.id;

    // Approve 7 days — less than reported
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/issues/${issueId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { approvedImpactDays: 7 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.reportedImpactDays).toBe(10);
    expect(res.json().data.approvedImpactDays).toBe(7);
  });

  it('should transition issue OPEN → IN_PROGRESS → RESOLVED', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/issues`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Transition test' },
    });
    const issueId = created.json().data.id;

    const toInProgress = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/issues/${issueId}/transition`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'IN_PROGRESS' },
    });
    expect(toInProgress.statusCode).toBe(200);
    expect(toInProgress.json().data.status).toBe('IN_PROGRESS');

    const toResolved = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/issues/${issueId}/transition`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'RESOLVED' },
    });
    expect(toResolved.statusCode).toBe(200);
    expect(toResolved.json().data.status).toBe('RESOLVED');
  });

  it('should reject invalid transition CLOSED → IN_PROGRESS', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/issues`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Closed issue' },
    });
    const issueId = created.json().data.id;

    // Close it
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/issues/${issueId}/transition`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'CLOSED' },
    });

    // Attempt invalid transition
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/issues/${issueId}/transition`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'IN_PROGRESS' },
    });
    expect(res.statusCode).toBe(422);
  });
});
