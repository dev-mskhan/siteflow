// apps/server/src/modules/project/calendar/calendar.service.ts
import { withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
import { getDb } from '../../../lib/db/index.js';
import { auditService } from '../../audit/audit.service.js';
import { CalendarRepository } from './calendar.repository.js';
import {
  DuplicateCalendarExceptionError,
  CalendarExceptionNotFoundError,
  InvalidCalendarConfigError,
} from './calendar.errors.js';
import type {
  ProjectCalendarDTO,
  UpdateCalendarInput,
  AddCalendarExceptionInput,
} from './calendar.types.js';
import type { ProjectCalendar, CalendarException, WorkDaysConfig } from '@siteflow/database/schema';

const tracer = trace.getTracer('calendar-service');

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export class CalendarService {
  constructor(private calendarRepo = new CalendarRepository()) {}

  private get db() {
    return getDb();
  }

  // ── 1. Pure Calendar Working Day Math ────────────────────────────────────────

  /**
   * Checks if a date (YYYY-MM-DD) is a working day based on calendar config & exceptions.
   */
  isWorkingDay(
    dateStr: string,
    workDays: WorkDaysConfig,
    exceptionsMap: Map<string, boolean>,
  ): boolean {
    if (exceptionsMap.has(dateStr)) {
      return exceptionsMap.get(dateStr)!;
    }
    const dateObj = new Date(`${dateStr}T00:00:00Z`);
    const dayName = DAY_NAMES[dateObj.getUTCDay()]!;
    return Boolean(workDays[dayName]);
  }

  /**
   * Returns the next working date on or after `dateStr`.
   */
  nextWorkingDate(
    dateStr: string,
    workDays: WorkDaysConfig,
    exceptionsMap: Map<string, boolean>,
  ): string {
    let curr = new Date(`${dateStr}T00:00:00Z`);
    while (true) {
      const iso = curr.toISOString().split('T')[0]!;
      if (this.isWorkingDay(iso, workDays, exceptionsMap)) {
        return iso;
      }
      curr.setUTCDate(curr.getUTCDate() + 1);
    }
  }

  /**
   * Returns the previous working date on or before `dateStr`.
   */
  previousWorkingDate(
    dateStr: string,
    workDays: WorkDaysConfig,
    exceptionsMap: Map<string, boolean>,
  ): string {
    let curr = new Date(`${dateStr}T00:00:00Z`);
    while (true) {
      const iso = curr.toISOString().split('T')[0]!;
      if (this.isWorkingDay(iso, workDays, exceptionsMap)) {
        return iso;
      }
      curr.setUTCDate(curr.getUTCDate() - 1);
    }
  }

  /**
   * Adds `days` working days to `startDateStr`.
   */
  addWorkingDays(
    startDateStr: string,
    days: number,
    workDays: WorkDaysConfig,
    exceptionsMap: Map<string, boolean>,
  ): string {
    if (days <= 0) return startDateStr;

    let curr = new Date(`${startDateStr}T00:00:00Z`);

    // Ensure start date is on a working day
    let startIso = curr.toISOString().split('T')[0]!;
    if (!this.isWorkingDay(startIso, workDays, exceptionsMap)) {
      startIso = this.nextWorkingDate(startIso, workDays, exceptionsMap);
      curr = new Date(`${startIso}T00:00:00Z`);
    }

    let added = 0;
    // 1-day task starting on Monday finishes Monday. 2-day finishes Tuesday.
    while (added < days - 1) {
      curr.setUTCDate(curr.getUTCDate() + 1);
      const iso = curr.toISOString().split('T')[0]!;
      if (this.isWorkingDay(iso, workDays, exceptionsMap)) {
        added++;
      }
    }

    return curr.toISOString().split('T')[0]!;
  }

  /**
   * Subtracts `days` working days from `endDateStr`.
   */
  subtractWorkingDays(
    endDateStr: string,
    days: number,
    workDays: WorkDaysConfig,
    exceptionsMap: Map<string, boolean>,
  ): string {
    if (days <= 0) return endDateStr;

    let curr = new Date(`${endDateStr}T00:00:00Z`);

    let endIso = curr.toISOString().split('T')[0]!;
    if (!this.isWorkingDay(endIso, workDays, exceptionsMap)) {
      endIso = this.previousWorkingDate(endIso, workDays, exceptionsMap);
      curr = new Date(`${endIso}T00:00:00Z`);
    }

    let subtracted = 0;
    while (subtracted < days - 1) {
      curr.setUTCDate(curr.getUTCDate() - 1);
      const iso = curr.toISOString().split('T')[0]!;
      if (this.isWorkingDay(iso, workDays, exceptionsMap)) {
        subtracted++;
      }
    }

    return curr.toISOString().split('T')[0]!;
  }

  /**
   * Calculates working days count between `startDateStr` and `finishDateStr` (inclusive).
   */
  calculateWorkingDuration(
    startDateStr: string,
    finishDateStr: string,
    workDays: WorkDaysConfig,
    exceptionsMap: Map<string, boolean>,
  ): number {
    if (startDateStr > finishDateStr) return 0;

    const start = new Date(`${startDateStr}T00:00:00Z`);
    const finish = new Date(`${finishDateStr}T00:00:00Z`);
    const curr = new Date(start);

    let duration = 0;
    while (curr <= finish) {
      const iso = curr.toISOString().split('T')[0]!;
      if (this.isWorkingDay(iso, workDays, exceptionsMap)) {
        duration++;
      }
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    return duration;
  }

  // ── 2. CRUD Operations ───────────────────────────────────────────────────────

  async getCalendar(orgId: string, projectId: string): Promise<ProjectCalendarDTO> {
    return withSpan(tracer, 'calendar.getCalendar', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);

      const { calendar, exceptions } = await this.calendarRepo.getOrCreateForProject(
        orgId,
        projectId,
      );

      return this.toCalendarDTO(calendar, exceptions);
    });
  }

  async updateCalendar(
    actorUserId: string,
    orgId: string,
    projectId: string,
    input: UpdateCalendarInput,
  ): Promise<ProjectCalendarDTO> {
    return withSpan(tracer, 'calendar.updateCalendar', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);

      const { calendar } = await this.calendarRepo.getOrCreateForProject(orgId, projectId);

      if (input.hoursPerDay !== undefined && (input.hoursPerDay <= 0 || input.hoursPerDay > 24)) {
        throw new InvalidCalendarConfigError('hoursPerDay must be between 0 and 24');
      }

      const patch: Partial<ProjectCalendar> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.timezone !== undefined) patch.timezone = input.timezone;
      if (input.workDays !== undefined) patch.workDays = input.workDays;
      if (input.hoursPerDay !== undefined) patch.hoursPerDay = input.hoursPerDay.toString();

      const updated = await this.db.transaction(async (tx) => {
        const cal = await this.calendarRepo.update(tx, orgId, projectId, patch);
        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'calendar.updated',
            resourceType: 'ProjectCalendar',
            resourceId: calendar.id,
            metadata: { projectId, patch },
          },
          tx,
        );
        return cal;
      });

      const { exceptions } = await this.calendarRepo.getOrCreateForProject(orgId, projectId);
      return this.toCalendarDTO(updated, exceptions);
    });
  }

  async addException(
    actorUserId: string,
    orgId: string,
    projectId: string,
    input: AddCalendarExceptionInput,
  ): Promise<ProjectCalendarDTO> {
    return withSpan(tracer, 'calendar.addException', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);

      const { calendar, exceptions } = await this.calendarRepo.getOrCreateForProject(
        orgId,
        projectId,
      );

      const existing = exceptions.find((e) => e.exceptionDate === input.exceptionDate);
      if (existing) {
        throw new DuplicateCalendarExceptionError();
      }

      await this.db.transaction(async (tx) => {
        await this.calendarRepo.addException(
          tx,
          calendar.id,
          input.exceptionDate,
          input.isWorkingDay,
          input.name,
        );
        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'calendar.exception_added',
            resourceType: 'CalendarException',
            resourceId: calendar.id,
            metadata: { projectId, exceptionDate: input.exceptionDate },
          },
          tx,
        );
      });

      const updated = await this.calendarRepo.getOrCreateForProject(orgId, projectId);
      return this.toCalendarDTO(updated.calendar, updated.exceptions);
    });
  }

  async removeException(
    actorUserId: string,
    orgId: string,
    projectId: string,
    exceptionId: string,
  ): Promise<ProjectCalendarDTO> {
    return withSpan(tracer, 'calendar.removeException', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);

      const { calendar, exceptions } = await this.calendarRepo.getOrCreateForProject(
        orgId,
        projectId,
      );

      const existing = exceptions.find((e) => e.id === exceptionId);
      if (!existing) {
        throw new CalendarExceptionNotFoundError();
      }

      await this.db.transaction(async (tx) => {
        await this.calendarRepo.removeException(tx, calendar.id, exceptionId);
        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'calendar.exception_removed',
            resourceType: 'CalendarException',
            resourceId: exceptionId,
            metadata: { projectId, calendarId: calendar.id },
          },
          tx,
        );
      });

      const updated = await this.calendarRepo.getOrCreateForProject(orgId, projectId);
      return this.toCalendarDTO(updated.calendar, updated.exceptions);
    });
  }

  private toCalendarDTO(
    calendar: ProjectCalendar,
    exceptions: CalendarException[],
  ): ProjectCalendarDTO {
    return {
      id: calendar.id,
      organizationId: calendar.organizationId,
      projectId: calendar.projectId,
      name: calendar.name,
      timezone: calendar.timezone,
      workDays: calendar.workDays,
      hoursPerDay: Number(calendar.hoursPerDay),
      exceptions: exceptions.map((e) => ({
        id: e.id,
        calendarId: e.calendarId,
        exceptionDate: e.exceptionDate,
        isWorkingDay: e.isWorkingDay,
        name: e.name,
      })),
      createdAt: calendar.createdAt.toISOString(),
      updatedAt: calendar.updatedAt.toISOString(),
    };
  }
}
