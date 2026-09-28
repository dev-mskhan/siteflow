// apps/server/tests/integration/calendar_core.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import type { ProjectDTO } from '../../src/modules/project/core/project.types.js';
import type { ProjectCalendarDTO } from '../../src/modules/project/calendar/calendar.types.js';
import { CalendarService } from '../../src/modules/project/calendar/calendar.service.js';
import { createVerifiedUser, createOrgWithAdmin } from '../helpers/fixtures.js';

describe('Project Schedule Calendar Module (Integration)', () => {
  let app: FastifyInstance;
  let authToken: string;
  let ownerUserId: string;
  let orgId: string;
  let projectId: string;

  const runId = Math.random().toString(36).substring(7);
  const calendarService = new CalendarService();

  beforeAll(async () => {
    app = await createTestApp();

    const ownerResult = await createVerifiedUser({ email: `cal_owner_${runId}@example.com` });
    ownerUserId = ownerResult.user.id;
    authToken = ownerResult.token;

    const orgResult = await createOrgWithAdmin(app, authToken, `Calendar Test Org ${runId}`);
    orgId = orgResult.orgId;

    const createProjectRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: `Calendar Test Project ${runId}`,
        currency: 'USD',
      },
    });
    expect(createProjectRes.statusCode).toBe(201);
    const projBody = createProjectRes.json<ApiSuccessResponse<{ project: ProjectDTO }>>();
    projectId = projBody.data.project.id;
  });

  afterAll(async () => {
    await app.close();
  });

  let createdExceptionId: string;

  it('1. GET /calendar — should return default standard construction calendar (Mon-Fri working)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/calendar`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<ProjectCalendarDTO>>();
    expect(body.success).toBe(true);
    expect(body.data.workDays.monday).toBe(true);
    expect(body.data.workDays.friday).toBe(true);
    expect(body.data.workDays.saturday).toBe(false);
    expect(body.data.workDays.sunday).toBe(false);
    expect(body.data.hoursPerDay).toBe(8);
  });

  it('2. PATCH /calendar — should update working days configuration', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/calendar`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Custom 6-Day Site Calendar',
        hoursPerDay: 9,
        workDays: {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: true, // Working saturday
          sunday: false,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<ProjectCalendarDTO>>();
    expect(body.data.name).toBe('Custom 6-Day Site Calendar');
    expect(body.data.hoursPerDay).toBe(9);
    expect(body.data.workDays.saturday).toBe(true);
  });

  it('3. POST /calendar/exceptions — should add a holiday exception date', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/calendar/exceptions`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        exceptionDate: '2026-12-25',
        isWorkingDay: false,
        name: 'Christmas Holiday',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<ApiSuccessResponse<ProjectCalendarDTO>>();
    expect(body.data.exceptions.length).toBe(1);
    expect(body.data.exceptions[0]!.exceptionDate).toBe('2026-12-25');
    expect(body.data.exceptions[0]!.isWorkingDay).toBe(false);
    createdExceptionId = body.data.exceptions[0]!.id;
  });

  it('4. Working Day Math — Friday + 2 days on Mon-Fri calendar must land on Tuesday (not Sunday)', () => {
    const workDays = {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    };
    const exceptions = new Map<string, boolean>();

    // Oct 02 2026 is a Friday.
    // Friday (day 1) + 1 working day (Monday Oct 05) = Oct 05 (2 days total).
    // Adding 2 working days starting Friday Oct 02 -> Friday (1), Monday Oct 05 (2).
    const finishDate = calendarService.addWorkingDays('2026-10-02', 2, workDays, exceptions);
    expect(finishDate).toBe('2026-10-05'); // Monday Oct 5th!

    const finish3 = calendarService.addWorkingDays('2026-10-02', 3, workDays, exceptions);
    expect(finish3).toBe('2026-10-06'); // Tuesday Oct 6th!

    const duration = calendarService.calculateWorkingDuration('2026-10-02', '2026-10-06', workDays, exceptions);
    expect(duration).toBe(3); // Friday, Monday, Tuesday = 3 days
  });

  it('5. DELETE /calendar/exceptions/:id — should remove an exception date', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/calendar/exceptions/${createdExceptionId}`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<ProjectCalendarDTO>>();
    expect(body.data.exceptions.length).toBe(0);
  });
});
