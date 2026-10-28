import { test, expect } from '@playwright/test';

test('section menus stay compact, dismiss on outside click, and show required errors inline', async ({
  page,
}) => {
  await page.goto('/login');
  const apiPost = async (url: string, data: Record<string, unknown>) =>
    page.evaluate(
      async ({ requestUrl, body }) => {
        const response = await fetch(requestUrl, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        return { status: response.status, data: await response.json() };
      },
      { requestUrl: url, body: data },
    );

  const orgResponse = await apiPost('/api/v1/organizations', {
    name: `Navigation UX ${Date.now()}`,
  });
  expect(orgResponse.status).toBe(201);
  const orgId = orgResponse.data.data.organization.id as string;
  await apiPost(`/api/v1/organizations/${orgId}/billing/trial`, {});

  const projectResponse = await apiPost(`/api/v1/organizations/${orgId}/projects`, {
    name: 'Navigation UX project',
    projectCode: `UX-${Date.now()}`,
    description: 'Navigation smoke test',
    startDate: '2026-01-01',
    currencyCode: 'AED',
  });
  expect(projectResponse.status).toBe(201);
  const projectId = (projectResponse.data.data.project?.id ?? projectResponse.data.data.id) as string;
  await apiPost(`/api/v1/organizations/${orgId}/projects/${projectId}/activate`, {});

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/org/${orgId}/projects/${projectId}/settings`);

  const picker = page.getByRole('button', { name: 'Settings', exact: true });
  await expect(picker).toBeVisible();
  await picker.click();
  const sections = page.getByRole('navigation', { name: 'Page sections' });
  await expect(sections).toBeVisible();
  await expect(sections.getByRole('link', { name: 'Phases' })).toHaveCount(0);
  await page.getByRole('heading', { name: 'Navigation UX project' }).click();
  await expect(sections).toBeHidden();

  await picker.click();
  await sections.getByRole('button', { name: /Planning/ }).click();
  await sections.getByRole('link', { name: 'Phases' }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/phases$`));
  await expect(sections).toBeHidden();
  await page.goto(`/org/${orgId}/tenders`);
  await page.goto(`/org/${orgId}/tenders`);
  await page.getByRole('button', { name: 'New tender' }).click();
  await page.getByRole('button', { name: 'Create tender' }).click();
  await expect(page.getByText('Title is required.')).toBeVisible();
  await expect(page.getByText('Required fields missing')).toHaveCount(0);
});
