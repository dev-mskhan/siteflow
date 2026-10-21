/**
 * E2E: Project list loads live data from the server.
 * Asserts the browser issues real /api/v1 requests (no mock fixtures).
 */
import { test, expect } from '@playwright/test';

test.describe('Projects live integration', () => {
  test('org projects page calls the live projects endpoint', async ({ page, request }) => {
    const createRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E Org ${Date.now()}` },
    });
    expect(createRes.status()).toBe(201);
    const body = (await createRes.json()) as { data: { organization: { id: string } } };
    const orgId = body.data.organization.id;

    const projectsCall = page.waitForResponse(
      (res) => res.url().includes(`/api/v1/organizations/${orgId}/projects`) && res.request().method() === 'GET',
    );
    await page.goto(`/org/${orgId}/projects`);
    const res = await projectsCall;

    expect(res.ok()).toBeTruthy();
    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
  });
});

