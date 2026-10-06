import { trace } from '@opentelemetry/api';
import { withSpan } from '@siteflow/observability/server';
import {
  financialAuditEvents,
  type FinancialAuditEvent,
  type NewFinancialAuditEvent,
} from '@siteflow/database/schema';
import type { DatabaseTransaction } from '@siteflow/database';
import { generateId } from '../id.js';
import type { FinancialAuditAction } from './financial-audit.types.js';
import { formatMoney, normalizeCurrencyCode, parseMoney } from './money.js';
import { InvalidFinancialAuditEventError } from './commercial.errors.js';

const tracer = trace.getTracer('financial-audit-service');

export interface WriteFinancialAuditEventInput {
  organizationId: string;
  projectId: string;
  actorUserId: string;
  action: FinancialAuditAction;
  entityType: string;
  entityId: string;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  amount?: string | null;
  currencyCode?: string | null;
  reason?: string | null;
  requestId: string;
}

export async function writeFinancialAuditEvent(
  tx: DatabaseTransaction,
  input: WriteFinancialAuditEventInput,
): Promise<FinancialAuditEvent> {
  if (
    input.organizationId.length === 0 ||
    input.projectId.length === 0 ||
    input.actorUserId.length === 0 ||
    input.entityType.length === 0 ||
    input.entityId.length === 0 ||
    input.requestId.length === 0
  ) {
    throw new InvalidFinancialAuditEventError();
  }

  return withSpan(tracer, 'financial-audit.write', async (span) => {
    span.setAttributes({
      'organization.id': input.organizationId,
      'project.id': input.projectId,
      'financial.action': input.action,
      'financial.entity.type': input.entityType,
    });

    const entry: Omit<NewFinancialAuditEvent, 'id' | 'createdAt'> = {
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      previousState: input.previousState ?? null,
      newState: input.newState ?? null,
      amount:
        input.amount === undefined || input.amount === null
          ? null
          : formatMoney(parseMoney(input.amount)),
      currencyCode: input.currencyCode == null ? null : normalizeCurrencyCode(input.currencyCode),
      reason: input.reason ?? null,
      requestId: input.requestId,
    };

    const inserted = await tx
      .insert(financialAuditEvents)
      .values({ id: generateId(), ...entry })
      .returning();
    return inserted[0]!;
  });
}
