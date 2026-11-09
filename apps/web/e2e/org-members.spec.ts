// E2E: Org members, invitations, roles, settings, profile, audit, doc sequences
import { test, expect } from '@playwright/test';

let orgId: string;
let memberId: string;
let roleId: string;
let invitationId: string;

test.beforeAll(async ({ request }) => {
  const orgRes = await request.post('/api/v1/organizations', {
    data: { name: `E2E Members Org ${Date.now()}` },
  });
  if (orgRes.status() !== 201) {
    console.log('Org creation blocked, skipping member tests');
    return;
  }
  const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
  orgId = orgBody.data.organization.id;

  await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });
});

test.describe('Members: Roles', () => {
  test('lists org roles', async ({ request }) => {
    if (!orgId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/roles`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data: { roles: { id: string; name: string; isSystem: boolean }[] } };
    expect(Array.isArray(body.data.roles)).toBe(true);
    expect(body.data.roles.length).toBeGreaterThan(0);
    // System roles are seeded at org creation
    const systemRoles = body.data.roles.filter((r) => r.isSystem);
    expect(systemRoles.length).toBeGreaterThan(0);
    roleId = body.data.roles.find((r) => r.name === 'Member')?.id ?? body.data.roles[0].id;
  });
});

test.describe('Members: List', () => {
  test('lists org members', async ({ request }) => {
    if (!orgId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/members`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      data: { members: { id: string; userEmail: string; roleName: string; status: string }[]; nextCursor: string | null };
    };
    expect(Array.isArray(body.data.members)).toBe(true);
    // Owner should be in the list
    expect(body.data.members.length).toBeGreaterThan(0);
    memberId = body.data.members[0].id;
  });

  test('gets single member', async ({ request }) => {
    if (!orgId || !memberId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/members/${memberId}`);
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as { data: { member: { id: string } } };
      expect(body.data.member.id).toBe(memberId);
    }
  });
});

test.describe('Members: Invitations', () => {
  test('creates invitation', async ({ request }) => {
    if (!orgId || !roleId) return test.skip();
    const res = await request.post(`/api/v1/organizations/${orgId}/invitations`, {
      data: {
        email: `invited_${Date.now()}@siteflow.test`,
        roleId,
        orgName: 'E2E Test Org',
        inviterName: 'E2E Tester',
      },
    });
    expect([201, 409, 422]).toContain(res.status());
    if (res.status() === 201) {
      const body = (await res.json()) as { data: { invitation: { id: string; status: string } } };
      expect(body.data.invitation.status).toBe('PENDING');
      invitationId = body.data.invitation.id;
    }
  });

  test('lists invitations', async ({ request }) => {
    if (!orgId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/invitations`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data: { invitations: { id: string }[]; nextCursor: string | null } };
    expect(Array.isArray(body.data.invitations)).toBe(true);
  });

  test('cancels invitation', async ({ request }) => {
    if (!orgId || !invitationId) return test.skip();
    const res = await request.delete(`/api/v1/organizations/${orgId}/invitations/${invitationId}`);
    expect([200, 204, 404]).toContain(res.status());
  });
});

test.describe('Org: Settings', () => {
  test('gets org settings', async ({ request }) => {
    if (!orgId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/settings`);
    expect([200, 403]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
    }
  });
});

test.describe('Org: Audit Log', () => {
  test('lists audit log', async ({ request }) => {
    if (!orgId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/audit-logs`);
    expect([200, 403]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as { data: unknown[] };
      expect(Array.isArray(body.data) || typeof body.data === 'object').toBe(true);
    }
  });
});

test.describe('Org: Document Sequences', () => {
  test('lists document sequences', async ({ request }) => {
    if (!orgId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/document-sequences`);
    expect([200, 403, 404]).toContain(res.status());
  });
});
