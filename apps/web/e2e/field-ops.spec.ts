/**
 * E2E: Wave 4 Field Operations — Tasks, Field Logs, Issues.
 * Tests live integration of taskApi, fieldLogApi, issueApi.
 */
import { test, expect } from '@playwright/test';

test.describe('Field Operations: Tasks, Field Logs, Issues', () => {
  let orgId: string;
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    // Create org and provision trial
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E Field Ops ${Date.now()}` },
    });
    expect(orgRes.status()).toBe(201);
    const orgBody = await orgRes.json();
    orgId = (orgBody.data.organization?.id ?? orgBody.data.id);

    // Provision trial - Required for project creation
    const trialRes = await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });
    expect(trialRes.status()).toBe(201);

    // Create project
    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: { name: 'Field Test Project', projectCode: `FT-${Date.now()}` },
    });
    expect(projectRes.status()).toBe(201);
    const projectBody = await projectRes.json();
    projectId = (projectBody.data.project?.id ?? projectBody.data.id);
  });

  test('creates task and transitions status', async ({ request }) => {
    // Create task
    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/tasks`,
      {
        data: {
          name: 'Concrete Pour Level 1',
          taskCode: `T-${Date.now()}`,
          taskType: 'TASK',
          currentDurationDays: 2,
        },
      },
    );
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    const taskId = created.data.id;
    expect(created.data.name).toBe('Concrete Pour Level 1');
    expect(created.data.status).toBe('NOT_STARTED');

    // Transition to IN_PROGRESS
    const transitionRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/tasks/${taskId}/transition`,
      { data: { status: 'IN_PROGRESS', expectedVersion: 1 } },
    );
    expect(transitionRes.status()).toBe(200);
    const transitioned = await transitionRes.json();
    expect(transitioned.data.status).toBe('IN_PROGRESS');
  });

  test('creates field log and submits it', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Create field log
    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/field-logs`,
      {
        data: {
          logDate: today,
          notes: 'Clear weather, concrete pour completed successfully.',
        },
      },
    );
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    const logId = created.data.id;
    expect(created.data.status).toBe('DRAFT');

    // Submit field log
    const submitRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/field-logs/${logId}/submit`,
    );
    expect(submitRes.status()).toBe(200);
    const submitted = await submitRes.json();
    expect(submitted.data.status).toBe('SUBMITTED');
  });

  test('creates issue and transitions it', async ({ request }) => {
    // Create issue
    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/issues`,
      {
        data: {
          title: 'Steel delivery delayed',
          description: 'Supplier reports 5-day delay on rebar shipment.',
          reportedImpactDays: 5,
        },
      },
    );
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    const issueId = created.data.id;
    expect(created.data.status).toBe('OPEN');

    // Transition to IN_PROGRESS
    const transitionRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/issues/${issueId}/transition`,
      { data: { status: 'IN_PROGRESS' } },
    );
    expect(transitionRes.status()).toBe(200);
    const transitioned = await transitionRes.json();
    expect(transitioned.data.status).toBe('IN_PROGRESS');
  });

  test('lists tasks, field logs, and issues', async ({ request }) => {
    // List tasks
    const tasksRes = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/tasks`);
    expect(tasksRes.status()).toBe(200);
    const tasksBody = await tasksRes.json();
    expect(Array.isArray(tasksBody.data)).toBe(true);

    // List field logs
    const logsRes = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/field-logs`);
    expect(logsRes.status()).toBe(200);
    const logsBody = await logsRes.json();
    expect(Array.isArray(logsBody.data)).toBe(true);

    // List issues
    const issuesRes = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/issues`);
    expect(issuesRes.status()).toBe(200);
    const issuesBody = await issuesRes.json();
    expect(Array.isArray(issuesBody.data)).toBe(true);
  });
});
