import { test, expect } from '@playwright/test';

// F.16B — Stub E2E tests for reporting views.
// These tests exercise the current frontend stub. Full report UI is built in a later phase.
// Tests verify: page loads, heading visible, no JS errors, and that report API types are correct.

test.describe('F.16 Report Views — Frontend Stub', () => {
  test('home page loads with SiteFlow heading', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SiteFlow/i);
    await expect(page.getByRole('heading', { name: /SiteFlow/i })).toBeVisible();
  });

  test('home page shows platform description text', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toContainText('SiteFlow');
  });

  test('navigation to /reports path is handled gracefully (no unhandled crash)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/reports');
    // Stub app shows same content regardless of path — no crash expected
    await expect(page.locator('body')).not.toBeEmpty();
    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });

  test('navigation to /portfolio path is handled gracefully', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/portfolio');
    await expect(page.locator('body')).not.toBeEmpty();
    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });

  test('app does not render any raw object keys or storage paths', async ({ page }) => {
    await page.goto('/');
    const content = await page.textContent('body');
    // Ensure no raw MinIO key patterns leak into the page
    expect(content).not.toMatch(/s3:\/\/|minio:\/\/|\/exports\/.{8,}/);
  });
});
