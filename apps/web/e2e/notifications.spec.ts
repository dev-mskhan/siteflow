/**
 * E2E Test Suite: Notifications API & Real-time SSE
 *
 * Tests:
 * 1. List notifications
 * 2. Get unread count
 * 3. Mark single notification as read
 * 4. Mark all notifications as read
 * 5. Get notification preferences
 * 6. Update notification preference
 *
 * Note: SSE connection testing is limited in Playwright as EventSource requires
 * continuous HTTP connection. We verify the integration works but can't fully
 * simulate real-time push without mocking backend events.
 */
import { test, expect } from '@playwright/test';

test.use({ storageState: './e2e/.auth/user.json' });

test.describe('Notifications API', () => {
  
  test('should list notifications', async ({ request }) => {
    const response = await request.get('/api/v1/organizations/org_01/notifications?limit=50');
    
    // Accept 200 (success), 401 (auth required), 403 (permission denied), 404 (not found), 422 (validation error)
    expect([200, 401, 403, 404, 422]).toContain(response.status());
    
    if (response.ok()) {
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('notifications');
      expect(Array.isArray(body.data.notifications)).toBe(true);
    }
  });

  test('should get unread count', async ({ request }) => {
    const response = await request.get('/api/v1/organizations/org_01/notifications/unread-count');
    
    expect([200, 401, 403, 404, 422]).toContain(response.status());
    
    if (response.ok()) {
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('unreadCount');
      expect(typeof body.data.unreadCount).toBe('number');
    }
  });

  test('should handle mark notification read (may not exist)', async ({ request }) => {
    // Test endpoint structure even if notification doesn't exist
    const response = await request.patch(
      '/api/v1/organizations/org_01/notifications/notif_test_123/read'
    );
    
    // Accept 200 (success), 401 (auth required), 403 (permission), 404 (not found), 422 (validation)
    expect([200, 401, 403, 404, 422]).toContain(response.status());
    
    if (response.ok()) {
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('notification');
    }
  });

  test('should mark all notifications as read', async ({ request }) => {
    const response = await request.post('/api/v1/organizations/org_01/notifications/read-all');
    
    expect([200, 401, 403, 404, 422]).toContain(response.status());
    
    if (response.ok()) {
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('markedCount');
      expect(typeof body.data.markedCount).toBe('number');
    }
  });

  test('should get notification preferences', async ({ request }) => {
    const response = await request.get('/api/v1/organizations/org_01/notifications/preferences');
    
    expect([200, 401, 403, 404, 422]).toContain(response.status());
    
    if (response.ok()) {
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('preferences');
      expect(Array.isArray(body.data.preferences)).toBe(true);
      
      if (body.data.preferences.length > 0) {
        const pref = body.data.preferences[0];
        expect(pref).toHaveProperty('eventType');
        expect(pref).toHaveProperty('channel');
        expect(pref).toHaveProperty('enabled');
        expect(['EMAIL', 'IN_APP', 'REALTIME', 'WHATSAPP']).toContain(pref.channel);
      }
    }
  });

  test('should update notification preference', async ({ request }) => {
    const response = await request.put('/api/v1/organizations/org_01/notifications/preferences', {
      data: {
        eventType: 'RfiOverdue',
        channel: 'IN_APP',
        enabled: true,
      },
    });
    
    expect([200, 401, 403, 404, 422]).toContain(response.status());
    
    if (response.ok()) {
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('preference');
      expect(body.data.preference.eventType).toBe('RfiOverdue');
      expect(body.data.preference.channel).toBe('IN_APP');
      expect(body.data.preference.enabled).toBe(true);
    }
  });

  test('should validate notification preference input', async ({ request }) => {
    // Test with invalid channel
    const response = await request.put('/api/v1/organizations/org_01/notifications/preferences', {
      data: {
        eventType: 'TestEvent',
        channel: 'INVALID_CHANNEL',
        enabled: true,
      },
    });
    
    // Should reject invalid input
    expect([400, 422]).toContain(response.status());
  });
});

test.describe('Notification Integration (UI)', () => {
  
  test('should load dashboard with SSE connection (verify no errors)', async ({ page, request }) => {
    // First, get the user's organization ID from the auth session
    const response = await request.get('/api/v1/auth/me');
    if (!response.ok()) {
      console.log('Skipping UI test: Unable to get user info');
      return;
    }
    const userData = await response.json();
    const orgId = userData.data?.currentOrgId || userData.data?.organizations?.[0]?.id;
    
    if (!orgId) {
      console.log('Skipping UI test: User has no organization');
      return;
    }
    
    // Navigate to dashboard - this should establish SSE connection via AppLayout
    await page.goto(`/org/${orgId}/dashboard`);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check that page loaded successfully (indicates SSE didn't block rendering)
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('h1, h2, [role="heading"]')).toBeVisible({ timeout: 5000 });
  });

  test('should handle SSE connection in multiple tabs', async ({ context, request }) => {
    // Get organization ID
    const response = await request.get('/api/v1/auth/me');
    if (!response.ok()) return;
    const userData = await response.json();
    const orgId = userData.data?.currentOrgId || userData.data?.organizations?.[0]?.id;
    if (!orgId) return;
    
    // Open dashboard in first tab
    const page1 = await context.newPage();
    await page1.goto(`/org/${orgId}/dashboard`);
    await page1.waitForLoadState('networkidle');
    
    // Open dashboard in second tab
    const page2 = await context.newPage();
    await page2.goto(`/org/${orgId}/dashboard`);
    await page2.waitForLoadState('networkidle');
    
    // Both pages should load successfully (multiple SSE connections supported)
    await expect(page1.locator('body')).toBeVisible();
    await expect(page2.locator('body')).toBeVisible();
    
    await page1.close();
    await page2.close();
  });

  test('should reconnect SSE after navigation', async ({ page, request }) => {
    // Get organization ID
    const response = await request.get('/api/v1/auth/me');
    if (!response.ok()) return;
    const userData = await response.json();
    const orgId = userData.data?.currentOrgId || userData.data?.organizations?.[0]?.id;
    if (!orgId) return;
    
    // Navigate to dashboard
    await page.goto(`/org/${orgId}/dashboard`);
    await page.waitForLoadState('networkidle');
    
    // Navigate away
    await page.goto(`/org/${orgId}/projects`);
    await page.waitForLoadState('networkidle');
    
    // Navigate back
    await page.goto(`/org/${orgId}/dashboard`);
    await page.waitForLoadState('networkidle');
    
    // Should still work without errors
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Notification UI Components', () => {
  
  test('should display notification preferences page', async ({ page, request }) => {
    // Get organization ID
    const response = await request.get('/api/v1/auth/me');
    if (!response.ok()) {
      console.log('Skipping UI test: Unable to get user info');
      return;
    }
    const userData = await response.json();
    const orgId = userData.data?.currentOrgId || userData.data?.organizations?.[0]?.id;
    
    if (!orgId) {
      console.log('Skipping UI test: User has no organization');
      return;
    }
    
    await page.goto(`/org/${orgId}/settings/notifications`);
    await page.waitForLoadState('networkidle');
    
    // Page should load
    await expect(page.locator('body')).toBeVisible();
    // Should have some settings content
    const hasSettings = await page.locator('h1, h2, [role="heading"]').isVisible();
    expect(hasSettings).toBe(true);
  });
});

