// apps/server/src/modules/project/calendar/calendar.errors.ts
import { NotFoundError, ConflictError, ValidationError } from '../../auth/auth.errors.js';

export class CalendarNotFoundError extends NotFoundError {
  override code = 'CALENDAR_NOT_FOUND';
  constructor(message = 'Project calendar not found') {
    super(message);
    this.name = 'CalendarNotFoundError';
  }
}

export class CalendarExceptionNotFoundError extends NotFoundError {
  override code = 'CALENDAR_EXCEPTION_NOT_FOUND';
  constructor(message = 'Calendar exception not found') {
    super(message);
    this.name = 'CalendarExceptionNotFoundError';
  }
}

export class DuplicateCalendarExceptionError extends ConflictError {
  override code = 'DUPLICATE_CALENDAR_EXCEPTION';
  constructor(message = 'Exception date already exists for this calendar') {
    super(message);
    this.name = 'DuplicateCalendarExceptionError';
  }
}

export class InvalidCalendarConfigError extends ValidationError {
  override code = 'INVALID_CALENDAR_CONFIG';
  constructor(message = 'Invalid working calendar configuration') {
    super(message);
    this.name = 'InvalidCalendarConfigError';
  }
}
