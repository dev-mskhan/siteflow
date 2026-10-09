import { test, expect } from '@playwright/test';

// F.17C — Stub E2E tests for CSV export controls.
// These tests exercise the frontend stub. Full export UI is built in a later phase.
// Tests verify: page loads without errors, no raw keys/URLs exposed, and export control structure.

test.describe('F.17 Export Controls — Frontend Stub', () => {
  test('home page loads without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await expect(page).toHaveTitle(/SiteFlow/i);
    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });

  test('/exports path is handled without unhandled crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/exports');
    await expect(page.locator('body')).not.toBeEmpty();
    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });

  test('app does not expose raw MinIO object keys or signed URL tokens', async ({ page }) => {
    await page.goto('/');
    const content = await page.textContent('body');
    // Ensure no raw storage keys or signed URL tokens leak
    expect(content).not.toMatch(/X-Amz-Signature|minio:\/\/|reports\/exports\//i);
  });

  test('no PDF or XLSX controls are present (CSV only per D-01)', async ({ page }) => {
    await page.goto('/');
    const content = await page.textContent('body');
    // PDF and XLSX are deferred per D-01
    expect(content?.toLowerCase()).not.toContain('download as pdf');
    expect(content?.toLowerCase()).not.toContain('download as xlsx');
    expect(content?.toLowerCase()).not.toContain('export xlsx');
    expect(content?.toLowerCase()).not.toContain('export pdf');
  });
});
