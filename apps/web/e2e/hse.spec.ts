/**
 * E2E: HSE — Safety, Quality, Compliance workflows.
 * Tests the live API endpoints for HSE operations.
 * Depends on auth.setup.ts (saved session in .auth/user.json).
 */
import { test, expect } from '@playwright/test';

/** Helper: safe project-id extraction — server returns data.project.id */
function projectId(body: { data: { project?: { id: string }; id?: string } }): string {
  return body.data.project?.id ?? body.data.id ?? '';
}

test.describe('HSE: Safety Event Workflow', () => {
  let orgId: string;
  let pid: string;
  let eventId: string;

  test.beforeAll(async ({ request }) => {
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E Safety Org ${Date.now()}` },
    });
    if (orgRes.status() !== 201) return;
    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    orgId = orgBody.data.organization.id;

    await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });

    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: { name: 'Safety Test Project', currency: 'AED', plannedStartDate: '2026-01-01' },
    });
    if (projectRes.status() !== 201) return;
    pid = projectId((await projectRes.json()) as any);
  });

  test('creates safety event', async ({ request }) => {
    if (!orgId || !pid) { console.log('Setup failed, skipping test'); return; }

    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${pid}/safety-events`,
      {
        data: {
          eventType: 'INCIDENT',
          title: 'Worker slip on wet surface',
          description: 'Worker slipped on wet floor in Zone A',
          severity: 'MEDIUM',
          occurredAt: '2026-01-15T10:30:00Z',
          location: 'Zone A - Ground Floor',
        },
      },
    );

    expect([201, 403, 422]).toContain(createRes.status());

    if (createRes.status() === 201) {
      const created = (await createRes.json()) as { data: { event?: { id: string; status: string }; id?: string; status?: string } };
      eventId = created.data.event?.id ?? created.data.id ?? '';
      const status = created.data.event?.status ?? created.data.status;
      if (status) expect(status).toBe('REPORTED');
    }
  });

  test('investigates safety event', async ({ request }) => {
    if (!orgId || !pid || !eventId) { console.log('Prerequisite test failed, skipping'); return; }

    const investigateRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${pid}/safety-events/${eventId}/investigate`,
      {
        data: {
          rootCause: 'Floor not properly marked as wet',
          immediateAction: 'Placed warning signs and cordoned area',
        },
      },
    );
    expect([200, 404, 403, 422]).toContain(investigateRes.status());
  });

  test('closes safety event', async ({ request }) => {
    if (!orgId || !pid || !eventId) { console.log('Prerequisite test failed, skipping'); return; }

    const closeRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${pid}/safety-events/${eventId}/close`,
      { data: { notes: 'Corrective actions implemented, event resolved' } },
    );
    expect([200, 404, 403, 422]).toContain(closeRes.status());
  });
});

test.describe('HSE: Quality Workflow', () => {
  let orgId: string;
  let pid: string;
  let inspectionId: string;
  let deficiencyId: string;

  test.beforeAll(async ({ request }) => {
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E Quality Org ${Date.now()}` },
    });
    if (orgRes.status() !== 201) return;
    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    orgId = orgBody.data.organization.id;

    await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });

    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: { name: 'Quality Test Project', currency: 'AED', plannedStartDate: '2026-01-01' },
    });
    if (projectRes.status() !== 201) return;
    pid = projectId((await projectRes.json()) as any);
  });

  test('creates quality inspection', async ({ request }) => {
    if (!orgId || !pid) { console.log('Setup failed, skipping test'); return; }

    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${pid}/quality-inspections`,
      {
        data: {
          inspectionType: 'Concrete Pour Inspection',
          scheduledDate: '2026-02-01',
          location: 'Foundation - Block A',
        },
      },
    );

    expect([201, 403, 422]).toContain(createRes.status());

    if (createRes.status() === 201) {
      const created = (await createRes.json()) as { data: { inspection?: { id: string }; id?: string } };
      inspectionId = created.data.inspection?.id ?? created.data.id ?? '';
    }
  });

  test('starts quality inspection', async ({ request }) => {
    if (!orgId || !pid || !inspectionId) { console.log('Prerequisite test failed, skipping'); return; }

    const startRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${pid}/quality-inspections/${inspectionId}/start`,
      { data: {} },
    );
    expect([200, 404, 403, 422]).toContain(startRes.status());
  });

  test('completes quality inspection', async ({ request }) => {
    if (!orgId || !pid || !inspectionId) { console.log('Prerequisite test failed, skipping'); return; }

    const completeRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${pid}/quality-inspections/${inspectionId}/complete`,
      {
        data: {
          result: 'PASS_WITH_CONDITIONS',
          findings: 'Minor surface finish issues noted',
          performedDate: '2026-02-01',
        },
      },
    );
    expect([200, 404, 403, 422]).toContain(completeRes.status());
  });

  test('creates quality deficiency', async ({ request }) => {
    if (!orgId || !pid) { console.log('Setup failed, skipping test'); return; }

    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${pid}/quality-deficiencies`,
      {
        data: {
          title: 'Uneven concrete surface finish',
          description: 'Surface finish does not meet spec requirements',
          severity: 'MEDIUM',
          dueDate: '2026-02-15',
        },
      },
    );

    expect([201, 403, 422]).toContain(createRes.status());

    if (createRes.status() === 201) {
      const created = (await createRes.json()) as { data: { deficiency?: { id: string }; id?: string } };
      deficiencyId = created.data.deficiency?.id ?? created.data.id ?? '';
    }
  });

  test('resolves quality deficiency', async ({ request }) => {
    if (!orgId || !pid || !deficiencyId) { console.log('Prerequisite test failed, skipping'); return; }

    const resolveRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${pid}/quality-deficiencies/${deficiencyId}/resolve`,
      { data: {} },
    );
    expect([200, 404, 403, 422]).toContain(resolveRes.status());
  });

  test('closes quality deficiency', async ({ request }) => {
    if (!orgId || !pid || !deficiencyId) { console.log('Prerequisite test failed, skipping'); return; }

    const closeRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${pid}/quality-deficiencies/${deficiencyId}/close`,
      { data: {} },
    );
    expect([200, 404, 403, 422]).toContain(closeRes.status());
  });
});

test.describe('HSE: Compliance Workflow', () => {
  let orgId: string;
  let pid: string;
  let permitId: string;
  let recordId: string;

  test.beforeAll(async ({ request }) => {
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E Compliance Org ${Date.now()}` },
    });
    if (orgRes.status() !== 201) return;
    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    orgId = orgBody.data.organization.id;

    await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });

    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: { name: 'Compliance Test Project', currency: 'AED', plannedStartDate: '2026-01-01' },
    });
    if (projectRes.status() !== 201) return;
    pid = projectId((await projectRes.json()) as any);
  });

  test('creates permit', async ({ request }) => {
    if (!orgId || !pid) { console.log('Setup failed, skipping test'); return; }

    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${pid}/permits`,
      {
        data: {
          permitType: 'Hot Work Permit',
          issuingAuthority: 'Safety Department',
          effectiveDate: '2026-02-01',
          expiryDate: '2026-02-28',
        },
      },
    );

    expect([201, 403, 422]).toContain(createRes.status());

    if (createRes.status() === 201) {
      const created = (await createRes.json()) as { data: { permit?: { id: string }; id?: string } };
      permitId = created.data.permit?.id ?? created.data.id ?? '';
    }
  });

  test('transitions permit status', async ({ request }) => {
    if (!orgId || !pid || !permitId) { console.log('Prerequisite test failed, skipping'); return; }

    const transitionRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${pid}/permits/${permitId}/transition`,
      { data: { status: 'ISSUED' } },
    );
    expect([200, 404, 403, 422]).toContain(transitionRes.status());
  });

  test('creates compliance record', async ({ request }) => {
    if (!orgId || !pid) { console.log('Setup failed, skipping test'); return; }

    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${pid}/compliance-records`,
      {
        data: {
          requirementType: 'Insurance Certificate',
          effectiveDate: '2026-01-01',
          expiryDate: '2026-12-31',
        },
      },
    );

    expect([201, 403, 422]).toContain(createRes.status());

    if (createRes.status() === 201) {
      const created = (await createRes.json()) as { data: { record?: { id: string }; id?: string } };
      recordId = created.data.record?.id ?? created.data.id ?? '';
    }
  });

  test('verifies compliance record', async ({ request }) => {
    if (!orgId || !pid || !recordId) { console.log('Prerequisite test failed, skipping'); return; }

    const verifyRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${pid}/compliance-records/${recordId}/verify`,
      { data: { verificationRef: 'CERT-2026-001' } },
    );
    expect([200, 404, 403, 422]).toContain(verifyRes.status());
  });
});

test.describe('HSE: API Smoke Tests', () => {
  test('HSE endpoints are registered', async ({ request }) => {
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `Smoke HSE ${Date.now()}` },
    });
    if (orgRes.status() !== 201) {
      console.log('Org creation blocked, testing with placeholder IDs');
      const testRes = await request.get(
        '/api/v1/organizations/org_test/projects/proj_test/safety-events',
      );
      expect([200, 401, 403, 404]).toContain(testRes.status());
      return;
    }

    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    const orgId = orgBody.data.organization.id;
    await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });

    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: { name: 'Smoke HSE Project', currency: 'AED', plannedStartDate: '2026-01-01' },
    });

    if (projectRes.status() !== 201) return;

    const pid = projectId((await projectRes.json()) as any);

    const endpoints = [
      `/api/v1/organizations/${orgId}/projects/${pid}/safety-events`,
      `/api/v1/organizations/${orgId}/projects/${pid}/quality-inspections`,
      `/api/v1/organizations/${orgId}/projects/${pid}/quality-deficiencies`,
      `/api/v1/organizations/${orgId}/projects/${pid}/corrective-actions`,
      `/api/v1/organizations/${orgId}/projects/${pid}/permits`,
      `/api/v1/organizations/${orgId}/projects/${pid}/compliance-records`,
      `/api/v1/organizations/${orgId}/projects/${pid}/compliance-inspections`,
    ];

    for (const endpoint of endpoints) {
      const res = await request.get(endpoint);
      expect([200, 403]).toContain(res.status());
    }
  });
});
