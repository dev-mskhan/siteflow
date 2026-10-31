/**
 * E2E: Project lifecycle — creates an org, creates a project through the real
 * modal, then opens the project's Phases page. Every step asserts a real
 * request to /api/v1 so the flow proves the frontend talks to the live server.
 * Depends on auth.setup.ts (saved session in .auth/user.json).
 */
import { test, expect } from '@playwright/test';

test.describe('Project lifecycle', () => {
  test('creates project data in UI and loads every project section from the live server', async ({ page }) => {
    test.setTimeout(180_000);
    const pageErrors: string[] = [];
    const storageRequestErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('requestfailed', (request) => {
      const url = new URL(request.url());
      if (url.port === '9000') {
        storageRequestErrors.push(`${request.method()} ${url.host}: ${request.failure()?.errorText ?? 'failed'}`);
      }
    });

    await page.goto('/');
    const orgRes = await page.request.post(new URL('/api/v1/organizations', page.url()).toString(), {
      data: { name: `E2E Org ${Date.now()}` },
    });
    const orgResponseBody = await orgRes.text();
    expect(orgRes.status(), orgResponseBody).toBe(201);
    const orgBody = JSON.parse(orgResponseBody) as { data: { organization: { id: string } } };
    const orgId = orgBody.data.organization.id;

    // Project creation requires an entitlement; provision the real no-card trial first.
    const trialRes = await page.request.post(
      new URL(`/api/v1/organizations/${orgId}/billing/trial`, page.url()).toString(),
      {
        data: {},
      },
    );
    expect(trialRes.status(), await trialRes.text()).toBe(201);

    await page.goto(`/org/${orgId}/projects`);

    await page.getByRole('button', { name: 'New project' }).click();
    const projectName = `E2E Project ${Date.now()}`;
    await page.getByLabel('Project name').fill(projectName);

    const createCall = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/v1/organizations/${orgId}/projects`) &&
        res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Create project' }).click();
    const createRes = await createCall;
    const createResponseBody = await createRes.text();
    expect(createRes.status(), createResponseBody).toBe(201);

    const created = JSON.parse(createResponseBody) as { data: { project: { id: string } } };
    const projectId = created.data.project.id;
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}/projects/${projectId}`));

    const phasesCall = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/v1/organizations/${orgId}/projects/${projectId}`) &&
        res.request().method() === 'GET' &&
        res.ok(),
    );
    await page.goto(`/org/${orgId}/projects/${projectId}/phases`);
    await phasesCall;
    await expect(page.getByRole('button', { name: 'Add phase' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Add phase' }).click();
    const phaseName = `E2E Phase ${Date.now()}`;
    await page.getByPlaceholder('Phase name').fill(phaseName);
    const createPhaseCall = page.waitForResponse(
      (res) =>
        res.url().endsWith(`/api/v1/organizations/${orgId}/projects/${projectId}/phases`) &&
        res.request().method() === 'POST',
    );
    await page.locator('form').filter({ has: page.getByPlaceholder('Phase name') }).locator('button[type="submit"]').click();
    const phaseRes = await createPhaseCall;
    expect(phaseRes.status()).toBe(201);
    await expect(page.getByText(phaseName)).toBeVisible();

    const projectsListCall = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/v1/organizations/${orgId}/projects`) &&
        res.request().method() === 'GET',
    );
    await page.goto(`/org/${orgId}/projects`);
    const projectsListRes = await projectsListCall;
    expect(projectsListRes.status()).toBe(200);
    const projectsListBody = (await projectsListRes.json()) as {
      data: { projects: { id: string }[] };
    };
    expect(projectsListBody.data.projects.map((project) => project.id)).toContain(projectId);
    await expect(page.getByRole('heading', { name: projectName })).toBeVisible();

    const historyCall = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/v1/organizations/${orgId}/projects/${projectId}/schedule/history`) &&
        res.request().method() === 'GET',
    );
    await page.goto(`/org/${orgId}/projects/${projectId}/schedule-history`);
    await expect(page.getByRole('heading', { name: 'Schedule history' })).toBeVisible();
    expect((await historyCall).status()).toBe(200);
    await expect(page.getByText('No schedule changes recorded.')).toBeVisible();
    await expect(page.getByText('Tariq Mehmood')).toHaveCount(0);

    const takeoffListCall = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/v1/organizations/${orgId}/projects/${projectId}/takeoffs/sheets`) &&
        res.request().method() === 'GET',
    );
    await page.goto(`/org/${orgId}/projects/${projectId}/preconstruction/takeoffs`);
    expect((await takeoffListCall).status()).toBe(200);
    await page.getByRole('button', { name: 'New sheet' }).click();
    const sheetTitle = `E2E takeoff ${Date.now()}`;
    await page.getByPlaceholder(/Ground Floor Slab/).fill(sheetTitle);
    const createSheetCall = page.waitForResponse(
      (res) =>
        res.url().endsWith(`/api/v1/organizations/${orgId}/projects/${projectId}/takeoffs/sheets`) &&
        res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Create sheet' }).click();
    expect((await createSheetCall).status()).toBe(201);
    await expect(page.getByText(sheetTitle)).toBeVisible();

    const materialsCall = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/v1/organizations/${orgId}/materials`) &&
        res.request().method() === 'GET',
    );
    await page.goto(`/org/${orgId}/projects/${projectId}/preconstruction/pricing`);
    const materialsRes = await materialsCall;
    expect(materialsRes.status()).toBe(200);
    const materialsBody = (await materialsRes.json()) as { data: { id: string }[] };
    const materialSelect = page.locator('select').first();
    if (materialsBody.data.length > 0) {
      await expect(materialSelect.locator('option')).toHaveCount(materialsBody.data.length);
      await expect(materialSelect).toHaveValue(materialsBody.data[0].id);
    } else {
      await expect(materialSelect.locator('option')).toHaveText('No materials available');
      await expect(page.getByText(/Add a material to this organization/)).toBeVisible();
    }

    const failedProjectResponses: string[] = [];
    const projectApiPrefix = `/api/v1/organizations/${orgId}/projects/${projectId}/`;
    page.on('response', (res) => {
      if (res.url().includes(projectApiPrefix) && res.status() >= 400) {
        failedProjectResponses.push(`${res.status()} ${res.request().method()} ${res.url()}`);
      }
    });

    const sectionGroups = [
      {
        group: 'Planning',
        items: [
          ['Phases', 'phases'],
          ['Tasks', 'tasks'],
          ['Baselines', 'baselines'],
          ['Calendar', 'calendar'],
          ['Schedule history', 'schedule-history'],
          ['Cost codes', 'cost-codes'],
          ['Budget', 'budget'],
        ],
      },
      {
        group: 'Field operations',
        items: [
          ['Team', 'team'],
          ['Field logs', 'field-logs'],
          ['Issues', 'issues'],
          ['Subcontractors', 'subcontractors'],
          ['Safety', 'safety'],
          ['Quality', 'quality'],
          ['RFIs', 'rfis'],
          ['Submittals', 'submittals'],
        ],
      },
      {
        group: 'Commercial',
        items: [
          ['Change orders', 'commercial/change-orders'],
          ['Schedule of values', 'commercial/sov'],
          ['Payment applications', 'commercial/payment-applications'],
          ['Invoices', 'commercial/invoices'],
          ['Payments', 'commercial/payments'],
          ['Retainage', 'commercial/retainage'],
          ['Cost transactions', 'commercial/cost-transactions'],
          ['Commercial summary', 'commercial/commercial-summary'],
          ['Financial summary', 'commercial/financial-summary'],
        ],
      },
      {
        group: 'Pre-construction',
        items: [
          ['Proposals', 'preconstruction/proposals'],
          ['Estimates', 'preconstruction/estimates'],
          ['Bill of quantities', 'preconstruction/boq'],
          ['Takeoffs', 'preconstruction/takeoffs'],
          ['Pricing', 'preconstruction/pricing'],
        ],
      },
      {
        group: 'Procurement',
        items: [
          ['Material requests', 'procurement/requests'],
          ['Quotes', 'procurement/quotes'],
          ['Purchase orders', 'procurement/orders'],
          ['Approvals', 'procurement/approvals'],
          ['Deliveries', 'procurement/deliveries'],
          ['Committed costs', 'procurement/committed'],
          ['Inventory', 'inventory'],
        ],
      },
      {
        group: 'Records & controls',
        items: [
          ['Documents', 'documents'],
          ['Compliance', 'compliance'],
          ['Audit', 'audit'],
          ['Settings', 'settings'],
        ],
      },
      {
        group: 'Reports',
        items: [
          ['Project health', 'reports/health'],
          ['Schedule', 'reports/schedule'],
          ['Cost', 'reports/cost'],
          ['Procurement', 'reports/procurement'],
          ['Subcontractors', 'reports/subcontractor'],
          ['Executive', 'reports/executive'],
        ],
      },
    ];

    for (const sectionGroup of sectionGroups) {
      for (const [label, route] of sectionGroup.items) {
        const menuButton = page.locator('button[aria-controls^="section-navigation-"]');
        if ((await menuButton.getAttribute('aria-expanded')) !== 'true') {
          await menuButton.click();
        }
        await expect(menuButton).toHaveAttribute('aria-expanded', 'true');

        const groupButton = page
          .locator(`section[aria-label="${sectionGroup.group}"]`)
          .getByRole('button');
        await expect(groupButton).toBeVisible();
        if ((await groupButton.getAttribute('aria-expanded')) !== 'true') {
          await groupButton.click();
        }

        const sectionLink = page
          .getByRole('navigation', { name: 'Page sections' })
          .getByRole('link', { name: label, exact: true });
        await expect(sectionLink).toBeVisible();
        await sectionLink.click();
        await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
        await expect(page).toHaveURL(new RegExp(`/org/${orgId}/projects/${projectId}/${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
        await expect(page.locator('h2').first()).toBeVisible();
        if (label === 'Documents') {
          const documentTitle = `E2E document ${Date.now()}`;
          await page.getByRole('button', { name: 'Upload document' }).click();
          await page.getByLabel('Document file').setInputFiles({
            name: 'integration-check.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('Live project document upload verification'),
          });
          await page.getByLabel('Document title').fill(documentTitle);
          await page.getByRole('button', { name: 'Upload', exact: true }).click();
          const uploadButton = page.getByRole('button', { name: 'Uploading…' });
          await expect(uploadButton).toBeHidden({ timeout: 40_000 });
          const uploadFailed = page.getByText('Upload failed', { exact: true });
          if (await uploadFailed.isVisible()) {
            throw new Error(
              `Document upload failed: ${await uploadFailed.locator('xpath=../..').innerText()}; ` +
                `storage requests: ${storageRequestErrors.join('; ') || 'none failed'}`,
            );
          }
          await expect(page.getByText('Document uploaded', { exact: true })).toBeVisible();
          await expect(page.getByText(documentTitle)).toBeVisible();
        }
      }
    }
    expect(failedProjectResponses).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
