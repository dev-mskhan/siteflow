import { and, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  complianceRecords,
  correctiveActions,
  documentEntityLinks,
  documents,
  outboxEvents,
  permits,
  projectMembers,
  safetyEvents,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import type { ProjectDTO } from '../../src/modules/project/core/project.types.js';
import { expiryScannerService } from '../../src/modules/project/compliance/expiry-scanner.service.js';
import { addMemberDirectly, createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';
import { createTestApp } from '../helpers/test-app.js';

describe('Phase D quality, safety, and expiry integration', () => {
  let app: FastifyInstance;
  let organizationId: string;
  let projectId: string;
  let ownerUserId: string;
  let ownerToken: string;
  let safetyManagerToken: string;
  let foreignOrganizationId: string;
  let foreignProjectId: string;
  let foreignOwnerToken: string;
  const runId = crypto.randomUUID().slice(0, 8);
  const headers = () => ({ authorization: `Bearer ${ownerToken}` });
  const base = () => `/api/v1/organizations/${organizationId}/projects/${projectId}`;

  const createProject = async (name: string): Promise<ProjectDTO> => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects`,
      headers: headers(),
      payload: { name, currency: 'USD' },
    });
    expect(response.statusCode).toBe(201);
    return response.json<ApiSuccessResponse<{ project: ProjectDTO }>>().data.project;
  };

  const createExpiringDocument = async (expiryDate?: string) => {
    const id = crypto.randomUUID();
    await getDb().insert(documents).values({
      id,
      organizationId,
      projectId,
      category: 'PERMIT',
      title: `Expiring document ${runId}`,
      status: 'ACTIVE',
      processingStatus: 'COMPLETED',
      uploadedBy: ownerUserId,
      fileName: 'evidence.pdf',
      fileSize: 1,
      contentType: 'application/pdf',
      storageKey: `tests/${id}.pdf`,
      ...(expiryDate ? { expiryDate } : {}),
    });
    return id;
  };

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `phase_d_${runId}@example.com` });
    ownerUserId = owner.user.id;
    ownerToken = owner.token;
    const organization = await createOrgWithAdmin(app, ownerToken, `Phase D ${runId}`);
    organizationId = organization.orgId;
    projectId = (await createProject(`Phase D Project ${runId}`)).id;
    const foreignOwner = await createVerifiedUser({
      email: `phase_d_foreign_${runId}@example.com`,
    });
    foreignOwnerToken = foreignOwner.token;
    const foreignOrganization = await createOrgWithAdmin(
      app,
      foreignOwnerToken,
      `Foreign Phase D ${runId}`,
    );
    foreignOrganizationId = foreignOrganization.orgId;
    const foreignProjectResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${foreignOrganizationId}/projects`,
      headers: { authorization: ['Bearer', foreignOwnerToken].join(' ') },
      payload: { name: `Foreign Phase D Project ${runId}`, currency: 'USD' },
    });
    expect(foreignProjectResponse.statusCode).toBe(201);
    foreignProjectId = foreignProjectResponse.json<ApiSuccessResponse<{ project: ProjectDTO }>>()
      .data.project.id;
    const safetyManager = await createVerifiedUser({
      email: `phase_d_manager_${runId}@example.com`,
    });
    safetyManagerToken = safetyManager.token;
    await addMemberDirectly(
      organizationId,
      safetyManager.user.id,
      organization.roleMap.get('Organization Admin')!,
    );
    await getDb().insert(projectMembers).values({
      id: crypto.randomUUID(),
      organizationId,
      projectId,
      userId: safetyManager.user.id,
      role: 'PROJECT_MANAGER',
      status: 'ACTIVE',
      addedBy: ownerUserId,
    });
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('runs quality and safety lifecycles, tenant-scoped expiration, and idempotent scanning', async () => {
    const root = base();
    const inspectionResponse = await app.inject({
      method: 'POST',
      url: `${root}/quality-inspections`,
      headers: headers(),
      payload: { inspectionType: 'Concrete pour', scheduledDate: '2026-10-01' },
    });
    expect(inspectionResponse.statusCode).toBe(201);
    const inspection = inspectionResponse.json<ApiSuccessResponse<{ inspection: { id: string } }>>()
      .data.inspection;

    const started = await app.inject({
      method: 'POST',
      url: `${root}/quality-inspections/${inspection.id}/start`,
      headers: headers(),
    });
    expect(started.statusCode).toBe(200);
    const completed = await app.inject({
      method: 'POST',
      url: `${root}/quality-inspections/${inspection.id}/complete`,
      headers: headers(),
      payload: { result: 'FAIL', findings: 'Concrete surface defects', performedDate: '2026-10-02' },
    });
    expect(completed.statusCode).toBe(200);

    const deficiencyResponse = await app.inject({
      method: 'POST',
      url: `${root}/quality-deficiencies`,
      headers: headers(),
      payload: {
        inspectionId: inspection.id,
        title: 'Repair surface defects',
        severity: 'HIGH',
      },
    });
    expect(deficiencyResponse.statusCode).toBe(201);
    const deficiency = deficiencyResponse.json<
      ApiSuccessResponse<{ deficiency: { id: string; status: string } }>
    >().data.deficiency;
    expect(deficiency.status).toBe('OPEN');

    const actionResponse = await app.inject({
      method: 'POST',
      url: `${root}/corrective-actions`,
      headers: headers(),
      payload: {
        sourceType: 'QUALITY_DEFICIENCY',
        sourceId: deficiency.id,
        title: 'Repair concrete finish',
      },
    });
    expect(actionResponse.statusCode).toBe(201);
    const qualityAction = actionResponse.json<
      ApiSuccessResponse<{ action: { id: string } }>
    >().data.action;
    expect((await getDb().select().from(correctiveActions).where(eq(correctiveActions.id, qualityAction.id)))[0]?.sourceType)
      .toBe('QUALITY_DEFICIENCY');

    const beginAction = await app.inject({
      method: 'PATCH',
      url: `${root}/corrective-actions/${qualityAction.id}`,
      headers: headers(),
      payload: { status: 'IN_PROGRESS' },
    });
    expect(beginAction.statusCode).toBe(200);
    expect((await app.inject({
      method: 'POST',
      url: `${root}/corrective-actions/${qualityAction.id}/complete`,
      headers: headers(),
    })).statusCode).toBe(200);
    const verifiedAction = await app.inject({
      method: 'POST',
      url: `${root}/corrective-actions/${qualityAction.id}/verify`,
      headers: headers(),
      payload: {},
    });
    expect(verifiedAction.statusCode).toBe(200);
    expect(verifiedAction.json<ApiSuccessResponse<{ action: { status: string; verifiedBy: string | null } }>>()
      .data.action).toMatchObject({ status: 'VERIFIED', verifiedBy: ownerUserId });

    const highEventResponse = await app.inject({
      method: 'POST',
      url: `${root}/safety-events`,
      headers: headers(),
      payload: {
        eventType: 'INCIDENT',
        title: 'Equipment incident',
        description: 'A worker reported an equipment incident.',
        severity: 'HIGH',
        occurredAt: new Date().toISOString(),
      },
    });
    expect(highEventResponse.statusCode).toBe(201);
    const highEvent = highEventResponse.json<ApiSuccessResponse<{ event: { id: string; status: string } }>>()
      .data.event;
    expect(highEvent.status).toBe('REPORTED');
    const incidentOutbox = await getDb().select().from(outboxEvents).where(and(
      eq(outboxEvents.organizationId, organizationId),
      eq(outboxEvents.eventType, 'safety.incident_reported'),
    ));
    expect(incidentOutbox.some((entry) => JSON.stringify(entry.payload).includes(highEvent.id))).toBe(true);

    const observationResponse = await app.inject({
      method: 'POST',
      url: `${root}/safety-events`,
      headers: headers(),
      payload: {
        eventType: 'UNSAFE_CONDITION',
        title: 'Unsecured materials',
        description: 'Materials were found unsecured.',
        severity: 'LOW',
        occurredAt: new Date().toISOString(),
      },
    });
    expect(observationResponse.statusCode).toBe(201);
    const observation = observationResponse.json<
      ApiSuccessResponse<{ event: { id: string; status: string } }>
    >().data.event;
    expect(observation.status).toBe('REPORTED');
    const investigated = await app.inject({
      method: 'POST',
      url: `${root}/safety-events/${observation.id}/investigate`,
      headers: headers(),
      payload: { rootCause: 'Storage area was not secured' },
    });
    expect(investigated.statusCode).toBe(200);
    const actionRequired = await app.inject({
      method: 'PATCH',
      url: `${root}/safety-events/${observation.id}`,
      headers: headers(),
      payload: { status: 'CORRECTIVE_ACTION_REQUIRED', rootCause: 'Storage area was not secured' },
    });
    expect(actionRequired.statusCode).toBe(200);
    const safetyActionResponse = await app.inject({
      method: 'POST',
      url: `${root}/safety-events/${observation.id}/corrective-actions`,
      headers: headers(),
      payload: { title: 'Secure the storage area' },
    });
    expect(safetyActionResponse.statusCode).toBe(201);
    const safetyAction = safetyActionResponse.json<ApiSuccessResponse<{ action: { id: string } }>>()
      .data.action;
    expect((await getDb().select().from(correctiveActions).where(eq(correctiveActions.id, safetyAction.id)))[0]?.sourceType)
      .toBe('SAFETY_OBSERVATION');
    const safetyActionStarted = await app.inject({
      method: 'PATCH',
      url: `${root}/corrective-actions/${safetyAction.id}`,
      headers: headers(),
      payload: { status: 'IN_PROGRESS' },
    });
    expect(safetyActionStarted.statusCode).toBe(200);
    expect((await app.inject({
      method: 'POST',
      url: `${root}/corrective-actions/${safetyAction.id}/complete`,
      headers: headers(),
    })).statusCode).toBe(200);
    expect((await app.inject({
      method: 'POST',
      url: `${root}/corrective-actions/${safetyAction.id}/verify`,
      headers: headers(),
      payload: {},
    })).statusCode).toBe(200);
    const closedObservation = await getDb().select().from(safetyEvents)
      .where(eq(safetyEvents.id, observation.id));
    expect(closedObservation[0]?.status).toBe('CLOSED');

    const closeRaceEvent = await app.inject({
      method: 'POST',
      url: `${root}/safety-events`,
      headers: headers(),
      payload: {
        eventType: 'NEAR_MISS',
        title: 'Minor near miss',
        description: 'A minor near miss was reported.',
        severity: 'LOW',
        occurredAt: new Date().toISOString(),
      },
    });
    const closeRaceId = closeRaceEvent.json<ApiSuccessResponse<{ event: { id: string } }>>()
      .data.event.id;
    const closeResults = await Promise.all([ownerToken, safetyManagerToken].map((token) => app.inject({
      method: 'POST',
      url: `${root}/safety-events/${closeRaceId}/close`,
      headers: { authorization: ['Bearer', token].join(' ') },
      payload: { notes: 'Closed after review' },
    })));
    expect(closeResults.map((result) => result.statusCode).sort()).toEqual([200, 422]);

    const safetyDocumentId = await createExpiringDocument();
    const attachDocument = await app.inject({
      method: 'POST',
      url: `${root}/safety-events/${highEvent.id}/documents`,
      headers: headers(),
      payload: { documentId: safetyDocumentId },
    });
    expect(attachDocument.statusCode).toBe(204);
    const safetyDocumentLink = await getDb().select().from(documentEntityLinks)
      .where(eq(documentEntityLinks.documentId, safetyDocumentId));
    expect(safetyDocumentLink[0]).toMatchObject({
      organizationId,
      entityType: 'safety_event',
      entityId: highEvent.id,
    });

    const meetingResponse = await app.inject({
      method: 'POST',
      url: `${root}/safety-meetings`,
      headers: headers(),
      payload: {
        meetingType: 'Toolbox Talk',
        title: 'Weekly safety briefing',
        scheduledAt: new Date().toISOString(),
        attendeeCount: 4,
      },
    });
    expect(meetingResponse.statusCode).toBe(201);

    const foreignBase = `/api/v1/organizations/${foreignOrganizationId}/projects/${foreignProjectId}`;
    const foreignHeaders = { authorization: ['Bearer', foreignOwnerToken].join(' ') };
    const foreignInspectionResponse = await app.inject({
      method: 'POST',
      url: `${foreignBase}/quality-inspections`,
      headers: foreignHeaders,
      payload: { inspectionType: 'Foreign quality inspection' },
    });
    expect(foreignInspectionResponse.statusCode).toBe(201);
    const foreignInspectionId = foreignInspectionResponse.json<
      ApiSuccessResponse<{ inspection: { id: string } }>
    >().data.inspection.id;
    const foreignDeficiencyResponse = await app.inject({
      method: 'POST',
      url: `${foreignBase}/quality-deficiencies`,
      headers: foreignHeaders,
      payload: { inspectionId: foreignInspectionId, title: 'Foreign quality deficiency' },
    });
    expect(foreignDeficiencyResponse.statusCode).toBe(201);
    const foreignDeficiencyId = foreignDeficiencyResponse.json<
      ApiSuccessResponse<{ deficiency: { id: string } }>
    >().data.deficiency.id;
    const foreignActionResponse = await app.inject({
      method: 'POST',
      url: `${foreignBase}/corrective-actions`,
      headers: foreignHeaders,
      payload: {
        sourceType: 'QUALITY_DEFICIENCY',
        sourceId: foreignDeficiencyId,
        title: 'Foreign corrective action',
      },
    });
    expect(foreignActionResponse.statusCode).toBe(201);
    const foreignActionId = foreignActionResponse.json<
      ApiSuccessResponse<{ action: { id: string } }>
    >().data.action.id;
    const foreignEventResponse = await app.inject({
      method: 'POST',
      url: `${foreignBase}/safety-events`,
      headers: foreignHeaders,
      payload: {
        eventType: 'INCIDENT',
        title: 'Foreign safety event',
        description: 'A safety event in another organization.',
        occurredAt: new Date().toISOString(),
      },
    });
    expect(foreignEventResponse.statusCode).toBe(201);
    const foreignEventId = foreignEventResponse.json<
      ApiSuccessResponse<{ event: { id: string } }>
    >().data.event.id;
    const foreignMeetingResponse = await app.inject({
      method: 'POST',
      url: `${foreignBase}/safety-meetings`,
      headers: foreignHeaders,
      payload: {
        meetingType: 'Toolbox Talk',
        title: 'Foreign safety meeting',
        scheduledAt: new Date().toISOString(),
      },
    });
    expect(foreignMeetingResponse.statusCode).toBe(201);
    const foreignMeetingId = foreignMeetingResponse.json<
      ApiSuccessResponse<{ meeting: { id: string } }>
    >().data.meeting.id;

    const foreignListChecks = [
      { path: 'quality-inspections', id: foreignInspectionId },
      { path: 'quality-deficiencies', id: foreignDeficiencyId },
      { path: 'corrective-actions', id: foreignActionId },
      { path: 'safety-events', id: foreignEventId },
      { path: 'safety-meetings', id: foreignMeetingId },
    ];
    for (const resource of foreignListChecks) {
      const scopedList = await app.inject({
        method: 'GET',
        url: `${root}/${resource.path}?limit=100`,
        headers: headers(),
      });
      expect(scopedList.statusCode).toBe(200);
      expect(scopedList.body).not.toContain(resource.id);
    }

    const daysAhead = 20;
    const expiryDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const permitId = crypto.randomUUID();
    await getDb().insert(permits).values({
      id: permitId,
      organizationId,
      projectId,
      permitType: 'Active building permit',
      status: 'ACTIVE',
      expiryDate,
    });
    const recordId = crypto.randomUUID();
    await getDb().insert(complianceRecords).values({
      id: recordId,
      organizationId,
      projectId,
      requirementType: 'Insurance certificate',
      status: 'ACTIVE',
      expiryDate,
    });
    const expiringDocumentId = await createExpiringDocument(expiryDate);
    const concurrentScans = await Promise.all([
      expiryScannerService.scan(daysAhead),
      expiryScannerService.scan(daysAhead),
    ]);
    expect(concurrentScans.reduce((total, count) => total + count, 0)).toBeGreaterThanOrEqual(3);
    expect(await expiryScannerService.scan(daysAhead)).toBe(0);
    const expiringResponse = await app.inject({
      method: 'GET',
      url: `${root}/expiring?days=${daysAhead}`,
      headers: headers(),
    });
    expect(expiringResponse.statusCode).toBe(200);
    const expiring = expiringResponse.json<ApiSuccessResponse<{
      items: Array<{ entityType: string; entityId: string }>;
      total: number;
    }>>().data;
    expect(expiring.total).toBe(3);
    expect(expiring.items.map(({ entityType, entityId }) => `${entityType}:${entityId}`).sort())
      .toEqual([
        `compliance_record:${recordId}`,
        `document:${expiringDocumentId}`,
        `permit:${permitId}`,
      ].sort());

    const expiryEventTypes = ['document.expiring', 'permit.expiring', 'compliance_record.expiring'];
    const expiryEvents = await getDb().select().from(outboxEvents).where(and(
      eq(outboxEvents.organizationId, organizationId),
      inArray(outboxEvents.eventType, expiryEventTypes),
    ));
    expect(expiryEvents.length).toBeGreaterThanOrEqual(3);
    for (const entityId of [permitId, recordId, expiringDocumentId]) {
      expect(expiryEvents.filter((entry) =>
        JSON.stringify(entry.payload).includes(entityId),
      )).toHaveLength(1);
    }
    expect(expiryEvents.every((entry) => JSON.stringify(entry.payload).includes(organizationId))).toBe(true);

    const updatedPermit = await app.inject({
      method: 'PATCH',
      url: `${root}/permits/${permitId}`,
      headers: headers(),
      payload: { expiryDate: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10) },
    });
    expect(updatedPermit.statusCode).toBe(200);
    const permitRow = await getDb().select().from(permits).where(eq(permits.id, permitId));
    expect(permitRow[0]?.expiresNotified).toBe(false);

    const updatedRecord = await app.inject({
      method: 'PATCH',
      url: `${root}/compliance-records/${recordId}`,
      headers: headers(),
      payload: { expiryDate: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10) },
    });
    expect(updatedRecord.statusCode).toBe(200);
    const recordRow = await getDb().select().from(complianceRecords).where(eq(complianceRecords.id, recordId));
    expect(recordRow[0]?.expiresNotified).toBe(false);

    const updatedDocument = await app.inject({
      method: 'PATCH',
      url: `${root}/documents/${expiringDocumentId}`,
      headers: headers(),
      payload: { expiryDate: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10) },
    });
    expect(updatedDocument.statusCode).toBe(200);
    const documentRow = await getDb().select().from(documents).where(eq(documents.id, expiringDocumentId));
    expect(documentRow[0]?.expiresNotified).toBe(false);
  }, 60000);
});
