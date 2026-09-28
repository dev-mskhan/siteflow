// apps/server/src/modules/project/calendar/calendar.repository.ts
import { eq, and, asc } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import {
  projectCalendars,
  calendarExceptions,
  type ProjectCalendar,
  type CalendarException,
  type WorkDaysConfig,
} from '@siteflow/database/schema';

export const DEFAULT_WORK_DAYS: WorkDaysConfig = {
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: false,
  sunday: false,
};

export class CalendarRepository {
  private get db() {
    return getDb();
  }

  async getOrCreateForProject(
    orgId: string,
    projectId: string,
    tx?: any,
  ): Promise<{ calendar: ProjectCalendar; exceptions: CalendarException[] }> {
    const db = tx ?? this.db;

    const result = await db
      .select()
      .from(projectCalendars)
      .where(
        and(
          eq(projectCalendars.projectId, projectId),
          eq(projectCalendars.organizationId, orgId),
        ),
      )
      .limit(1);

    let calendar = result[0];

    if (!calendar) {
      const calId = generateId();
      const inserted = await db
        .insert(projectCalendars)
        .values({
          id: calId,
          organizationId: orgId,
          projectId,
          name: 'Standard Construction Calendar',
          timezone: 'UTC',
          workDays: DEFAULT_WORK_DAYS,
          hoursPerDay: '8.00',
        })
        .returning();
      calendar = inserted[0]!;
    }

    const exceptions = await db
      .select()
      .from(calendarExceptions)
      .where(eq(calendarExceptions.calendarId, calendar.id))
      .orderBy(asc(calendarExceptions.exceptionDate));

    return { calendar, exceptions };
  }

  async update(
    tx: any,
    orgId: string,
    projectId: string,
    patch: Partial<ProjectCalendar>,
  ): Promise<ProjectCalendar> {
    const db = tx ?? this.db;

    const result = await db
      .update(projectCalendars)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projectCalendars.projectId, projectId),
          eq(projectCalendars.organizationId, orgId),
        ),
      )
      .returning();

    return result[0]!;
  }

  async addException(
    tx: any,
    calendarId: string,
    exceptionDate: string,
    isWorkingDay: boolean,
    name: string,
  ): Promise<CalendarException> {
    const db = tx ?? this.db;
    const id = generateId();

    const result = await db
      .insert(calendarExceptions)
      .values({
        id,
        calendarId,
        exceptionDate,
        isWorkingDay,
        name,
      })
      .returning();

    return result[0]!;
  }

  async removeException(tx: any, calendarId: string, exceptionId: string): Promise<void> {
    const db = tx ?? this.db;
    await db
      .delete(calendarExceptions)
      .where(
        and(
          eq(calendarExceptions.id, exceptionId),
          eq(calendarExceptions.calendarId, calendarId),
        ),
      );
  }
}
