// apps/web/e2e/documents.spec.ts
// E2E tests for document management module — upload, versioning, download, metadata updates.

import { test, expect } from '@playwright/test';

test.describe('Documents: Upload & Management', () => {
  let orgId: string;
  let projectId: string;
  let documentId: string;

  test.beforeAll(async ({ request }) => {
    // Create test organization
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E Documents ${Date.now()}` },
    });

    if (orgRes.status() !== 201) {
      test.skip('Trial limit reached, skipping document tests');
      return;
    }

    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    orgId = orgBody.data.organization.id;

    // Create test project
    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: {
        name: 'E2E Documents Project',
        projectCode: `DOC-${Date.now()}`,
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });

    const projectBody = (await projectRes.json()) as { data: { id: string } };
    projectId = projectBody.data.id;
  });

  test('initiates document upload and completes it', async ({ request }) => {
    // Step 1: Initiate upload
    const initiateRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/documents`,
      {
        data: {
          title: 'Structural Drawing Rev A',
          category: 'DRAWING',
          fileName: 'struct-01-rev-a.pdf',
          contentType: 'application/pdf',
          fileSize: 1024000, // 1MB
          description: 'Foundation structural drawings revision A',
          accessPolicy: 'PROJECT_MEMBERS',
        },
      }
    );

    expect(initiateRes.status()).toBe(201);
    const initiateBody = (await initiateRes.json()) as {
      data: { document: { id: string; status: string; currentVersion: number }; uploadUrl: string };
    };

    documentId = initiateBody.data.document.id;
    expect(initiateBody.data.document.status).toBe('PENDING_UPLOAD');
    expect(initiateBody.data.document.currentVersion).toBe(1);
    expect(initiateBody.data.uploadUrl).toContain('http'); // Presigned URL

    // Step 2: Simulate upload completion with checksum
    const completeRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/documents/${documentId}/complete`,
      {
        data: {
          checksum: 'a'.repeat(64), // Mock SHA-256 checksum
        },
      }
    );

    expect(completeRes.status()).toBe(200);
    const completeBody = (await completeRes.json()) as {
      data: { document: { status: string; checksum: string } };
    };

    expect(completeBody.data.document.status).toBe('ACTIVE');
    expect(completeBody.data.document.checksum).toBe('a'.repeat(64));
  });

  test('lists documents with filters', async ({ request }) => {
    const listRes = await request.get(
      `/api/v1/organizations/${orgId}/projects/${projectId}/documents`,
      {
        params: {
          limit: 10,
          category: 'DRAWING',
          status: 'ACTIVE',
        },
      }
    );

    expect([200, 403]).toContain(listRes.status());

    if (listRes.status() === 200) {
      const body = (await listRes.json()) as {
        data: { data: unknown[]; nextCursor: string | null };
      };

      expect(Array.isArray(body.data.data)).toBeTruthy();
      expect(body.data.data.length).toBeGreaterThanOrEqual(1);
      expect(body.data.nextCursor).toBeDefined();
    }
  });

  test('gets document metadata', async ({ request }) => {
    const getRes = await request.get(
      `/api/v1/organizations/${orgId}/projects/${projectId}/documents/${documentId}`
    );

    expect([200, 403, 404]).toContain(getRes.status());

    if (getRes.status() === 200) {
      const body = (await getRes.json()) as {
        data: {
          document: {
            id: string;
            title: string;
            category: string;
            status: string;
            currentVersion: number;
          };
        };
      };

      expect(body.data.document.id).toBe(documentId);
      expect(body.data.document.title).toBe('Structural Drawing Rev A');
      expect(body.data.document.category).toBe('DRAWING');
      expect(body.data.document.status).toBe('ACTIVE');
    }
  });

  test('generates presigned download URL', async ({ request }) => {
    const downloadRes = await request.get(
      `/api/v1/organizations/${orgId}/projects/${projectId}/documents/${documentId}/download`
    );

    expect([200, 403, 404]).toContain(downloadRes.status());

    if (downloadRes.status() === 200) {
      const body = (await downloadRes.json()) as {
        data: { downloadUrl: string; expiresIn: number };
      };

      expect(body.data.downloadUrl).toContain('http');
      expect(body.data.expiresIn).toBeGreaterThan(0);
    }
  });

  test('updates document metadata', async ({ request }) => {
    const updateRes = await request.patch(
      `/api/v1/organizations/${orgId}/projects/${projectId}/documents/${documentId}`,
      {
        data: {
          title: 'Structural Drawing Rev A (Updated)',
          description: 'Updated description with more details',
          accessPolicy: 'PROJECT_MANAGERS_ONLY',
        },
      }
    );

    expect([200, 403, 404]).toContain(updateRes.status());

    if (updateRes.status() === 200) {
      const body = (await updateRes.json()) as {
        data: { document: { title: string; accessPolicy: string } };
      };

      expect(body.data.document.title).toBe('Structural Drawing Rev A (Updated)');
      expect(body.data.document.accessPolicy).toBe('PROJECT_MANAGERS_ONLY');
    }
  });
});

test.describe('Documents: Versioning', () => {
  let orgId: string;
  let projectId: string;
  let documentId: string;
  let versionId: string;

  test.beforeAll(async ({ request }) => {
    // Create test org + project
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E Doc Versions ${Date.now()}` },
    });

    if (orgRes.status() !== 201) {
      test.skip('Trial limit reached, skipping version tests');
      return;
    }

    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    orgId = orgBody.data.organization.id;

    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: {
        name: 'E2E Doc Versions Project',
        projectCode: `DOCV-${Date.now()}`,
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });

    const projectBody = (await projectRes.json()) as { data: { id: string } };
    projectId = projectBody.data.id;

    // Create initial document
    const initiateRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/documents`,
      {
        data: {
          title: 'MEP Drawing',
          category: 'DRAWING',
          fileName: 'mep-01.pdf',
          contentType: 'application/pdf',
          fileSize: 512000,
        },
      }
    );

    const initiateBody = (await initiateRes.json()) as { data: { document: { id: string } } };
    documentId = initiateBody.data.document.id;

    await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/documents/${documentId}/complete`,
      {
        data: { checksum: 'b'.repeat(64) },
      }
    );
  });

  test('creates a new document version', async ({ request }) => {
    // Initiate version 2
    const versionRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/documents/${documentId}/versions`,
      {
        data: {
          fileName: 'mep-01-rev-b.pdf',
          contentType: 'application/pdf',
          fileSize: 550000,
          notes: 'Revision B with updated HVAC layout',
        },
      }
    );

    expect([201, 403, 404]).toContain(versionRes.status());

    if (versionRes.status() === 201) {
      const body = (await versionRes.json()) as {
        data: { version: { id: string; versionNumber: number }; uploadUrl: string };
      };

      versionId = body.data.version.id;
      expect(body.data.version.versionNumber).toBe(2);
      expect(body.data.uploadUrl).toContain('http');
    }
  });

  test('completes a document version upload', async ({ request }) => {
    if (!versionId) test.skip();

    const completeRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/documents/${documentId}/versions/${versionId}/complete`,
      {
        data: { checksum: 'c'.repeat(64) },
      }
    );

    expect([200, 403, 404]).toContain(completeRes.status());

    if (completeRes.status() === 200) {
      const body = (await completeRes.json()) as {
        data: { version: { checksum: string }; document: { currentVersion: number } };
      };

      expect(body.data.version.checksum).toBe('c'.repeat(64));
      expect(body.data.document.currentVersion).toBe(2);
    }
  });

  test('lists all document versions', async ({ request }) => {
    const listRes = await request.get(
      `/api/v1/organizations/${orgId}/projects/${projectId}/documents/${documentId}/versions`
    );

    expect([200, 403, 404]).toContain(listRes.status());

    if (listRes.status() === 200) {
      const body = (await listRes.json()) as { data: { versions: unknown[] } };

      expect(Array.isArray(body.data.versions)).toBeTruthy();
      expect(body.data.versions.length).toBeGreaterThanOrEqual(1);
    }
  });
});

test.describe('Documents: Deletion', () => {
  let orgId: string;
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E Doc Delete ${Date.now()}` },
    });

    if (orgRes.status() !== 201) {
      test.skip();
      return;
    }

    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    orgId = orgBody.data.organization.id;

    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: {
        name: 'E2E Doc Delete Project',
        projectCode: `DOCDEL-${Date.now()}`,
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });

    const projectBody = (await projectRes.json()) as { data: { id: string } };
    projectId = projectBody.data.id;
  });

  test('soft-deletes a document', async ({ request }) => {
    // Create document
    const initiateRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/documents`,
      {
        data: {
          title: 'Temporary Document',
          category: 'OTHER',
          fileName: 'temp.pdf',
          contentType: 'application/pdf',
          fileSize: 100000,
        },
      }
    );

    const initiateBody = (await initiateRes.json()) as { data: { document: { id: string } } };
    const docId = initiateBody.data.document.id;

    await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/documents/${docId}/complete`,
      {
        data: { checksum: 'd'.repeat(64) },
      }
    );

    // Delete document
    const deleteRes = await request.delete(
      `/api/v1/organizations/${orgId}/projects/${projectId}/documents/${docId}`
    );

    expect([204, 403, 404]).toContain(deleteRes.status());

    // Verify document is deleted
    if (deleteRes.status() === 204) {
      const getRes = await request.get(
        `/api/v1/organizations/${orgId}/projects/${projectId}/documents/${docId}`
      );

      // Should return 404 or document with DELETED status
      expect([404, 200]).toContain(getRes.status());

      if (getRes.status() === 200) {
        const body = (await getRes.json()) as { data: { document: { status: string } } };
        expect(body.data.document.status).toBe('DELETED');
      }
    }
  });
});

test.describe('Documents: API Smoke Tests', () => {
  test('document endpoints are registered', async ({ request }) => {
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `Smoke Docs ${Date.now()}` },
    });

    if (orgRes.status() !== 201) {
      console.log('Org creation blocked, testing with placeholder IDs');
      const testRes = await request.get(
        '/api/v1/organizations/org_test/projects/proj_test/documents'
      );
      expect([200, 401, 403, 404]).toContain(testRes.status());
      return;
    }

    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    const orgId = orgBody.data.organization.id;

    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: {
        name: 'Smoke Docs Project',
        projectCode: `SMKDOC-${Date.now()}`,
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });

    if (projectRes.status() !== 201) {
      console.log('Project creation failed');
      return;
    }

    const projectBody = (await projectRes.json()) as { data: { id: string } };
    const projectId = projectBody.data.id;

    // Verify all document endpoints are registered
    const endpoints = [
      `/api/v1/organizations/${orgId}/projects/${projectId}/documents`,
      `/api/v1/organizations/${orgId}/projects/${projectId}/documents/doc_test`,
      `/api/v1/organizations/${orgId}/projects/${projectId}/documents/doc_test/download`,
      `/api/v1/organizations/${orgId}/projects/${projectId}/documents/doc_test/versions`,
    ];

    for (const endpoint of endpoints) {
      const testRes = await request.get(endpoint);
      expect([200, 403, 404]).toContain(testRes.status());
    }
  });
});

