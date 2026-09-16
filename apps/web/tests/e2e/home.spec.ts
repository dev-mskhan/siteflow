import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('loads and shows SiteFlow heading', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SiteFlow/i);
    await expect(page.getByRole('heading', { name: /siteflow/i })).toBeVisible();
  });
});
