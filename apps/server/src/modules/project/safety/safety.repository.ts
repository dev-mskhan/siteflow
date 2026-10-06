import { and, desc, eq, lt, or } from 'drizzle-orm';
import {
  safetyEvents,
  safetyMeetings,
  type SafetyEvent,
  type SafetyMeeting,
} from '@siteflow/database/schema';
import { SafetyInvalidCursorError } from './safety.errors.js';

function decodeCursor(cursor?: string): { createdAt: Date; id: string } | undefined {
  if (!cursor) return undefined;
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error('Invalid cursor encoding');
    const decoded: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      decoded === null
      || typeof decoded !== 'object'
      || !('createdAt' in decoded)
      || !('id' in decoded)
      || typeof decoded.createdAt !== 'string'
      || typeof decoded.id !== 'string'
      || decoded.id.length === 0
    ) throw new Error('Invalid cursor payload');
    const createdAt = new Date(decoded.createdAt);
    if (Number.isNaN(createdAt.valueOf())) throw new Error('Invalid cursor timestamp');
    return { createdAt, id: decoded.id };
  } catch {
    throw new SafetyInvalidCursorError();
  }
}

export function encodeSafetyCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(JSON.stringify({
    createdAt: row.createdAt.toISOString(),
    id: row.id,
  })).toString('base64url');
}

export class SafetyRepository {
  async createEvent(tx: any, input: Record<string, unknown>): Promise<SafetyEvent> {
    const [row] = await tx.insert(safetyEvents).values(input).returning();
    return row;
  }

  async createMeeting(tx: any, input: Record<string, unknown>): Promise<SafetyMeeting> {
    const [row] = await tx.insert(safetyMeetings).values(input).returning();
    return row;
  }

  async findEvent(
    db: any,
    organizationId: string,
    projectId: string,
    id: string,
  ): Promise<SafetyEvent | undefined> {
    const [row] = await db.select().from(safetyEvents).where(and(
      eq(safetyEvents.id, id),
      eq(safetyEvents.organizationId, organizationId),
      eq(safetyEvents.projectId, projectId),
    )).limit(1);
    return row;
  }

  async findEventForUpdate(
    tx: any,
    organizationId: string,
    projectId: string,
    id: string,
  ): Promise<SafetyEvent | undefined> {
    const [row] = await tx.select().from(safetyEvents).where(and(
      eq(safetyEvents.id, id),
      eq(safetyEvents.organizationId, organizationId),
      eq(safetyEvents.projectId, projectId),
    )).limit(1).for('update');
    return row;
  }

  async updateEvent(
    tx: any,
    organizationId: string,
    projectId: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<SafetyEvent | undefined> {
    const [row] = await tx.update(safetyEvents).set(patch).where(and(
      eq(safetyEvents.id, id),
      eq(safetyEvents.organizationId, organizationId),
      eq(safetyEvents.projectId, projectId),
    )).returning();
    return row;
  }

  async findMeeting(
    db: any,
    organizationId: string,
    projectId: string,
    id: string,
  ): Promise<SafetyMeeting | undefined> {
    const [row] = await db.select().from(safetyMeetings).where(and(
      eq(safetyMeetings.id, id),
      eq(safetyMeetings.organizationId, organizationId),
      eq(safetyMeetings.projectId, projectId),
    )).limit(1);
    return row;
  }

  async listEvents(
    db: any,
    organizationId: string,
    projectId: string,
    options: {
      cursor?: string;
      limit: number;
      status?: SafetyEvent['status'];
      eventType?: SafetyEvent['eventType'];
      severity?: SafetyEvent['severity'];
    },
  ): Promise<SafetyEvent[]> {
    const filters = [
      eq(safetyEvents.organizationId, organizationId),
      eq(safetyEvents.projectId, projectId),
    ];
    if (options.status) filters.push(eq(safetyEvents.status, options.status));
    if (options.eventType) filters.push(eq(safetyEvents.eventType, options.eventType));
    if (options.severity) filters.push(eq(safetyEvents.severity, options.severity));
    const cursor = decodeCursor(options.cursor);
    if (cursor) {
      filters.push(or(
        lt(safetyEvents.createdAt, cursor.createdAt),
        and(
          eq(safetyEvents.createdAt, cursor.createdAt),
          lt(safetyEvents.id, cursor.id),
        ),
      )!);
    }
    return db.select().from(safetyEvents).where(and(...filters))
      .orderBy(desc(safetyEvents.createdAt), desc(safetyEvents.id))
      .limit(options.limit + 1);
  }

  async listMeetings(
    db: any,
    organizationId: string,
    projectId: string,
    options: { cursor?: string; limit: number },
  ): Promise<SafetyMeeting[]> {
    const filters = [
      eq(safetyMeetings.organizationId, organizationId),
      eq(safetyMeetings.projectId, projectId),
    ];
    const cursor = decodeCursor(options.cursor);
    if (cursor) {
      filters.push(or(
        lt(safetyMeetings.createdAt, cursor.createdAt),
        and(
          eq(safetyMeetings.createdAt, cursor.createdAt),
          lt(safetyMeetings.id, cursor.id),
        ),
      )!);
    }
    return db.select().from(safetyMeetings).where(and(...filters))
      .orderBy(desc(safetyMeetings.createdAt), desc(safetyMeetings.id))
      .limit(options.limit + 1);
  }
}
