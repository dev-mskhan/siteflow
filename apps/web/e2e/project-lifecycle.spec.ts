/**
 * E2E: Project lifecycle — creates an org, creates a project through the real
 * modal, then opens the project's Phases page. Every step asserts a real
 * request to /api/v1 so the flow proves the frontend talks to the live server.
 * Depends on auth.setup.ts (saved session in .auth/user.json).
 */
import { test, expect } from '@playwright/test';

test.describe('Project lifecycle', () => {
  test('creates a project via the modal and opens its phases page', async ({ page, request }) => {
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E Org ${Date.now()}` },
    });
    expect(orgRes.status()).toBe(201);
    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    const orgId = orgBody.data.organization.id;

    await page.goto(`/org/${orgId}/projects`);

    await page.getByRole('button', { name: 'New project' }).click();
    const projectName = `E2E Project ${Date.now()}`;
    await page.getByLabel('Project name').fill(projectName);

    const createCall = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/v1/organizations/${orgId}/projects`) &&
        res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Create project' }).click();
    const createRes = await createCall;
    expect(createRes.status()).toBe(201);

    const created = (await createRes.json()) as { data: { project: { id: string } } };
    const projectId = created.data.project.id;
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}/projects/${projectId}`));

    const phasesCall = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/v1/organizations/${orgId}/projects/${projectId}`) &&
        res.request().method() === 'GET' &&
        res.ok(),
    );
    await page.goto(`/org/${orgId}/projects/${projectId}/phases`);
    await phasesCall;
    await expect(page.getByPlaceholder('Phase name').first()).toBeVisible();
  });
});
