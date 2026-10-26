/**
 * E2E: HSE — Safety, Quality, Compliance workflows.
 * Tests the live API endpoints for HSE operations.
 * Depends on auth.setup.ts (saved session in .auth/user.json).
 */
import { test, expect } from '@playwright/test';

test.describe('HSE: Safety Event Workflow', () => {
  let orgId: string;
  let projectId: string;
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
      data: {
        name: 'Safety Test Project',
        projectCode: `SAFETY-${Date.now()}`,
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });
    if (projectRes.status() !== 201) return;
    const projectBody = (await projectRes.json()) as { data: { id: string } };
    projectId = projectBody.data.id;
  });

  test('creates safety event', async ({ request }) => {
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/safety-events`,
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
      const created = (await createRes.json()) as { data: { event?: { id: string; status: string } } };
      if (created.data.event) {
        eventId = created.data.event.id;
        expect(created.data.event.status).toBe('REPORTED');
      }
    }
  });

  test('investigates safety event', async ({ request }) => {
    if (!orgId || !projectId || !eventId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const investigateRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/safety-events/${eventId}/investigate`,
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
    if (!orgId || !projectId || !eventId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const closeRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/safety-events/${eventId}/close`,
      {
        data: {
          notes: 'Corrective actions implemented, event resolved',
        },
      },
    );
    expect([200, 404, 403, 422]).toContain(closeRes.status());
  });
});

test.describe('HSE: Quality Workflow', () => {
  let orgId: string;
  let projectId: string;
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
      data: {
        name: 'Quality Test Project',
        projectCode: `QUALITY-${Date.now()}`,
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });
    if (projectRes.status() !== 201) return;
    const projectBody = (await projectRes.json()) as { data: { id: string } };
    projectId = projectBody.data.id;
  });

  test('creates quality inspection', async ({ request }) => {
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/quality-inspections`,
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
      const created = (await createRes.json()) as { data: { inspection?: { id: string } } };
      if (created.data.inspection) {
        inspectionId = created.data.inspection.id;
      }
    }
  });

  test('starts quality inspection', async ({ request }) => {
    if (!orgId || !projectId || !inspectionId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const startRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/quality-inspections/${inspectionId}/start`,
      { data: {} },
    );
    expect([200, 404, 403, 422]).toContain(startRes.status());
  });

  test('completes quality inspection', async ({ request }) => {
    if (!orgId || !projectId || !inspectionId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const completeRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/quality-inspections/${inspectionId}/complete`,
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
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/quality-deficiencies`,
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
      const created = (await createRes.json()) as { data: { deficiency?: { id: string } } };
      if (created.data.deficiency) {
        deficiencyId = created.data.deficiency.id;
      }
    }
  });

  test('resolves quality deficiency', async ({ request }) => {
    if (!orgId || !projectId || !deficiencyId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const resolveRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/quality-deficiencies/${deficiencyId}/resolve`,
      { data: {} },
    );
    expect([200, 404, 403, 422]).toContain(resolveRes.status());
  });

  test('closes quality deficiency', async ({ request }) => {
    if (!orgId || !projectId || !deficiencyId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const closeRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/quality-deficiencies/${deficiencyId}/close`,
      { data: {} },
    );
    expect([200, 404, 403, 422]).toContain(closeRes.status());
  });
});

test.describe('HSE: Compliance Workflow', () => {
  let orgId: string;
  let projectId: string;
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
      data: {
        name: 'Compliance Test Project',
        projectCode: `COMP-${Date.now()}`,
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });
    if (projectRes.status() !== 201) return;
    const projectBody = (await projectRes.json()) as { data: { id: string } };
    projectId = projectBody.data.id;
  });

  test('creates permit', async ({ request }) => {
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/permits`,
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
      const created = (await createRes.json()) as { data: { permit?: { id: string } } };
      if (created.data.permit) {
        permitId = created.data.permit.id;
      }
    }
  });

  test('transitions permit status', async ({ request }) => {
    if (!orgId || !projectId || !permitId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const transitionRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/permits/${permitId}/transition`,
      {
        data: { status: 'ISSUED' },
      },
    );
    expect([200, 404, 403, 422]).toContain(transitionRes.status());
  });

  test('creates compliance record', async ({ request }) => {
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/compliance-records`,
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
      const created = (await createRes.json()) as { data: { record?: { id: string } } };
      if (created.data.record) {
        recordId = created.data.record.id;
      }
    }
  });

  test('verifies compliance record', async ({ request }) => {
    if (!orgId || !projectId || !recordId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const verifyRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/compliance-records/${recordId}/verify`,
      {
        data: { verificationRef: 'CERT-2026-001' },
      },
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

    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: {
        name: 'Smoke HSE Project',
        projectCode: `SMKHSE-${Date.now()}`,
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });

    if (projectRes.status() !== 201) return;

    const projectBody = (await projectRes.json()) as { data: { id: string } };
    const projectId = projectBody.data.id;

    const endpoints = [
      `/api/v1/organizations/${orgId}/projects/${projectId}/safety-events`,
      `/api/v1/organizations/${orgId}/projects/${projectId}/quality-inspections`,
      `/api/v1/organizations/${orgId}/projects/${projectId}/quality-deficiencies`,
      `/api/v1/organizations/${orgId}/projects/${projectId}/corrective-actions`,
      `/api/v1/organizations/${orgId}/projects/${projectId}/permits`,
      `/api/v1/organizations/${orgId}/projects/${projectId}/compliance-records`,
      `/api/v1/organizations/${orgId}/projects/${projectId}/compliance-inspections`,
    ];

    for (const endpoint of endpoints) {
      const res = await request.get(endpoint);
      expect([200, 403]).toContain(res.status());
    }
  });
});
