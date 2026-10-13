import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { Decimal } from 'decimal.js';
import { projects, type boqs } from '@siteflow/database/schema';
import type { DatabaseTransaction } from '@siteflow/database';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { assertFinancialActorSeparation } from '../../../lib/commercial/financial-policy.js';
import { FINANCIAL_AUDIT_ACTIONS } from '../../../lib/commercial/financial-audit.types.js';
import { writeFinancialAuditEvent } from '../../../lib/commercial/financial-audit.service.js';
import {
  escapeCsvCell,
  validateBoqCsv,
  type BoqCsvError,
  type BoqCsvRow,
} from './boq.csv.js';
import {
  BoqConflictError,
  BoqImportRejectedError,
  BoqNotFoundError,
  BoqValidationError,
  BoqVersionConflictError,
} from './boq.errors.js';
import { projectBoqRepository as repository } from './boq.repository.js';
import type {
  BoqImportCommitInput,
  BoqImportPreviewInput,
  BoqItemMappingInput,
  CreateBoqInput,
  ReviseBoqInput,
} from './boq.schemas.js';

type BoqScope = { organizationId: string; projectId: string };
type BoqDb = DatabaseTransaction | ReturnType<typeof getDb>;
type Cursor<T> = { decoded: T } | undefined;

const MAX_LINE_AMOUNT = new Decimal('9999999999999.99');
const EXPORT_HEADERS = [
  'item_key',
  'section_key',
  'description',
  'specification',
  'unit',
  'quantity',
  'unit_rate',
  'currency',
  'cost_code',
];

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function encodeCursor(payload: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor<T>(cursor: string | undefined, parse: (raw: Record<string, unknown>) => T): Cursor<T> {
  if (!cursor) return undefined;
  try {
    return { decoded: parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))) };
  } catch {
    throw new BoqValidationError('Invalid pagination cursor.');
  }
}

function computeLineAmounts(rows: BoqCsvRow[]) {
  const errors: BoqCsvError[] = [];
  const amounts = new Map<number, string>();
  for (const row of rows) {
    const amount = new Decimal(row.quantity)
      .mul(row.unitRate)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    if (amount.gt(MAX_LINE_AMOUNT)) {
      errors.push({
        row: row.row,
        column: 'unit_rate',
        message: 'Line amount exceeds the supported maximum.',
      });
      continue;
    }
    amounts.set(row.row, amount.toFixed(2));
  }
  return { errors, amounts };
}

export class ProjectBoqService {
  private get db() {
    return getDb();
  }

  private async resolveCostCodes(tx: BoqDb, scope: BoqScope, rows: BoqCsvRow[]) {
    const codes = [
      ...new Set(
        rows
          .map((row) => row.costCode)
          .filter((code): code is string => Boolean(code))
          .map((code) => code.toUpperCase()),
      ),
    ];
    const found = await repository.findCostCodesByCodes(
      tx,
      scope.organizationId,
      scope.projectId,
      codes,
    );
    const byCode = new Map(found.map((row) => [row.code.toUpperCase(), row.id]));
    const errors: BoqCsvError[] = rows
      .filter((row) => row.costCode && !byCode.has(row.costCode.toUpperCase()))
      .map((row) => ({
        row: row.row,
        column: 'cost_code',
        message: `Cost code ${row.costCode} is not an active cost code for this project.`,
      }));
    return { byCode, errors };
  }

  private async getBoqRecord(tx: BoqDb, scope: BoqScope, boqId: string) {
    const boq = await repository.findBoq(tx, scope.organizationId, scope.projectId, boqId);
    if (!boq) throw new BoqNotFoundError();
    return boq;
  }

  private async currentRevision(tx: BoqDb, scope: BoqScope, boqId: string) {
    const [revision] = await repository.findRevisionsByBoq(
      tx,
      scope.organizationId,
      scope.projectId,
      boqId,
      { limit: 1 },
    );
    if (!revision) throw new BoqNotFoundError();
    return revision;
  }

  private async lockCurrent(
    tx: DatabaseTransaction,
    scope: BoqScope,
    boqId: string,
    expectedVersion: number,
    allowedStatuses: string[],
  ) {
    const boq = await repository.findBoq(tx, scope.organizationId, scope.projectId, boqId, true);
    if (!boq) throw new BoqNotFoundError();
    if (boq.version !== expectedVersion) throw new BoqVersionConflictError();
    if (!allowedStatuses.includes(boq.status)) {
      throw new BoqConflictError(`This action is not allowed while the BOQ is ${boq.status}.`);
    }
    const revision = await this.currentRevision(tx, scope, boqId);
    if (revision.revisionNumber !== boq.currentRevisionNumber) {
      throw new BoqConflictError('The BOQ revision state is inconsistent. Reload and retry.');
    }
    return { boq, revision };
  }

  private async bumpVersion(
    tx: DatabaseTransaction,
    scope: BoqScope,
    boqId: string,
    expectedVersion: number,
    patch: Partial<typeof boqs.$inferInsert> = {},
  ) {
    const updated = await repository.updateBoqVersioned(
      tx,
      scope.organizationId,
      scope.projectId,
      boqId,
      expectedVersion,
      patch,
    );
    if (!updated) throw new BoqVersionConflictError();
    return updated;
  }

  async getBoq(scope: BoqScope, boqId: string, db: BoqDb = this.db) {
    return this.getBoqRecord(db, scope, boqId);
  }

  async listBoqs(
    scope: BoqScope,
    query: { limit: number; cursor?: string; status?: string },
  ) {
    const cursor = decodeCursor(query.cursor, (raw) => ({
      updatedAt: new Date(String(raw.updatedAt)),
      id: String(raw.id),
    }));
    if (cursor && Number.isNaN(cursor.decoded.updatedAt.getTime())) {
      throw new BoqValidationError('Invalid pagination cursor.');
    }
    const rows = await repository.listBoqs(this.db, scope.organizationId, scope.projectId, {
      status: query.status,
      cursor: cursor?.decoded,
      limit: query.limit,
    });
    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const last = items[items.length - 1];
    return {
      items,
      nextCursor:
        hasMore && last
          ? encodeCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id })
          : null,
    };
  }

  async listRevisions(
    scope: BoqScope,
    boqId: string,
    query: { limit: number; cursor?: string },
  ) {
    await this.getBoq(scope, boqId);
    const cursor = decodeCursor(query.cursor, (raw) => ({
      revisionNumber: Number(raw.revisionNumber),
    }));
    const rows = await repository.findRevisionsByBoq(
      this.db,
      scope.organizationId,
      scope.projectId,
      boqId,
      { cursor: cursor?.decoded, limit: query.limit },
    );
    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const last = items[items.length - 1];
    return {
      items,
      nextCursor:
        hasMore && last ? encodeCursor({ revisionNumber: last.revisionNumber }) : null,
    };
  }

  async getRevision(scope: BoqScope, boqId: string, revisionId: string) {
    await this.getBoq(scope, boqId);
    const revision = await repository.findRevision(
      this.db,
      scope.organizationId,
      scope.projectId,
      revisionId,
    );
    if (!revision || revision.boqId !== boqId) throw new BoqNotFoundError();
    const [sections, items] = await Promise.all([
      repository.findSections(this.db, scope.organizationId, scope.projectId, revisionId),
      repository.findItems(this.db, scope.organizationId, scope.projectId, revisionId),
    ]);
    return { revision, sections, items };
  }

  async create(scope: BoqScope, input: CreateBoqInput, actorUserId: string, requestId: string) {
    return this.db.transaction(async (tx) => {
      await tx
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, scope.projectId), eq(projects.organizationId, scope.organizationId)))
        .for('update');
      const boqNumber = await repository.nextBoqNumber(tx, scope.organizationId, scope.projectId);
      const boqId = generateId();
      await repository.insertBoq(tx, {
        id: boqId,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        boqNumber,
        title: input.title,
        description: input.description ?? null,
        currencyCode: input.currencyCode,
        status: 'DRAFT',
        currentRevisionNumber: 1,
        version: 1,
        createdBy: actorUserId,
      });
      await repository.insertRevision(tx, {
        id: generateId(),
        boqId,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        revisionNumber: 1,
        status: 'DRAFT',
        createdBy: actorUserId,
      });
      await writeFinancialAuditEvent(tx, {
        ...scope,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.BOQ_CREATED,
        entityType: 'BOQ',
        entityId: boqId,
        newState: { boqNumber, status: 'DRAFT', revisionNumber: 1 },
        currencyCode: input.currencyCode,
        requestId,
      });
      return this.getBoq(scope, boqId, tx);
    });
  }

  async revise(
    scope: BoqScope,
    boqId: string,
    input: ReviseBoqInput,
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const { boq, revision: previous } = await this.lockCurrent(
        tx,
        scope,
        boqId,
        input.expectedVersion,
        ['APPROVED', 'LOCKED'],
      );
      if (boq.currentRevisionNumber !== previous.revisionNumber) {
        throw new BoqConflictError();
      }
      const draft = await repository.findDraftRevision(
        tx,
        scope.organizationId,
        scope.projectId,
        boqId,
      );
      if (draft) throw new BoqConflictError('A draft revision already exists.');

      const nextNumber = boq.currentRevisionNumber + 1;
      const newRevisionId = generateId();
      await repository.insertRevision(tx, {
        id: newRevisionId,
        boqId,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        revisionNumber: nextNumber,
        status: 'DRAFT',
        createdBy: actorUserId,
      });

      const oldSections = await repository.findSections(
        tx,
        scope.organizationId,
        scope.projectId,
        previous.id,
      );
      const sectionMap = new Map<string, string>();
      for (const section of oldSections) sectionMap.set(section.id, generateId());
      const sectionsByDepth = [...oldSections].sort(
        (a, b) => a.depth - b.depth || a.sortOrder - b.sortOrder,
      );
      await repository.insertSections(
        tx,
        sectionsByDepth.map((section) => ({
          id: sectionMap.get(section.id)!,
          revisionId: newRevisionId,
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          sectionKey: section.sectionKey,
          parentSectionId: section.parentSectionId
            ? (sectionMap.get(section.parentSectionId) ?? null)
            : null,
          sortOrder: section.sortOrder,
          depth: section.depth,
          title: section.title,
        })),
      );

      const oldItems = await repository.findItems(
        tx,
        scope.organizationId,
        scope.projectId,
        previous.id,
      );
      const itemMap = new Map<string, string>();
      for (const item of oldItems) itemMap.set(item.id, generateId());
      await repository.insertItems(
        tx,
        oldItems.map((item) => ({
          id: itemMap.get(item.id)!,
          revisionId: newRevisionId,
          sectionId: sectionMap.get(item.sectionId)!,
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          itemKey: item.itemKey,
          sortOrder: item.sortOrder,
          description: item.description,
          specification: item.specification,
          unit: item.unit,
          quantity: item.quantity,
          unitRate: item.unitRate,
          amount: item.amount,
          currencyCode: item.currencyCode,
          costCodeId: item.costCodeId,
          provenance: item.provenance,
        })),
      );

      const activeMappings = await repository.findActiveMappings(
        tx,
        scope.organizationId,
        scope.projectId,
        previous.id,
      );
      await repository.insertMappings(
        tx,
        activeMappings
          .filter((mapping) => itemMap.has(mapping.itemId))
          .map((mapping) => ({
            id: generateId(),
            itemId: itemMap.get(mapping.itemId)!,
            revisionId: newRevisionId,
            organizationId: scope.organizationId,
            projectId: scope.projectId,
            targetType: mapping.targetType,
            costCodeId: mapping.costCodeId,
            status: 'ACTIVE',
            reason: input.reason,
            mappedBy: actorUserId,
          })),
      );

      await repository.updateRevision(tx, scope.organizationId, scope.projectId, previous.id, {
        status: 'SUPERSEDED',
      });
      await this.bumpVersion(tx, scope, boqId, input.expectedVersion, {
        status: 'DRAFT',
        currentRevisionNumber: nextNumber,
      });

      await writeFinancialAuditEvent(tx, {
        ...scope,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.BOQ_REVISED,
        entityType: 'BOQ',
        entityId: boqId,
        previousState: { revisionNumber: previous.revisionNumber, status: previous.status },
        newState: { revisionNumber: nextNumber, status: 'DRAFT' },
        reason: input.reason,
        requestId,
      });
      return this.getBoq(scope, boqId, tx);
    });
  }

  async previewImport(
    scope: BoqScope,
    boqId: string,
    input: BoqImportPreviewInput,
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const boq = await this.getBoqRecord(tx, scope, boqId);
      if (boq.version !== input.expectedVersion) throw new BoqVersionConflictError();
      if (boq.status !== 'DRAFT') {
        throw new BoqConflictError('Imports are only allowed while the BOQ is in DRAFT.');
      }

      const csv = validateBoqCsv(input.csvText, boq.currencyCode);
      if (!csv.ok) throw new BoqImportRejectedError(csv.errors);

      const amounts = computeLineAmounts(csv.rows);
      const costCodes = await this.resolveCostCodes(tx, scope, csv.rows);
      const errors = [...amounts.errors, ...costCodes.errors];
      if (errors.length > 0) throw new BoqImportRejectedError(errors);

      const sha = sha256(input.csvText);
      const byteSize = Buffer.byteLength(input.csvText, 'utf8');
      const idempotencyKeyHash = sha256(`preview:${boqId}:${sha}:${input.expectedVersion}`);

      const existing = await repository.findImportRunByIdempotencyKey(
        tx,
        scope.organizationId,
        scope.projectId,
        boqId,
        idempotencyKeyHash,
      );
      const run =
        existing ??
        (await repository.insertImportRun(tx, {
          id: generateId(),
          boqId,
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          status: 'PREVIEWED',
          sourceFileName: `boq-import-${sha.slice(0, 12)}.csv`,
          sourceFileSha256: sha,
          sourceByteSize: byteSize,
          rowCount: csv.rows.length,
          idempotencyKeyHash,
          createdBy: actorUserId,
        }));

      const sections = new Set(csv.rows.map((row) => row.sectionKey));
      const totalAmount = csv.rows
        .reduce((sum, row) => sum.plus(amounts.amounts.get(row.row) ?? '0'), new Decimal(0))
        .toFixed(2);

      if (!existing) {
        await writeFinancialAuditEvent(tx, {
          ...scope,
          actorUserId,
          action: FINANCIAL_AUDIT_ACTIONS.BOQ_IMPORT_PREVIEWED,
          entityType: 'BOQ_IMPORT',
          entityId: run.id,
          newState: { boqId, rowCount: csv.rows.length, sha256: sha },
          amount: totalAmount,
          currencyCode: boq.currencyCode,
          requestId,
        });
      }

      return {
        importId: run.id,
        status: run.status,
        sourceFileSha256: sha,
        rowCount: csv.rows.length,
        sectionCount: sections.size,
        totalAmount,
        currencyCode: boq.currencyCode,
      };
    });
  }

  async commitImport(
    scope: BoqScope,
    boqId: string,
    input: BoqImportCommitInput,
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const boq = await repository.findBoq(tx, scope.organizationId, scope.projectId, boqId, true);
      if (!boq) throw new BoqNotFoundError();
      const run = await repository.findImportRun(
        tx,
        scope.organizationId,
        scope.projectId,
        input.importId,
        true,
      );
      if (!run || run.boqId !== boqId) throw new BoqNotFoundError();

      if (run.status === 'COMMITTED') {
        return this.getBoq(scope, boqId, tx);
      }
      if (run.status !== 'PREVIEWED') {
        throw new BoqConflictError('This import is no longer available for commit.');
      }
      if (boq.version !== input.expectedVersion) throw new BoqVersionConflictError();
      if (boq.status !== 'DRAFT') {
        throw new BoqConflictError('Imports are only allowed while the BOQ is in DRAFT.');
      }

      const sha = sha256(input.csvText);
      const byteSize = Buffer.byteLength(input.csvText, 'utf8');
      if (sha !== run.sourceFileSha256 || byteSize !== run.sourceByteSize) {
        throw new BoqValidationError('The CSV content does not match the previewed file.');
      }

      const csv = validateBoqCsv(input.csvText, boq.currencyCode);
      if (!csv.ok) throw new BoqImportRejectedError(csv.errors);

      const amounts = computeLineAmounts(csv.rows);
      const costCodes = await this.resolveCostCodes(tx, scope, csv.rows);
      const errors = [...amounts.errors, ...costCodes.errors];
      if (errors.length > 0) throw new BoqImportRejectedError(errors);

      const revision = await this.currentRevision(tx, scope, boqId);
      if (revision.status !== 'DRAFT') {
        throw new BoqConflictError('The current revision is not a draft.');
      }

      await repository.deleteRevisionContents(tx, scope.organizationId, scope.projectId, revision.id);

      const sectionIds = new Map<string, string>();
      const sectionRows = [] as Array<{ key: string }>;
      for (const row of csv.rows) {
        if (!sectionIds.has(row.sectionKey)) {
          sectionIds.set(row.sectionKey, generateId());
          sectionRows.push({ key: row.sectionKey });
        }
      }
      await repository.insertSections(
        tx,
        sectionRows.map((section, index) => ({
          id: sectionIds.get(section.key)!,
          revisionId: revision.id,
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          sectionKey: section.key,
          sortOrder: index + 1,
          depth: 0,
          title: section.key,
        })),
      );

      const itemRows = csv.rows.map((row, index) => {
        const id = generateId();
        const costCodeId = row.costCode
          ? (costCodes.byCode.get(row.costCode.toUpperCase()) ?? null)
          : null;
        return {
          id,
          costCodeId,
          data: {
            id,
            revisionId: revision.id,
            sectionId: sectionIds.get(row.sectionKey)!,
            organizationId: scope.organizationId,
            projectId: scope.projectId,
            itemKey: row.itemKey,
            sortOrder: index + 1,
            description: row.description,
            specification: row.specification,
            unit: row.unit,
            quantity: row.quantity,
            unitRate: row.unitRate,
            amount: amounts.amounts.get(row.row)!,
            currencyCode: boq.currencyCode,
            costCodeId,
            provenance: { source: 'CSV_IMPORT', importId: run.id, row: row.row },
          },
        };
      });
      await repository.insertItems(
        tx,
        itemRows.map((entry) => entry.data),
      );
      await repository.insertMappings(
        tx,
        itemRows
          .filter((entry) => entry.costCodeId)
          .map((entry) => ({
            id: generateId(),
            itemId: entry.id,
            revisionId: revision.id,
            organizationId: scope.organizationId,
            projectId: scope.projectId,
            targetType: 'COST_CODE',
            costCodeId: entry.costCodeId,
            status: 'ACTIVE',
            reason: 'CSV import',
            mappedBy: actorUserId,
          })),
      );

      await repository.updateRevision(tx, scope.organizationId, scope.projectId, revision.id, {
        sourceImportRunId: run.id,
      });
      await repository.updateImportRun(tx, scope.organizationId, scope.projectId, run.id, {
        status: 'COMMITTED',
        committedAt: new Date(),
      });
      await this.bumpVersion(tx, scope, boqId, input.expectedVersion);

      const totalAmount = itemRows
        .reduce((sum, entry) => sum.plus(entry.data.amount), new Decimal(0))
        .toFixed(2);
      await writeFinancialAuditEvent(tx, {
        ...scope,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.BOQ_IMPORTED,
        entityType: 'BOQ',
        entityId: boqId,
        newState: {
          importId: run.id,
          revisionNumber: revision.revisionNumber,
          itemCount: itemRows.length,
          sectionCount: sectionRows.length,
        },
        amount: totalAmount,
        currencyCode: boq.currencyCode,
        requestId,
      });
      return this.getBoq(scope, boqId, tx);
    });
  }

  async submit(
    scope: BoqScope,
    boqId: string,
    input: { expectedVersion: number },
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const { boq, revision } = await this.lockCurrent(tx, scope, boqId, input.expectedVersion, [
        'DRAFT',
      ]);
      const items = await repository.findItems(tx, scope.organizationId, scope.projectId, revision.id);
      if (items.length === 0) throw new BoqConflictError('A BOQ needs at least one item to submit.');
      await repository.updateRevision(tx, scope.organizationId, scope.projectId, revision.id, {
        status: 'IN_REVIEW',
      });
      await this.bumpVersion(tx, scope, boq.id, input.expectedVersion, { status: 'IN_REVIEW' });
      await writeFinancialAuditEvent(tx, {
        ...scope,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.BOQ_SUBMITTED,
        entityType: 'BOQ',
        entityId: boqId,
        previousState: { status: 'DRAFT' },
        newState: { status: 'IN_REVIEW', revisionNumber: revision.revisionNumber },
        requestId,
      });
      return this.getBoq(scope, boqId, tx);
    });
  }

  async approve(
    scope: BoqScope,
    boqId: string,
    input: { expectedVersion: number },
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const { boq, revision } = await this.lockCurrent(tx, scope, boqId, input.expectedVersion, [
        'IN_REVIEW',
      ]);
      assertFinancialActorSeparation('approve', {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        actorUserId,
        creatorUserId: boq.createdBy,
        preparerUserId: revision.createdBy,
      });
      const approvedAt = new Date();
      await repository.updateRevision(tx, scope.organizationId, scope.projectId, revision.id, {
        status: 'APPROVED',
        approvedBy: actorUserId,
        approvedAt,
      });
      await this.bumpVersion(tx, scope, boq.id, input.expectedVersion, { status: 'APPROVED' });
      await writeFinancialAuditEvent(tx, {
        ...scope,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.BOQ_APPROVED,
        entityType: 'BOQ',
        entityId: boqId,
        previousState: { status: 'IN_REVIEW' },
        newState: { status: 'APPROVED', revisionNumber: revision.revisionNumber },
        requestId,
      });
      return this.getBoq(scope, boqId, tx);
    });
  }

  async lock(
    scope: BoqScope,
    boqId: string,
    input: { expectedVersion: number },
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const { boq, revision } = await this.lockCurrent(tx, scope, boqId, input.expectedVersion, [
        'APPROVED',
      ]);
      await repository.updateRevision(tx, scope.organizationId, scope.projectId, revision.id, {
        status: 'LOCKED',
        lockedBy: actorUserId,
        lockedAt: new Date(),
      });
      await this.bumpVersion(tx, scope, boq.id, input.expectedVersion, { status: 'LOCKED' });
      await writeFinancialAuditEvent(tx, {
        ...scope,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.BOQ_LOCKED,
        entityType: 'BOQ',
        entityId: boqId,
        previousState: { status: 'APPROVED' },
        newState: { status: 'LOCKED', revisionNumber: revision.revisionNumber },
        requestId,
      });
      return this.getBoq(scope, boqId, tx);
    });
  }

  async mapItem(
    scope: BoqScope,
    boqId: string,
    itemId: string,
    input: BoqItemMappingInput,
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const { boq, revision } = await this.lockCurrent(tx, scope, boqId, input.expectedVersion, [
        'DRAFT',
        'IN_REVIEW',
      ]);
      const item = await repository.findItem(tx, scope.organizationId, scope.projectId, itemId, true);
      if (!item || item.revisionId !== revision.id) throw new BoqNotFoundError();

      if (input.costCodeId) {
        const costCode = await repository.findActiveCostCodeById(
          tx,
          scope.organizationId,
          scope.projectId,
          input.costCodeId,
        );
        if (!costCode) {
          throw new BoqValidationError('The cost code is not an active cost code for this project.');
        }
      }

      await repository.supersedeActiveMappingsForItem(
        tx,
        scope.organizationId,
        scope.projectId,
        itemId,
        actorUserId,
      );
      if (input.costCodeId) {
        await repository.insertMappings(tx, [
          {
            id: generateId(),
            itemId,
            revisionId: revision.id,
            organizationId: scope.organizationId,
            projectId: scope.projectId,
            targetType: 'COST_CODE',
            costCodeId: input.costCodeId,
            status: 'ACTIVE',
            reason: null,
            mappedBy: actorUserId,
          },
        ]);
      }
      await repository.updateItemCostCode(
        tx,
        scope.organizationId,
        scope.projectId,
        itemId,
        input.costCodeId,
      );
      await this.bumpVersion(tx, scope, boq.id, input.expectedVersion);
      await writeFinancialAuditEvent(tx, {
        ...scope,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.BOQ_ITEM_MAPPED,
        entityType: 'BOQ_ITEM',
        entityId: itemId,
        previousState: { costCodeId: item.costCodeId },
        newState: { costCodeId: input.costCodeId },
        requestId,
      });
      return repository.findItem(tx, scope.organizationId, scope.projectId, itemId);
    });
  }

  async exportCsv(scope: BoqScope, boqId: string, revisionId?: string) {
    const boq = await this.getBoq(scope, boqId);
    const revision = revisionId
      ? await repository.findRevision(this.db, scope.organizationId, scope.projectId, revisionId)
      : await this.currentRevision(this.db, scope, boqId);
    if (!revision || revision.boqId !== boqId) throw new BoqNotFoundError();

    const rows = await repository.findItemsForExport(
      this.db,
      scope.organizationId,
      scope.projectId,
      revision.id,
    );
    const lines = [EXPORT_HEADERS.join(',')];
    for (const row of rows) {
      lines.push(
        [
          row.itemKey,
          row.sectionKey,
          row.description,
          row.specification ?? '',
          row.unit,
          row.quantity,
          row.unitRate ?? '',
          row.currencyCode,
          row.costCode ?? '',
        ]
          .map((cell) => escapeCsvCell(String(cell)))
          .join(','),
      );
    }
    return {
      filename: `boq-${boq.boqNumber}-rev${revision.revisionNumber}.csv`,
      content: `${lines.join('\n')}\n`,
    };
  }
}

export const projectBoqService = new ProjectBoqService();
