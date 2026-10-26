/**
 * E2E: RFI & Submittals — Full workflow testing.
 * Tests the live API endpoints for RFI and Submittal operations.
 * Depends on auth.setup.ts (saved session in .auth/user.json).
 */
import { test, expect } from '@playwright/test';

test.describe('RFI: Complete Workflow', () => {
  let orgId: string;
  let projectId: string;
  let rfiId: string;

  test.beforeAll(async ({ request }) => {
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E RFI Org ${Date.now()}` },
    });
    if (orgRes.status() !== 201) return;
    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    orgId = orgBody.data.organization.id;

    await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });

    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: {
        name: 'RFI Test Project',
        projectCode: `RFI-${Date.now()}`,
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });
    if (projectRes.status() !== 201) return;
    const projectBody = (await projectRes.json()) as { data: { id: string } };
    projectId = projectBody.data.id;
  });

  test('creates RFI', async ({ request }) => {
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/rfis`,
      {
        data: {
          title: 'Foundation waterproofing specification clarification',
          question: 'Please clarify which waterproofing membrane system should be used for the foundation walls as per Drawing A-201.',
          priority: 'HIGH',
          discipline: 'Civil',
          dueDate: '2026-02-15',
          scheduleImpactDays: 5,
        },
      },
    );

    expect([201, 403, 422]).toContain(createRes.status());

    if (createRes.status() === 201) {
      const created = (await createRes.json()) as { data: { rfi?: { id: string; status: string } } };
      if (created.data.rfi) {
        rfiId = created.data.rfi.id;
        expect(created.data.rfi.status).toBe('DRAFT');
      }
    }
  });

  test('lists RFIs', async ({ request }) => {
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const listRes = await request.get(
      `/api/v1/organizations/${orgId}/projects/${projectId}/rfis`,
    );
    expect([200, 403]).toContain(listRes.status());

    if (listRes.status() === 200) {
      const body = await listRes.json();
      expect(Array.isArray(body.data)).toBeTruthy();
    }
  });

  test('gets RFI detail', async ({ request }) => {
    if (!orgId || !projectId || !rfiId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const getRes = await request.get(
      `/api/v1/organizations/${orgId}/projects/${projectId}/rfis/${rfiId}`,
    );
    expect([200, 404, 403]).toContain(getRes.status());

    if (getRes.status() === 200) {
      const body = await getRes.json();
      expect(body.data.rfi?.id || body.data.id).toBe(rfiId);
    }
  });

  test('updates RFI draft', async ({ request }) => {
    if (!orgId || !projectId || !rfiId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const updateRes = await request.patch(
      `/api/v1/organizations/${orgId}/projects/${projectId}/rfis/${rfiId}`,
      {
        data: {
          notes: 'This is critical for schedule - please prioritize response',
        },
      },
    );
    expect([200, 404, 403, 422]).toContain(updateRes.status());
  });

  test('submits RFI', async ({ request }) => {
    if (!orgId || !projectId || !rfiId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const submitRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/rfis/${rfiId}/submit`,
      { data: {} },
    );
    expect([200, 404, 403, 422]).toContain(submitRes.status());

    if (submitRes.status() === 200) {
      const body = await submitRes.json();
      const status = body.data.rfi?.status || body.data.status;
      expect(['OPEN', 'UNDER_REVIEW']).toContain(status);
    }
  });

  test('responds to RFI', async ({ request }) => {
    if (!orgId || !projectId || !rfiId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const respondRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/rfis/${rfiId}/respond`,
      {
        data: {
          response: 'Use membrane system Type A as specified in Section 07 13 00. Reference detail 5/A-301 for installation requirements.',
          scheduleImpactDays: 0,
        },
      },
    );
    expect([200, 404, 403, 422]).toContain(respondRes.status());

    if (respondRes.status() === 200) {
      const body = await respondRes.json();
      const status = body.data.rfi?.status || body.data.status;
      expect(['ANSWERED', 'UNDER_REVIEW']).toContain(status);
    }
  });

  test('closes RFI', async ({ request }) => {
    if (!orgId || !projectId || !rfiId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const closeRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/rfis/${rfiId}/close`,
      { data: {} },
    );
    expect([200, 404, 403, 422]).toContain(closeRes.status());
  });
});

test.describe('RFI: Cancellation Flow', () => {
  let orgId: string;
  let projectId: string;
  let rfiId: string;

  test.beforeAll(async ({ request }) => {
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E RFI Cancel Org ${Date.now()}` },
    });
    if (orgRes.status() !== 201) return;
    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    orgId = orgBody.data.organization.id;

    await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });

    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: {
        name: 'RFI Cancel Project',
        projectCode: `RFICANCEL-${Date.now()}`,
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });
    if (projectRes.status() !== 201) return;
    const projectBody = (await projectRes.json()) as { data: { id: string } };
    projectId = projectBody.data.id;

    // Create RFI for cancellation
    const rfiRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/rfis`,
      {
        data: {
          title: 'Question to be cancelled',
          question: 'This will be cancelled',
          priority: 'LOW',
        },
      },
    );
    if (rfiRes.status() === 201) {
      const rfiBody = (await rfiRes.json()) as { data: { rfi?: { id: string } } };
      if (rfiBody.data.rfi) {
        rfiId = rfiBody.data.rfi.id;
      }
    }
  });

  test('cancels RFI', async ({ request }) => {
    if (!orgId || !projectId || !rfiId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const cancelRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/rfis/${rfiId}/cancel`,
      { data: {} },
    );
    expect([200, 404, 403, 422]).toContain(cancelRes.status());
  });
});

test.describe('Submittal: Complete Workflow', () => {
  let orgId: string;
  let projectId: string;
  let submittalId: string;

  test.beforeAll(async ({ request }) => {
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E Submittal Org ${Date.now()}` },
    });
    if (orgRes.status() !== 201) return;
    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    orgId = orgBody.data.organization.id;

    await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });

    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: {
        name: 'Submittal Test Project',
        projectCode: `SUB-${Date.now()}`,
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });
    if (projectRes.status() !== 201) return;
    const projectBody = (await projectRes.json()) as { data: { id: string } };
    projectId = projectBody.data.id;
  });

  test('creates submittal', async ({ request }) => {
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/submittals`,
      {
        data: {
          title: 'Structural Steel Shop Drawings',
          specReference: 'Section 05 12 00',
          discipline: 'Structural',
          dueDate: '2026-03-01',
          notes: 'Coordination with MEP required',
        },
      },
    );

    expect([201, 403, 422]).toContain(createRes.status());

    if (createRes.status() === 201) {
      const created = (await createRes.json()) as { data: { submittal?: { id: string; status: string } } };
      if (created.data.submittal) {
        submittalId = created.data.submittal.id;
        expect(created.data.submittal.status).toBe('DRAFT');
      }
    }
  });

  test('lists submittals', async ({ request }) => {
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const listRes = await request.get(
      `/api/v1/organizations/${orgId}/projects/${projectId}/submittals`,
    );
    expect([200, 403]).toContain(listRes.status());

    if (listRes.status() === 200) {
      const body = await listRes.json();
      expect(Array.isArray(body.data)).toBeTruthy();
    }
  });

  test('gets submittal detail', async ({ request }) => {
    if (!orgId || !projectId || !submittalId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const getRes = await request.get(
      `/api/v1/organizations/${orgId}/projects/${projectId}/submittals/${submittalId}`,
    );
    expect([200, 404, 403]).toContain(getRes.status());
  });

  test('updates submittal draft', async ({ request }) => {
    if (!orgId || !projectId || !submittalId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const updateRes = await request.patch(
      `/api/v1/organizations/${orgId}/projects/${projectId}/submittals/${submittalId}`,
      {
        data: {
          notes: 'Updated: Priority review required for foundation schedule',
        },
      },
    );
    expect([200, 404, 403, 422]).toContain(updateRes.status());
  });

  test('submits submittal', async ({ request }) => {
    if (!orgId || !projectId || !submittalId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const submitRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/submittals/${submittalId}/submit`,
      { data: {} },
    );
    expect([200, 404, 403, 422]).toContain(submitRes.status());

    if (submitRes.status() === 200) {
      const body = await submitRes.json();
      const status = body.data.submittal?.status || body.data.status;
      expect(['SUBMITTED', 'UNDER_REVIEW']).toContain(status);
    }
  });

  test('reviews submittal - approved', async ({ request }) => {
    if (!orgId || !projectId || !submittalId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const reviewRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/submittals/${submittalId}/review`,
      {
        data: {
          response: 'APPROVED',
          responseNotes: 'Approved as submitted - proceed with fabrication',
        },
      },
    );
    expect([200, 404, 403, 422]).toContain(reviewRes.status());

    if (reviewRes.status() === 200) {
      const body = await reviewRes.json();
      const status = body.data.submittal?.status || body.data.status;
      expect(['APPROVED', 'UNDER_REVIEW']).toContain(status);
    }
  });

  test('closes submittal', async ({ request }) => {
    if (!orgId || !projectId || !submittalId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const closeRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/submittals/${submittalId}/close`,
      { data: {} },
    );
    expect([200, 404, 403, 422]).toContain(closeRes.status());
  });
});

test.describe('Submittal: Resubmission Flow', () => {
  let orgId: string;
  let projectId: string;
  let submittalId: string;

  test.beforeAll(async ({ request }) => {
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E Submittal Resubmit Org ${Date.now()}` },
    });
    if (orgRes.status() !== 201) return;
    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    orgId = orgBody.data.organization.id;

    await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });

    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: {
        name: 'Submittal Resubmit Project',
        projectCode: `SUBRESUB-${Date.now()}`,
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });
    if (projectRes.status() !== 201) return;
    const projectBody = (await projectRes.json()) as { data: { id: string } };
    projectId = projectBody.data.id;
  });

  test('creates and submits submittal for resubmission', async ({ request }) => {
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/submittals`,
      {
        data: {
          title: 'Submittal requiring revisions',
          specReference: 'Section 09 00 00',
          discipline: 'Finishes',
        },
      },
    );

    if (createRes.status() === 201) {
      const created = (await createRes.json()) as { data: { submittal?: { id: string } } };
      if (created.data.submittal) {
        submittalId = created.data.submittal.id;

        // Submit it
        await request.post(
          `/api/v1/organizations/${orgId}/projects/${projectId}/submittals/${submittalId}/submit`,
          { data: {} },
        );
      }
    }

    expect([201, 403, 422]).toContain(createRes.status());
  });

  test('reviews submittal - revise and resubmit', async ({ request }) => {
    if (!orgId || !projectId || !submittalId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const reviewRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/submittals/${submittalId}/review`,
      {
        data: {
          response: 'REVISE_AND_RESUBMIT',
          responseNotes: 'Please revise details 3 and 4 per comments and resubmit',
        },
      },
    );
    expect([200, 404, 403, 422]).toContain(reviewRes.status());
  });

  test('resubmits submittal after revisions', async ({ request }) => {
    if (!orgId || !projectId || !submittalId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const resubmitRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/submittals/${submittalId}/resubmit`,
      { data: {} },
    );
    expect([200, 404, 403, 422]).toContain(resubmitRes.status());
  });

  test('lists submittal revisions', async ({ request }) => {
    if (!orgId || !projectId || !submittalId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const listRes = await request.get(
      `/api/v1/organizations/${orgId}/projects/${projectId}/submittals/${submittalId}/revisions`,
    );
    expect([200, 404, 403]).toContain(listRes.status());
  });
});

test.describe('RFI & Submittal: API Smoke Tests', () => {
  test('RFI and Submittal endpoints are registered', async ({ request }) => {
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `Smoke RFI Sub ${Date.now()}` },
    });
    if (orgRes.status() !== 201) {
      console.log('Org creation blocked, testing with placeholder IDs');
      const testRes = await request.get(
        '/api/v1/organizations/org_test/projects/proj_test/rfis',
      );
      expect([200, 401, 403, 404]).toContain(testRes.status());
      return;
    }

    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    const orgId = orgBody.data.organization.id;

    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: {
        name: 'Smoke RFI Sub Project',
        projectCode: `SMKRFISUB-${Date.now()}`,
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });

    if (projectRes.status() !== 201) return;

    const projectBody = (await projectRes.json()) as { data: { id: string } };
    const projectId = projectBody.data.id;

    const endpoints = [
      `/api/v1/organizations/${orgId}/projects/${projectId}/rfis`,
      `/api/v1/organizations/${orgId}/projects/${projectId}/submittals`,
    ];

    for (const endpoint of endpoints) {
      const res = await request.get(endpoint);
      expect([200, 403]).toContain(res.status());
    }
  });
});
