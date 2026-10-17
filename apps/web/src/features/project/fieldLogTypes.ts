/**
 * fieldLogTypes.ts — mirrors server DTOs exactly.
 *
 * Sources:
 *   FieldLogDTO           → field-log/field-log.types.ts
 *   FieldLogTaskEntryDTO  → field-log/field-log.types.ts
 *   FieldLogAmendmentDTO  → field-log/field-log-amendment.types.ts
 *   Validation            → @siteflow/shared field-log.schema.ts
 *
 * State machine:  DRAFT ──submit──► SUBMITTED ──lock──► LOCKED
 *
 * Key rules:
 *   - Edit (PATCH) only on DRAFT → 422 FIELD_LOG_IMMUTABLE
 *   - Submit only from DRAFT     → 422 FIELD_LOG_INVALID_TRANSITION
 *   - Lock only from SUBMITTED   → same
 *   - Amendments only on LOCKED  → 422 AMENDMENT_NOT_ALLOWED
 *   - One log per project per date → 409 FIELD_LOG_DUPLICATE_DATE
 *   - listFieldLogs returns entries: undefined (entries only on getFieldLog)
 */

export type FieldLogStatus = 'DRAFT' | 'SUBMITTED' | 'LOCKED';

export interface FieldLogTaskEntryDTO {
  id: string;
  logId: string;
  taskId: string;
  completionPctRecorded: number;  // int 0–100
  quantityCompleted: string | null; // positive decimal string
  unit: string | null;              // max 50
  notes: string | null;             // max 2000
}

export interface FieldLogDTO {
  id: string;
  organizationId: string;
  projectId: string;
  logDate: string;            // YYYY-MM-DD
  supervisorId: string;       // userId of creator
  status: FieldLogStatus;
  notes: string | null;       // max 4000
  lockedAt: string | null;    // ISO timestamp, only when LOCKED
  createdAt: string;
  entries?: FieldLogTaskEntryDTO[]; // only present on getFieldLog
}

export interface FieldLogAmendmentDTO {
  id: string;
  logId: string;
  organizationId: string;
  projectId: string;
  requestedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  reason: string;                      // 1–2000 chars
  correction: Record<string, unknown>; // non-empty object
  createdAt: string;
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface FieldLogEntryInput {
  taskId: string;
  completionPctRecorded: number; // int 0–100
  quantityCompleted?: number;    // positive (coerced to string on server)
  unit?: string;                 // max 50
  notes?: string;                // max 2000
}

export interface CreateFieldLogInput {
  logDate: string;              // YYYY-MM-DD
  notes?: string;               // max 4000
  entries?: FieldLogEntryInput[];
}

export interface UpdateFieldLogInput {
  notes?: string;
  entries?: FieldLogEntryInput[];
}

export interface CreateAmendmentInput {
  reason: string;                      // 1–2000 chars
  correction: Record<string, unknown>; // non-empty
}
