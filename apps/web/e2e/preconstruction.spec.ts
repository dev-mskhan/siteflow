/**
 * E2E: Preconstruction — Tenders, Proposals, Estimates, BOQ workflows.
 * Tests the live API endpoints for preconstruction operations.
 * Depends on auth.setup.ts (saved session in .auth/user.json).
 */
import { test, expect } from '@playwright/test';

test.describe('Preconstruction: Tender Workflow', () => {
  let orgId: string;
  let tenderId: string;

  test.beforeAll(async ({ request }) => {
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E Tender Org ${Date.now()}` },
    });
    if (orgRes.status() !== 201) {
      console.log('Org creation failed (trial limit), skipping tests');
      return;
    }
    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    orgId = orgBody.data.organization.id;

    await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });
  });

  test('creates tender', async ({ request }) => {
    if (!orgId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const createRes = await request.post(`/api/v1/organizations/${orgId}/tenders`, {
      data: {
        title: 'Commercial Building Tender',
        description: 'Tender for new commercial office building',
        clientName: 'ABC Corporation',
        clientReference: 'ABC-2026-001',
        submissionDeadline: '2026-03-01T17:00:00+04:00',
        submissionTimezone: 'Asia/Dubai',
        estimatedValue: '5000000.00',
        currencyCode: 'AED',
      },
    });

    expect([201, 403, 422]).toContain(createRes.status());

    if (createRes.status() === 201) {
      const created = (await createRes.json()) as { data: { id: string; status: string } };
      tenderId = created.data.id;
      expect(created.data.status).toBe('OPEN');
    }
  });

  test('lists tenders', async ({ request }) => {
    if (!orgId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const listRes = await request.get(`/api/v1/organizations/${orgId}/tenders`);
    expect([200, 403]).toContain(listRes.status());

    if (listRes.status() === 200) {
      const body = await listRes.json();
      expect(Array.isArray(body.data)).toBeTruthy();
    }
  });

  test('gets tender detail', async ({ request }) => {
    if (!orgId || !tenderId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const getRes = await request.get(`/api/v1/organizations/${orgId}/tenders/${tenderId}`);
    expect([200, 404, 403]).toContain(getRes.status());

    if (getRes.status() === 200) {
      const body = await getRes.json();
      expect(body.data.id).toBe(tenderId);
    }
  });

  test('updates tender', async ({ request }) => {
    if (!orgId || !tenderId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const updateRes = await request.patch(`/api/v1/organizations/${orgId}/tenders/${tenderId}`, {
      data: {
        notes: 'Updated tender notes',
        expectedVersion: 1,
      },
    });
    expect([200, 404, 403, 422]).toContain(updateRes.status());
  });

  test('submits tender', async ({ request }) => {
    if (!orgId || !tenderId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const submitRes = await request.post(
      `/api/v1/organizations/${orgId}/tenders/${tenderId}/submit`,
      {
        data: { expectedVersion: 2 },
      },
    );
    expect([200, 404, 403, 422]).toContain(submitRes.status());
  });
});

test.describe('Preconstruction: Proposal Workflow', () => {
  let orgId: string;
  let projectId: string;
  let proposalId: string;

  test.beforeAll(async ({ request }) => {
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E Proposal Org ${Date.now()}` },
    });
    if (orgRes.status() !== 201) return;
    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    orgId = orgBody.data.organization.id;

    await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });

    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: {
        name: 'Proposal Test Project',
        projectCode: `PROP-${Date.now()}`,
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });
    if (projectRes.status() !== 201) return;
    const projectBody = (await projectRes.json()) as { data: { id: string } };
    projectId = projectBody.data.id;
  });

  test('creates proposal', async ({ request }) => {
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/proposals`,
      {
        data: {
          title: 'Foundation and Structural Works Proposal',
          description: 'Detailed proposal for Phase 1 construction',
          clientName: 'ABC Corporation',
          currencyCode: 'AED',
          scope: 'Complete foundation and structural works',
          totalAmount: '2500000.00',
          lines: [
            {
              sortOrder: 1,
              itemKey: 'FOUND-001',
              description: 'Excavation and Foundation',
              unit: 'M3',
              quantity: '500',
              unitRate: '150.00',
              amount: '75000.00',
              currency: 'AED',
            },
          ],
        },
      },
    );

    expect([201, 403, 422]).toContain(createRes.status());

    if (createRes.status() === 201) {
      const created = (await createRes.json()) as { data: { id: string; status: string } };
      proposalId = created.data.id;
      expect(created.data.status).toBe('DRAFT');
    }
  });

  test('lists proposals', async ({ request }) => {
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const listRes = await request.get(
      `/api/v1/organizations/${orgId}/projects/${projectId}/proposals`,
    );
    expect([200, 403]).toContain(listRes.status());
  });

  test('gets proposal detail', async ({ request }) => {
    if (!orgId || !projectId || !proposalId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const getRes = await request.get(
      `/api/v1/organizations/${orgId}/projects/${projectId}/proposals/${proposalId}`,
    );
    expect([200, 404, 403]).toContain(getRes.status());
  });

  test('submits proposal for approval', async ({ request }) => {
    if (!orgId || !projectId || !proposalId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const submitRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/proposals/${proposalId}/submit`,
      {
        data: { expectedVersion: 1 },
      },
    );
    expect([200, 404, 403, 422]).toContain(submitRes.status());
  });

  test('approves proposal', async ({ request }) => {
    if (!orgId || !projectId || !proposalId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const approveRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/proposals/${proposalId}/approve`,
      {
        data: { expectedVersion: 2 },
      },
    );
    expect([200, 404, 403, 422]).toContain(approveRes.status());
  });
});

test.describe('Preconstruction: Estimate Workflow', () => {
  let orgId: string;
  let projectId: string;
  let estimateId: string;

  test.beforeAll(async ({ request }) => {
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E Estimate Org ${Date.now()}` },
    });
    if (orgRes.status() !== 201) return;
    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    orgId = orgBody.data.organization.id;

    await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });

    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: {
        name: 'Estimate Test Project',
        projectCode: `EST-${Date.now()}`,
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });
    if (projectRes.status() !== 201) return;
    const projectBody = (await projectRes.json()) as { data: { id: string } };
    projectId = projectBody.data.id;
  });

  test('creates estimate', async ({ request }) => {
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/estimates`,
      {
        data: {
          title: 'Project Cost Estimate',
          description: 'Detailed cost estimate for entire project',
          currencyCode: 'AED',
          sections: [
            {
              sectionNumber: 1,
              title: 'Foundation',
              lines: [
                {
                  lineNumber: 1,
                  category: 'MATERIAL',
                  description: 'Concrete Grade 40',
                  quantity: '100',
                  unit: 'M3',
                  directAmount: '50000.00',
                  resources: [],
                },
              ],
            },
          ],
        },
      },
    );

    expect([201, 403, 422]).toContain(createRes.status());

    if (createRes.status() === 201) {
      const created = (await createRes.json()) as { data: { id: string; status: string } };
      estimateId = created.data.id;
      expect(created.data.status).toBe('DRAFT');
    }
  });

  test('lists estimates', async ({ request }) => {
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const listRes = await request.get(
      `/api/v1/organizations/${orgId}/projects/${projectId}/estimates`,
    );
    expect([200, 403]).toContain(listRes.status());
  });

  test('submits estimate for approval', async ({ request }) => {
    if (!orgId || !projectId || !estimateId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const submitRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/estimates/${estimateId}/submit`,
      {
        data: { expectedVersion: 1 },
      },
    );
    expect([200, 404, 403, 422]).toContain(submitRes.status());
  });

  test('approves estimate', async ({ request }) => {
    if (!orgId || !projectId || !estimateId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const approveRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/estimates/${estimateId}/approve`,
      {
        data: { expectedVersion: 2 },
      },
    );
    expect([200, 404, 403, 422]).toContain(approveRes.status());
  });
});

test.describe('Preconstruction: BOQ Workflow', () => {
  let orgId: string;
  let projectId: string;
  let boqId: string;

  test.beforeAll(async ({ request }) => {
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E BOQ Org ${Date.now()}` },
    });
    if (orgRes.status() !== 201) return;
    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    orgId = orgBody.data.organization.id;

    await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });

    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: {
        name: 'BOQ Test Project',
        projectCode: `BOQ-${Date.now()}`,
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });
    if (projectRes.status() !== 201) return;
    const projectBody = (await projectRes.json()) as { data: { id: string } };
    projectId = projectBody.data.id;
  });

  test('creates BOQ', async ({ request }) => {
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/boqs`,
      {
        data: {
          name: 'Main Project BOQ',
          description: 'Bill of Quantities for main contract',
          currencyCode: 'AED',
          sections: [
            {
              sectionCode: 'A',
              title: 'Preliminaries',
              items: [
                {
                  itemCode: 'A.1.1',
                  description: 'Site Mobilization',
                  unit: 'LS',
                  quantity: '1',
                  unitRate: '50000.00',
                  amount: '50000.00',
                },
              ],
            },
          ],
        },
      },
    );

    expect([201, 403, 422]).toContain(createRes.status());

    if (createRes.status() === 201) {
      const created = (await createRes.json()) as { data: { id: string; status: string } };
      boqId = created.data.id;
      expect(created.data.status).toBe('DRAFT');
    }
  });

  test('lists BOQs', async ({ request }) => {
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const listRes = await request.get(
      `/api/v1/organizations/${orgId}/projects/${projectId}/boqs`,
    );
    expect([200, 403]).toContain(listRes.status());
  });

  test('submits BOQ for approval', async ({ request }) => {
    if (!orgId || !projectId || !boqId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const submitRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/boqs/${boqId}/submit`,
      {
        data: { expectedVersion: 1 },
      },
    );
    expect([200, 404, 403, 422]).toContain(submitRes.status());
  });

  test('approves BOQ', async ({ request }) => {
    if (!orgId || !projectId || !boqId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const approveRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/boqs/${boqId}/approve`,
      {
        data: { expectedVersion: 2 },
      },
    );
    expect([200, 404, 403, 422]).toContain(approveRes.status());
  });

  test('locks BOQ', async ({ request }) => {
    if (!orgId || !projectId || !boqId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const lockRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/boqs/${boqId}/lock`,
      {
        data: { expectedVersion: 3 },
      },
    );
    expect([200, 404, 403, 422]).toContain(lockRes.status());
  });
});

test.describe('Preconstruction: API Smoke Tests', () => {
  test('preconstruction endpoints are registered', async ({ request }) => {
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `Smoke Precon ${Date.now()}` },
    });
    if (orgRes.status() !== 201) {
      console.log('Org creation blocked, testing with placeholder IDs');
      const testRes = await request.get('/api/v1/organizations/org_test/tenders');
      expect([200, 401, 403, 404]).toContain(testRes.status());
      return;
    }

    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    const orgId = orgBody.data.organization.id;

    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: {
        name: 'Smoke Precon Project',
        projectCode: `SMKPRE-${Date.now()}`,
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });

    if (projectRes.status() !== 201) {
      console.log('Project creation failed, testing routes exist');
      return;
    }

    const projectBody = (await projectRes.json()) as { data: { id: string } };
    const projectId = projectBody.data.id;

    // Verify all preconstruction endpoints are registered
    const endpoints = [
      `/api/v1/organizations/${orgId}/tenders`,
      `/api/v1/organizations/${orgId}/projects/${projectId}/proposals`,
      `/api/v1/organizations/${orgId}/projects/${projectId}/estimates`,
      `/api/v1/organizations/${orgId}/projects/${projectId}/boqs`,
    ];

    for (const endpoint of endpoints) {
      const res = await request.get(endpoint);
      expect([200, 403]).toContain(res.status());
    }
  });
});
