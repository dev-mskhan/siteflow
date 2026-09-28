// apps/server/tests/integration/schedule_history.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestApp } from '../helpers/test-app.js';
import { createVerifiedUser, createOrgWithAdmin } from '../helpers/fixtures.js';

describe('Chunk 3.8 — Schedule History', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let token: string;
  let organizationId: string;
  let projectId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const email = `schedhistory_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`;
    const user = await createVerifiedUser({ email });
    token = user.token;
    const org = await createOrgWithAdmin(app, token, 'SchedHistory Org');
    organizationId = org.orgId;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'History Project', code: 'HIP', defaultCurrency: 'USD' },
    });
    projectId = res.json().data.project.id;
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/activate`,
      headers: { authorization: `Bearer ${token}` },
    });
  }, 30000);

  it('should return an empty list when no schedule changes recorded', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/schedule/history`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toBeInstanceOf(Array);
    expect(res.json().data.length).toBe(0);
  });

  it('should support taskId query filter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/schedule/history?taskId=nonexistent`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toBeInstanceOf(Array);
  });
});
