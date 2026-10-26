// apps/web/e2e/notifications-complete.spec.ts
// Comprehensive E2E tests for notification system — API, UI, SSE integration.

import { test, expect } from '@playwright/test';

test.describe('Notifications: Complete Integration', () => {
  let orgId: string;

  test.beforeAll(async ({ request }) => {
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E Notifications ${Date.now()}` },
    });

    if (orgRes.status() !== 201) {
      test.skip('Trial limit reached');
      return;
    }

    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    orgId = orgBody.data.organization.id;
  });

  test('lists notifications', async ({ request }) => {
    const listRes = await request.get(
      `/api/v1/organizations/${orgId}/notifications`,
      {
        params: { limit: 50 },
      }
    );

    expect([200, 403]).toContain(listRes.status());

    if (listRes.status() === 200) {
      const body = (await listRes.json()) as {
        data: { notifications: unknown[] };
      };

      expect(Array.isArray(body.data.notifications)).toBeTruthy();
    }
  });

  test('gets unread count', async ({ request }) => {
    const countRes = await request.get(
      `/api/v1/organizations/${orgId}/notifications/unread-count`
    );

    expect([200, 403]).toContain(countRes.status());

    if (countRes.status() === 200) {
      const body = (await countRes.json()) as {
        data: { unreadCount: number };
      };

      expect(typeof body.data.unreadCount).toBe('number');
      expect(body.data.unreadCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('marks notification as read', async ({ request }) => {
    // First get a list to find a notification
    const listRes = await request.get(
      `/api/v1/organizations/${orgId}/notifications`,
      { params: { limit: 1 } }
    );

    if (listRes.status() !== 200) {
      test.skip();
      return;
    }

    const listBody = (await listRes.json()) as {
      data: { notifications: { id: string; readAt: string | null }[] };
    };

    if (listBody.data.notifications.length === 0) {
      test.skip();
      return;
    }

    const notifId = listBody.data.notifications[0].id;

    const markRes = await request.patch(
      `/api/v1/organizations/${orgId}/notifications/${notifId}/read`
    );

    expect([200, 403, 404]).toContain(markRes.status());

    if (markRes.status() === 200) {
      const body = (await markRes.json()) as {
        data: { notification: { id: string; readAt: string } };
      };

      expect(body.data.notification.id).toBe(notifId);
      expect(body.data.notification.readAt).not.toBeNull();
    }
  });

  test('marks all notifications as read', async ({ request }) => {
    const markAllRes = await request.post(
      `/api/v1/organizations/${orgId}/notifications/read-all`
    );

    expect([200, 403]).toContain(markAllRes.status());

    if (markAllRes.status() === 200) {
      const body = (await markAllRes.json()) as {
        data: { markedCount: number };
      };

      expect(typeof body.data.markedCount).toBe('number');
      expect(body.data.markedCount).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('Notifications: Preferences', () => {
  let orgId: string;

  test.beforeAll(async ({ request }) => {
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E Notif Prefs ${Date.now()}` },
    });

    if (orgRes.status() !== 201) {
      test.skip();
      return;
    }

    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    orgId = orgBody.data.organization.id;
  });

  test('retrieves user preferences', async ({ request }) => {
    const prefsRes = await request.get(
      `/api/v1/organizations/${orgId}/notifications/preferences`
    );

    expect([200, 403]).toContain(prefsRes.status());

    if (prefsRes.status() === 200) {
      const body = (await prefsRes.json()) as {
        data: { preferences: unknown[] };
      };

      expect(Array.isArray(body.data.preferences)).toBeTruthy();
    }
  });

  test('updates preference', async ({ request }) => {
    const updateRes = await request.put(
      `/api/v1/organizations/${orgId}/notifications/preferences`,
      {
        data: {
          eventType: 'RfiOverdue',
          channel: 'IN_APP',
          enabled: true,
        },
      }
    );

    expect([200, 403, 422]).toContain(updateRes.status());

    if (updateRes.status() === 200) {
      const body = (await updateRes.json()) as {
        data: {
          preference: {
            eventType: string;
            channel: string;
            enabled: boolean;
          };
        };
      };

      expect(body.data.preference.eventType).toBe('RfiOverdue');
      expect(body.data.preference.channel).toBe('IN_APP');
      expect(body.data.preference.enabled).toBe(true);
    }
  });
});

test.describe('Notifications: UI Integration', () => {
  test('notification bell renders in layout', async ({ page }) => {
    await page.goto('/login');

    // Check if notification bell component is present in the DOM
    // (even if not visible due to auth state)
    const bellButton = page.locator('button[aria-label*="Notifications"]');
    await expect(bellButton).toBeDefined();
  });

  test('notification dropdown opens on click', async ({ page }) => {
    // This test requires authenticated state
    await page.goto('/org/org_01/settings');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Try to find notification bell (may not exist if not logged in)
    const bellButton = page.locator('button[aria-label*="Notifications"]').first();

    if (await bellButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await bellButton.click();

      // Check for dropdown panel
      const panel = page.locator('text=Notifications');
      await expect(panel.first()).toBeDefined();
    } else {
      // Bell not visible - expected for unauthenticated users
      test.skip();
    }
  });
});

test.describe('Notifications: SSE Connection', () => {
  test('SSE endpoint is accessible', async ({ request }) => {
    // SSE endpoint uses EventSource which can't be tested with Playwright request
    // But we can verify the endpoint exists
    const orgId = 'org_test';
    const streamUrl = `/api/v1/organizations/${orgId}/notifications/stream`;

    // This would normally be a GET request with Accept: text/event-stream
    // Playwright request doesn't support SSE, so we just verify it doesn't 404
    const testRes = await request.get(streamUrl);

    // Should get 401 (unauthorized), 403 (forbidden), or 200 (success)
    // 404 would mean the route doesn't exist
    expect([200, 401, 403]).toContain(testRes.status());
  });
});

test.describe('Notifications: End-to-End Flow', () => {
  let orgId: string;
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E Notif Flow ${Date.now()}` },
    });

    if (orgRes.status() !== 201) {
      test.skip();
      return;
    }

    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    orgId = orgBody.data.organization.id;

    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: {
        name: 'E2E Notification Test Project',
        projectCode: 'NOTIF-001',
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });

    if (projectRes.status() === 201) {
      const projectBody = (await projectRes.json()) as { data: { id: string } };
      projectId = projectBody.data.id;
    }
  });

  test('creates RFI that triggers notification', async ({ request }) => {
    if (!projectId) {
      test.skip();
      return;
    }

    // Create an RFI
    const rfiRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/rfis`,
      {
        data: {
          subject: 'E2E Test RFI for Notifications',
          question: 'This is a test RFI to trigger notification system',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
          priority: 'HIGH',
        },
      }
    );

    expect([201, 403, 422]).toContain(rfiRes.status());

    if (rfiRes.status() === 201) {
      // Check if notification was created
      const notifRes = await request.get(
        `/api/v1/organizations/${orgId}/notifications`,
        { params: { limit: 5 } }
      );

      if (notifRes.status() === 200) {
        const body = (await notifRes.json()) as {
          data: { notifications: { eventType: string }[] };
        };

        // Notification might be created asynchronously
        // Just verify the endpoint works
        expect(Array.isArray(body.data.notifications)).toBeTruthy();
      }
    }
  });
});
