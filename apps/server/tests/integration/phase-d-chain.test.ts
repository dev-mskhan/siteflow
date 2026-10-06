import { and, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  complianceRecords,
  documentEntityLinks,
  documents,
  outboxEvents,
  permits,
  projectMembers,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { DocumentService } from '../../src/modules/project/documents/document.service.js';
import { expiryScannerService } from '../../src/modules/project/compliance/expiry-scanner.service.js';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import type { ProjectDTO } from '../../src/modules/project/core/project.types.js';
import { createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';
import { createTestApp } from '../helpers/test-app.js';

describe('Phase D complete workflow chain (integration)', () => {
  let app: FastifyInstance;
  let organizationId: string;
  let projectId: string;
  let ownerUserId: string;
  let ownerToken: string;
  let reviewerMemberId: string;
  const runId = crypto.randomUUID().slice(0, 8);

  const createProject = async (): Promise<ProjectDTO> => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: `Phase D chain ${runId}`, currency: 'USD' },
    });
    expect(response.statusCode).toBe(201);
    return response.json<ApiSuccessResponse<{ project: ProjectDTO }>>().data.project;
  };

  const headers = () => ({ authorization: `Bearer ${ownerToken}` });
  const base = () => `/api/v1/organizations/${organizationId}/projects/${projectId}`;

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `phase_d_chain_${runId}@example.com` });
    ownerUserId = owner.user.id;
    ownerToken = owner.token;
    const organization = await createOrgWithAdmin(app, ownerToken, `Phase D chain ${runId}`);
    organizationId = organization.orgId;
    projectId = (await createProject()).id;
    const [membership] = await getDb().select({ id: projectMembers.id }).from(projectMembers)
      .where(and(
        eq(projectMembers.organizationId, organizationId),
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, ownerUserId),
      )).limit(1);
    reviewerMemberId = membership!.id;
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('uploads and links evidence across an RFI, approved submittal, permit and expiring record', async () => {
    const root = base();
    const content = `Phase D evidence ${runId}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
    const checksum = Buffer.from(digest).toString('hex');
    const expiryDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

    const uploadResponse = await app.inject({
      method: 'POST',
      url: `${root}/documents`,
      headers: headers(),
      payload: {
        title: 'Foundation detail evidence',
        category: 'DRAWING',
        fileName: 'foundation-evidence.txt',
        contentType: 'text/plain',
        fileSize: Buffer.byteLength(content),
        expiryDate,
      },
    });
    expect(uploadResponse.statusCode).toBe(201);
    const upload = uploadResponse.json<ApiSuccessResponse<{
      document: { id: string };
      uploadUrl: string;
    }>>().data;
    const putResponse = await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'text/plain' },
      body: content,
    });
    expect(putResponse.status).toBe(200);
    const completeResponse = await app.inject({
      method: 'POST',
      url: `${root}/documents/${upload.document.id}/complete`,
      headers: headers(),
      payload: { checksum },
    });
    expect(completeResponse.statusCode).toBe(200);
    await new DocumentService().processUploadedVersion(
      organizationId,
      projectId,
      upload.document.id,
      1,
    );

    const rfiResponse = await app.inject({
      method: 'POST',
      url: `${root}/rfis`,
      headers: headers(),
      payload: {
        title: 'Foundation detail clarification',
        question: 'Confirm the reinforcement detail for the foundation.',
      },
    });
    expect(rfiResponse.statusCode).toBe(201);
    const rfi = rfiResponse.json<ApiSuccessResponse<{
      rfi: { id: string; rfiNumber: string };
    }>>().data.rfi;
    const rfiDocumentResponse = await app.inject({
      method: 'POST',
      url: `${root}/rfis/${rfi.id}/documents`,
      headers: headers(),
      payload: { documentId: upload.document.id },
    });
    expect(rfiDocumentResponse.statusCode).toBe(204);
    expect((await app.inject({
      method: 'POST',
      url: `${root}/rfis/${rfi.id}/submit`,
      headers: headers(),
    })).statusCode).toBe(200);
    const responseText = 'Use the approved reinforcement schedule on the attached drawing.';
    expect((await app.inject({
      method: 'POST',
      url: `${root}/rfis/${rfi.id}/respond`,
      headers: headers(),
      payload: { response: responseText },
    })).statusCode).toBe(200);

    const submittalResponse = await app.inject({
      method: 'POST',
      url: `${root}/submittals`,
      headers: headers(),
      payload: {
        title: `Foundation detail for ${rfi.rfiNumber}`,
        specReference: '03 30 00',
        reviewerMemberId,
        notes: `Prepared against RFI ${rfi.rfiNumber}: ${responseText}`,
      },
    });
    expect(submittalResponse.statusCode).toBe(201);
    const submittal = submittalResponse.json<ApiSuccessResponse<{
      submittal: { id: string };
    }>>().data.submittal;
    const submittalDocumentResponse = await app.inject({
      method: 'POST',
      url: `${root}/submittals/${submittal.id}/documents`,
      headers: headers(),
      payload: { documentId: upload.document.id },
    });
    expect(submittalDocumentResponse.statusCode).toBe(204);
    expect((await app.inject({
      method: 'POST',
      url: `${root}/submittals/${submittal.id}/submit`,
      headers: headers(),
    })).statusCode).toBe(200);
    const reviewResponse = await app.inject({
      method: 'POST',
      url: `${root}/submittals/${submittal.id}/review`,
      headers: headers(),
      payload: { response: 'APPROVED', responseNotes: 'Approved against the RFI response.' },
    });
    expect(reviewResponse.statusCode).toBe(200);

    const permitResponse = await app.inject({
      method: 'POST',
      url: `${root}/permits`,
      headers: headers(),
      payload: { permitType: 'Foundation permit', expiryDate },
    });
    expect(permitResponse.statusCode).toBe(201);
    const permit = permitResponse.json<ApiSuccessResponse<{ permit: { id: string } }>>()
      .data.permit;
    const permitDocumentResponse = await app.inject({
      method: 'POST',
      url: `${root}/permits/${permit.id}/documents`,
      headers: headers(),
      payload: { documentId: upload.document.id },
    });
    expect(permitDocumentResponse.statusCode).toBe(204);
    for (const status of ['APPLIED', 'ISSUED', 'ACTIVE']) {
      const transition = await app.inject({
        method: 'POST',
        url: `${root}/permits/${permit.id}/transition`,
        headers: headers(),
        payload: { status },
      });
      expect(transition.statusCode).toBe(200);
    }

    const inspectionResponse = await app.inject({
      method: 'POST',
      url: `${root}/compliance-inspections`,
      headers: headers(),
      payload: { permitId: permit.id, inspectionType: 'Foundation inspection' },
    });
    expect(inspectionResponse.statusCode).toBe(201);
    const inspection = inspectionResponse.json<ApiSuccessResponse<{
      inspection: { id: string };
    }>>().data.inspection;
    const inspectionDocumentResponse = await app.inject({
      method: 'POST',
      url: `${root}/compliance-inspections/${inspection.id}/documents`,
      headers: headers(),
      payload: { documentId: upload.document.id },
    });
    expect(inspectionDocumentResponse.statusCode).toBe(204);

    const recordResponse = await app.inject({
      method: 'POST',
      url: `${root}/compliance-records`,
      headers: headers(),
      payload: { requirementType: 'Foundation permit evidence', expiryDate },
    });
    expect(recordResponse.statusCode).toBe(201);
    const record = recordResponse.json<ApiSuccessResponse<{ record: { id: string } }>>()
      .data.record;
    const recordDocumentResponse = await app.inject({
      method: 'POST',
      url: `${root}/compliance-records/${record.id}/documents`,
      headers: headers(),
      payload: { documentId: upload.document.id },
    });
    expect(recordDocumentResponse.statusCode).toBe(204);
    expect((await app.inject({
      method: 'PATCH',
      url: `${root}/compliance-records/${record.id}`,
      headers: headers(),
      payload: { status: 'ACTIVE' },
    })).statusCode).toBe(200);

    await expiryScannerService.scan(30);
    const expiringResponse = await app.inject({
      method: 'GET',
      url: `${root}/expiring?days=30`,
      headers: headers(),
    });
    expect(expiringResponse.statusCode).toBe(200);
    expect(expiringResponse.json().data.items.map((item: { entityId: string }) => item.entityId))
      .toEqual(expect.arrayContaining([upload.document.id, permit.id, record.id]));

    const links = await getDb().select().from(documentEntityLinks)
      .where(eq(documentEntityLinks.documentId, upload.document.id));
    expect(links.map((link) => link.entityType)).toEqual(expect.arrayContaining([
      'rfi',
      'submittal',
      'permit',
      'inspection',
      'compliance_record',
    ]));
    const expiryEvents = await getDb().select().from(outboxEvents).where(and(
      eq(outboxEvents.organizationId, organizationId),
      inArray(outboxEvents.eventType, [
        'document.expiring',
        'permit.expiring',
        'compliance_record.expiring',
      ]),
    ));
    for (const entityId of [upload.document.id, permit.id, record.id]) {
      expect(expiryEvents.filter((event) =>
        JSON.stringify(event.payload).includes(entityId),
      )).toHaveLength(1);
    }

    const documentRow = await getDb().select({
      organizationId: documents.organizationId,
      projectId: documents.projectId,
      status: documents.status,
    }).from(documents).where(eq(documents.id, upload.document.id));
    expect(documentRow[0]).toMatchObject({ organizationId, projectId, status: 'ACTIVE' });
    const permitRow = await getDb().select({ status: permits.status })
      .from(permits).where(eq(permits.id, permit.id));
    expect(permitRow[0]?.status).toBe('ACTIVE');
    const recordRow = await getDb().select({ status: complianceRecords.status })
      .from(complianceRecords).where(eq(complianceRecords.id, record.id));
    expect(recordRow[0]?.status).toBe('ACTIVE');
  }, 60000);
});
