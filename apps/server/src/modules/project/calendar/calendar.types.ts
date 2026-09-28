// apps/server/src/modules/project/calendar/calendar.types.ts
import type { WorkDaysConfig } from '@siteflow/database/schema';

export interface ProjectCalendarDTO {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  timezone: string;
  workDays: WorkDaysConfig;
  hoursPerDay: number;
  exceptions: CalendarExceptionDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface CalendarExceptionDTO {
  id: string;
  calendarId: string;
  exceptionDate: string;
  isWorkingDay: boolean;
  name: string;
}

export interface UpdateCalendarInput {
  name?: string;
  timezone?: string;
  workDays?: WorkDaysConfig;
  hoursPerDay?: number;
}

export interface AddCalendarExceptionInput {
  exceptionDate: string; // YYYY-MM-DD
  isWorkingDay: boolean;
  name: string;
}
