import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  complianceInspections,
  complianceRecords,
  documentEntityLinks,
  documents,
  outboxEvents,
  permits,
  subcontractors,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import type { ProjectDTO } from '../../src/modules/project/core/project.types.js';
import { createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';
import { createTestApp } from '../helpers/test-app.js';

describe('Project compliance (integration)', () => {
  let app: FastifyInstance;
  let organizationId: string;
  let projectId: string;
  let ownerUserId: string;
  let ownerToken: string;
  let otherOrganizationId: string;
  let otherProjectId: string;
  let otherToken: string;
  let foreignSubcontractorId: string;
  const runId = crypto.randomUUID().slice(0, 8);

  const createProject = async (
    token: string,
    targetOrganizationId: string,
    name: string,
  ): Promise<ProjectDTO> => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${targetOrganizationId}/projects`,
      headers: { authorization: ['Bearer', token].join(' ') },
      payload: { name, currency: 'USD' },
    });
    expect(response.statusCode).toBe(201);
    return response.json<ApiSuccessResponse<{ project: ProjectDTO }>>().data.project;
  };

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `compliance_owner_${runId}@example.com` });
    ownerUserId = owner.user.id;
    ownerToken = owner.token;
    const organization = await createOrgWithAdmin(app, ownerToken, `Compliance ${runId}`);
    organizationId = organization.orgId;
    projectId = (await createProject(ownerToken, organizationId, `Compliance Project ${runId}`)).id;

    const other = await createVerifiedUser({ email: `compliance_other_${runId}@example.com` });
    otherToken = other.token;
    const otherOrganization = await createOrgWithAdmin(app, otherToken, `Other Compliance ${runId}`);
    otherOrganizationId = otherOrganization.orgId;
    otherProjectId = (await createProject(otherToken, otherOrganizationId, `Other Project ${runId}`)).id;
    const [subcontractor] = await getDb().insert(subcontractors).values({
      id: crypto.randomUUID(),
      organizationId: otherOrganizationId,
      legalName: `Foreign Subcontractor ${runId}`,
      displayName: `Foreign Subcontractor ${runId}`,
      status: 'ACTIVE',
    }).returning({ id: subcontractors.id });
    foreignSubcontractorId = subcontractor!.id;
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('enforces locked permit transitions, ownership boundaries, verification, and scoped cursors', async () => {
    const base = `/api/v1/organizations/${organizationId}/projects/${projectId}`;
    const foreignBase = `/api/v1/organizations/${otherOrganizationId}/projects/${otherProjectId}`;
    const auth = { authorization: ['Bearer', ownerToken].join(' ') };

    const permitResponse = await app.inject({
      method: 'POST',
      url: `${base}/permits`,
      headers: auth,
      payload: {
        permitType: 'Building Permit',
        referenceNumber: `BP-${runId}`,
        expiryDate: '2027-10-01',
      },
    });
    expect(permitResponse.statusCode).toBe(201);
    const permit = permitResponse.json<ApiSuccessResponse<{ permit: { id: string; status: string } }>>()
      .data.permit;
    expect(permit.status).toBe('PENDING');
    const evidenceDocumentId = crypto.randomUUID();
    await getDb().insert(documents).values({
      id: evidenceDocumentId,
      organizationId,
      projectId,
      category: 'PERMIT',
      title: 'Permit evidence',
      status: 'ACTIVE',
      processingStatus: 'COMPLETED',
      uploadedBy: ownerUserId,
      fileName: 'permit.pdf',
      fileSize: 1,
      contentType: 'application/pdf',
      storageKey: `tests/${evidenceDocumentId}.pdf`,
      accessPolicy: 'PROJECT_MANAGERS_ONLY',
    });
    const attachEvidenceResponse = await app.inject({
      method: 'POST',
      url: `${base}/permits/${permit.id}/documents`,
      headers: auth,
      payload: { documentId: evidenceDocumentId },
    });
    expect(attachEvidenceResponse.statusCode).toBe(204);
    const evidenceLinks = await getDb().select().from(documentEntityLinks)
      .where(eq(documentEntityLinks.documentId, evidenceDocumentId));
    expect(evidenceLinks).toHaveLength(1);
    expect(evidenceLinks[0]).toMatchObject({
      organizationId,
      entityType: 'permit',
      entityId: permit.id,
    });

    const invalidPermitTransition = await app.inject({
      method: 'POST',
      url: `${base}/permits/${permit.id}/transition`,
      headers: auth,
      payload: { status: 'ACTIVE' },
    });
    expect(invalidPermitTransition.statusCode).toBe(422);

    for (const status of ['APPLIED', 'ISSUED', 'ACTIVE']) {
      const transition = await app.inject({
        method: 'POST',
        url: `${base}/permits/${permit.id}/transition`,
        headers: auth,
        payload: { status },
      });
      expect(transition.statusCode).toBe(200);
    }
    const permitRows = await getDb().select().from(permits).where(eq(permits.id, permit.id));
    expect(permitRows[0]?.status).toBe('ACTIVE');

    const foreignPermitResponse = await app.inject({
      method: 'POST',
      url: `${foreignBase}/permits`,
      headers: { authorization: ['Bearer', otherToken].join(' ') },
      payload: {
        permitType: 'Foreign Permit',
        expiryDate: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
      },
    });
    expect(foreignPermitResponse.statusCode).toBe(201);
    const foreignPermitId = foreignPermitResponse.json<
      ApiSuccessResponse<{ permit: { id: string } }>
    >().data.permit.id;
    for (const status of ['APPLIED', 'ISSUED', 'ACTIVE']) {
      const transition = await app.inject({
        method: 'POST',
        url: `${foreignBase}/permits/${foreignPermitId}/transition`,
        headers: { authorization: ['Bearer', otherToken].join(' ') },
        payload: { status },
      });
      expect(transition.statusCode).toBe(200);
    }
    const foreignInspectionResponse = await app.inject({
      method: 'POST',
      url: `${foreignBase}/compliance-inspections`,
      headers: { authorization: ['Bearer', otherToken].join(' ') },
      payload: { inspectionType: 'Foreign inspection' },
    });
    expect(foreignInspectionResponse.statusCode).toBe(201);
    const foreignInspectionId = foreignInspectionResponse.json<
      ApiSuccessResponse<{ inspection: { id: string } }>
    >().data.inspection.id;
    const foreignRecordResponse = await app.inject({
      method: 'POST',
      url: `${foreignBase}/compliance-records`,
      headers: { authorization: ['Bearer', otherToken].join(' ') },
      payload: { requirementType: 'Foreign compliance record' },
    });
    expect(foreignRecordResponse.statusCode).toBe(201);
    const foreignRecordId = foreignRecordResponse.json<
      ApiSuccessResponse<{ record: { id: string } }>
    >().data.record.id;

    const crossProjectInspection = await app.inject({
      method: 'POST',
      url: `${base}/compliance-inspections`,
      headers: auth,
      payload: { permitId: foreignPermitId, inspectionType: 'Final inspection' },
    });
    expect(crossProjectInspection.statusCode).toBe(422);

    const inspectionResponse = await app.inject({
      method: 'POST',
      url: `${base}/compliance-inspections`,
      headers: auth,
      payload: { permitId: permit.id, inspectionType: 'Final inspection' },
    });
    expect(inspectionResponse.statusCode).toBe(201);
    const inspection = inspectionResponse.json<
      ApiSuccessResponse<{ inspection: { id: string; status: string } }>
    >().data.inspection;
    const completeResponse = await app.inject({
      method: 'POST',
      url: `${base}/compliance-inspections/${inspection.id}/complete`,
      headers: auth,
      payload: { result: 'PASS', performedDate: '2026-10-04' },
    });
    expect(completeResponse.statusCode).toBe(200);
    const inspectionRows = await getDb().select().from(complianceInspections)
      .where(eq(complianceInspections.id, inspection.id));
    expect(inspectionRows[0]?.status).toBe('COMPLETED');

    const foreignSubjectResponse = await app.inject({
      method: 'POST',
      url: `${base}/compliance-records`,
      headers: auth,
      payload: {
        requirementType: 'Insurance',
        subjectType: 'SUBCONTRACTOR',
        subjectId: foreignSubcontractorId,
      },
    });
    expect(foreignSubjectResponse.statusCode).toBe(422);

    const recordResponse = await app.inject({
      method: 'POST',
      url: `${base}/compliance-records`,
      headers: auth,
      payload: { requirementType: 'Project insurance' },
    });
    expect(recordResponse.statusCode).toBe(201);
    const record = recordResponse.json<
      ApiSuccessResponse<{ record: { id: string; status: string } }>
    >().data.record;
    const prematureVerify = await app.inject({
      method: 'POST',
      url: `${base}/compliance-records/${record.id}/verify`,
      headers: auth,
      payload: { verificationRef: `VER-${runId}` },
    });
    expect(prematureVerify.statusCode).toBe(422);
    const activateResponse = await app.inject({
      method: 'PATCH',
      url: `${base}/compliance-records/${record.id}`,
      headers: auth,
      payload: { status: 'ACTIVE' },
    });
    expect(activateResponse.statusCode).toBe(200);
    const verifyResponse = await app.inject({
      method: 'POST',
      url: `${base}/compliance-records/${record.id}/verify`,
      headers: auth,
      payload: { verificationRef: `VER-${runId}` },
    });
    expect(verifyResponse.statusCode).toBe(200);
    const recordRows = await getDb().select().from(complianceRecords)
      .where(eq(complianceRecords.id, record.id));
    expect(recordRows[0]?.status).toBe('VERIFIED');

    const secondPermitResponse = await app.inject({
      method: 'POST',
      url: `${base}/permits`,
      headers: auth,
      payload: { permitType: 'Temporary Permit' },
    });
    expect(secondPermitResponse.statusCode).toBe(201);
    const secondPermitId = secondPermitResponse.json<
      ApiSuccessResponse<{ permit: { id: string } }>
    >().data.permit.id;
    const listResponse = await app.inject({
      method: 'GET',
      url: `${base}/permits?limit=1`,
      headers: auth,
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().data.data).toHaveLength(1);
    const nextCursor = listResponse.json().data.nextCursor as string;
    expect(nextCursor).toBeTruthy();
    const nextPageResponse = await app.inject({
      method: 'GET',
      url: `${base}/permits?limit=1&cursor=${encodeURIComponent(nextCursor)}`,
      headers: auth,
    });
    expect(nextPageResponse.statusCode).toBe(200);
    expect(nextPageResponse.json().data.data).toHaveLength(1);
    expect(nextPageResponse.json().data.data[0].id).not.toBe(
      listResponse.json().data.data[0].id,
    );
    expect([
      listResponse.json().data.data[0].id,
      nextPageResponse.json().data.data[0].id,
    ]).toContain(secondPermitId);

    const foreignResources = [
      { path: 'permits', id: foreignPermitId },
      { path: 'compliance-inspections', id: foreignInspectionId },
      { path: 'compliance-records', id: foreignRecordId },
    ];
    for (const resource of foreignResources) {
      const scopedList = await app.inject({
        method: 'GET',
        url: `${base}/${resource.path}?limit=100`,
        headers: auth,
      });
      expect(scopedList.statusCode).toBe(200);
      expect(scopedList.body).not.toContain(resource.id);
    }
    const expiringList = await app.inject({
      method: 'GET',
      url: `${base}/expiring?days=30`,
      headers: auth,
    });
    expect(expiringList.statusCode).toBe(200);
    expect(expiringList.body).not.toContain(foreignPermitId);

    const foreignRead = await app.inject({
      method: 'GET',
      url: `${foreignBase}/permits/${permit.id}`,
      headers: { authorization: ['Bearer', otherToken].join(' ') },
    });
    expect(foreignRead.statusCode).toBe(404);
    const foreignUpdate = await app.inject({
      method: 'PATCH',
      url: `${foreignBase}/permits/${permit.id}`,
      headers: { authorization: ['Bearer', otherToken].join(' ') },
      payload: { notes: 'attempted cross-tenant update' },
    });
    expect(foreignUpdate.statusCode).toBe(404);
    const foreignDelete = await app.inject({
      method: 'DELETE',
      url: `${foreignBase}/permits/${permit.id}`,
      headers: { authorization: ['Bearer', otherToken].join(' ') },
    });
    expect(foreignDelete.statusCode).toBe(404);

    const scopedOutboxEvents = await getDb().select().from(outboxEvents).where(and(
      eq(outboxEvents.organizationId, organizationId),
      eq(outboxEvents.eventType, 'compliance_record.verified'),
    ));
    expect(scopedOutboxEvents.some((event) =>
      (event.payload as { complianceRecordId?: string }).complianceRecordId === record.id,
    )).toBe(true);
  });
});
