/**
 * E2E: Master Data (Wave 3) — Supplier & Material catalog integration.
 * Tests the live API endpoints for creating and managing suppliers/materials.
 * Depends on auth.setup.ts (saved session in .auth/user.json).
 */
import { test, expect } from '@playwright/test';

test.describe('Master Data: Suppliers & Materials', () => {
  let orgId: string;

  test.beforeAll(async ({ request }) => {
    // Create a dedicated org for this test suite
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E Master Data Org ${Date.now()}` },
    });
    expect(orgRes.status()).toBe(201);
    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    orgId = orgBody.data.organization.id;

    // Provision trial for any potential project-level operations
    const trialRes = await request.post(`/api/v1/organizations/${orgId}/billing/trial`, {
      data: {},
    });
    expect(trialRes.status()).toBe(201);
  });

  test('creates supplier with contact and retrieves it', async ({ page, request }) => {
    // Create supplier via API
    const supplierCode = `SUP-${Date.now()}`;
    const createRes = await request.post(`/api/v1/organizations/${orgId}/suppliers`, {
      data: {
        supplierCode,
        legalName: 'Acme Steel Supplies Ltd',
        displayName: 'Acme Steel',
        supplierType: 'MATERIAL_SUPPLIER',
        email: 'contact@acmesteel.com',
        phone: '+971-4-123-4567',
      },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()) as { data: { id: string } };
    const supplierId = created.data.id;

    // Add contact to supplier
    const contactRes = await request.post(
      `/api/v1/organizations/${orgId}/suppliers/${supplierId}/contacts`,
      {
        data: {
          name: 'Ahmed Al-Rashid',
          role: 'Sales Manager',
          email: 'ahmed@acmesteel.com',
          phone: '+971-50-555-1234',
          isPrimary: true,
        },
      },
    );
    expect(contactRes.status()).toBe(201);
    const contactBody = (await contactRes.json()) as { data: { id: string; name: string } };
    expect(contactBody.data.name).toBe('Ahmed Al-Rashid');

    // Verify supplier appears in list
    const listRes = await request.get(`/api/v1/organizations/${orgId}/suppliers`);
    expect(listRes.status()).toBe(200);
    const listBody = await listRes.json();
    const suppliers = listBody.data;
    const foundSupplier = Array.isArray(suppliers) ? suppliers.find((s: any) => s.id === supplierId) : null;
    expect(foundSupplier).toBeTruthy();
    expect(foundSupplier?.supplierCode).toBe(supplierCode);
  });

  test('creates material and retrieves it', async ({ page, request }) => {
    // Create material via API
    const materialCode = `MAT-${Date.now()}`;
    const createRes = await request.post(`/api/v1/organizations/${orgId}/materials`, {
      data: {
        materialCode,
        name: 'Rebar 16mm Grade 60',
        description: 'High-strength deformed steel reinforcement bar',
        category: 'STEEL',
        defaultUnitCode: 'TON',
        materialType: 'MATERIAL',
        defaultCurrencyCode: 'AED',
      },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()) as { data: { id: string } };
    const materialId = created.data.id;

    // Verify material appears in list
    const listRes = await request.get(`/api/v1/organizations/${orgId}/materials`);
    expect(listRes.status()).toBe(200);
    const listBody = await listRes.json();
    const materials = listBody.data;
    const foundMaterial = Array.isArray(materials) ? materials.find((m: any) => m.id === materialId) : null;
    expect(foundMaterial).toBeTruthy();
    expect(foundMaterial?.materialCode).toBe(materialCode);
    expect(foundMaterial?.name).toBe('Rebar 16mm Grade 60');

    // Get individual material
    const getRes = await request.get(`/api/v1/organizations/${orgId}/materials/${materialId}`);
    expect(getRes.status()).toBe(200);
    const getBody = (await getRes.json()) as { data: { defaultUnitCode: string; category: string } };
    expect(getBody.data.defaultUnitCode).toBe('TON');
    expect(getBody.data.category).toBe('STEEL');
  });

  test('updates supplier status and verifies change', async ({ page, request }) => {
    // Create a supplier
    const supplierCode = `SUP-UPDATE-${Date.now()}`;
    const createRes = await request.post(`/api/v1/organizations/${orgId}/suppliers`, {
      data: {
        supplierCode,
        legalName: 'Test Supplier for Update',
        displayName: 'Test Update',
      },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()) as { data: { id: string } };
    const supplierId = created.data.id;

    // Update supplier
    const updateRes = await request.patch(
      `/api/v1/organizations/${orgId}/suppliers/${supplierId}`,
      {
        data: {
          displayName: 'Updated Test Supplier',
          status: 'INACTIVE',
        },
      },
    );
    expect(updateRes.status()).toBe(200);
    const updateBody = (await updateRes.json()) as { data: { displayName: string; status: string } };
    expect(updateBody.data.displayName).toBe('Updated Test Supplier');
    expect(updateBody.data.status).toBe('INACTIVE');
  });

  test('filters suppliers by status', async ({ page, request }) => {
    // This test verifies query parameter support
    const listActiveRes = await request.get(
      `/api/v1/organizations/${orgId}/suppliers?status=ACTIVE`,
    );
    expect(listActiveRes.status()).toBe(200);
    const activeBody = await listActiveRes.json();
    
    // All returned suppliers should have ACTIVE status
    const allActive = activeBody.data.every((s: any) => s.status === 'ACTIVE');
    expect(allActive).toBe(true);
  });
});
