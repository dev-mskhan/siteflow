import { Decimal } from 'decimal.js';
import { and, eq, sql } from 'drizzle-orm';
import {
  boqItems,
  documentVersions,
  documents,
  projectCostCodes,
  takeoffMeasurementInputs,
  takeoffMeasurements,
  takeoffSheetRevisions,
  takeoffSheets,
  takeoffSources,
} from '@siteflow/database/schema';
import type {
  CreateTakeoffMeasurementInput,
  CreateTakeoffSheetInput,
  TakeoffFormulaPreviewInput,
  UpdateTakeoffMeasurementInput,
  UpdateTakeoffSheetInput,
} from '@siteflow/shared';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { writeFinancialAuditEvent } from '../../../lib/commercial/financial-audit.service.js';
import { FINANCIAL_AUDIT_ACTIONS } from '../../../lib/commercial/financial-audit.types.js';
import { assertFinancialActorSeparation } from '../../../lib/commercial/financial-policy.js';
import { linkDocument } from '../documents/document.service.js';
import { ProjectTakeoffRepository } from './takeoff.repository.js';
import { evaluateTakeoffFormula } from './takeoff.formula.js';
import {
  TakeoffConflictError,
  TakeoffFormulaError,
  TakeoffNotFoundError,
  TakeoffValidationError,
  TakeoffVersionConflictError,
} from './takeoff.errors.js';

type Scope = { organizationId: string; projectId: string; actorUserId: string; requestId?: string };
type Cursor = { createdAt: Date; id: string };

const CALCULATION_VERSION = 'takeoff-v1';
const QUANTITY_SCALE = 3;

const EDITABLE_REVISION_STATUS = 'DRAFT';

function toQuantity(value: Decimal): string {
  return value.toDecimalPlaces(QUANTITY_SCALE, Decimal.ROUND_HALF_UP).toFixed(QUANTITY_SCALE);
}

export class ProjectTakeoffService {
  private readonly db = getDb();
  private readonly repository = new ProjectTakeoffRepository();

  // ---- Sheets -------------------------------------------------------------

  async createSheet(scope: Scope, input: CreateTakeoffSheetInput) {
    return this.db.transaction(async (tx) => {
      const sheetId = generateId();
      const revisionId = generateId();
      const sheet = await this.repository.createSheet(tx, {
        id: sheetId,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        title: input.title,
        description: input.description ?? null,
        status: 'DRAFT',
        currentRevisionNumber: 1,
        version: 1,
        createdBy: scope.actorUserId,
      });
      await this.repository.createRevision(tx, {
        id: revisionId,
        sheetId,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        revisionNumber: 1,
        status: 'DRAFT',
        calculationVersion: CALCULATION_VERSION,
        createdBy: scope.actorUserId,
      });
      await this.audit(tx, scope, FINANCIAL_AUDIT_ACTIONS.TAKEOFF_SHEET_CREATED, sheetId, null, {
        status: 'DRAFT',
        revisionNumber: 1,
      });
      return sheet;
    });
  }

  async listSheets(
    scope: Scope,
    options: { status?: string; limit: number; cursor?: string },
  ) {
    const cursor = options.cursor ? decodeCursor(options.cursor) : undefined;
    const rows = await this.repository.listSheets(this.db, scope.organizationId, scope.projectId, {
      status: options.status,
      cursor,
      limit: options.limit,
    });
    const hasMore = rows.length > options.limit;
    const items = hasMore ? rows.slice(0, options.limit) : rows;
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async getSheet(scope: Scope, sheetId: string) {
    const sheet = await this.requireSheet(this.db, scope, sheetId);
    const revisions = await this.repository.listRevisions(this.db, scope.organizationId, scope.projectId, sheetId);
    return { ...sheet, revisions };
  }

  async updateSheet(scope: Scope, sheetId: string, input: UpdateTakeoffSheetInput) {
    return this.db.transaction(async (tx) => {
      const sheet = await this.requireSheet(tx, scope, sheetId, true);
      assertVersion(sheet.version, input.expectedVersion);
      if (sheet.status === 'PENDING_APPROVAL' || sheet.status === 'APPROVED') {
        throw new TakeoffConflictError('Submitted or approved takeoff sheets cannot be edited.');
      }
      const { expectedVersion, ...changes } = input;
      const updated = await this.repository.updateSheet(
        tx,
        scope.organizationId,
        scope.projectId,
        sheetId,
        expectedVersion,
        changes,
      );
      if (!updated) throw new TakeoffVersionConflictError();
      await this.audit(tx, scope, FINANCIAL_AUDIT_ACTIONS.TAKEOFF_SHEET_UPDATED, sheetId, { status: sheet.status }, {
        status: sheet.status,
      });
      return updated;
    });
  }

  async submitSheet(scope: Scope, sheetId: string, expectedVersion: number) {
    return this.db.transaction(async (tx) => {
      const sheet = await this.requireSheet(tx, scope, sheetId, true);
      assertVersion(sheet.version, expectedVersion);
      if (sheet.status !== 'DRAFT' && sheet.status !== 'REJECTED') {
        throw new TakeoffConflictError('Only draft or rejected takeoff sheets can be submitted.');
      }
      const revision = await this.currentRevision(tx, scope, sheet);
      if (revision.status !== EDITABLE_REVISION_STATUS && revision.status !== 'REJECTED') {
        throw new TakeoffConflictError('Only a draft revision can be submitted.');
      }
      const updated = await this.repository.updateSheet(tx, scope.organizationId, scope.projectId, sheetId, expectedVersion, {
        status: 'PENDING_APPROVAL',
        submittedBy: scope.actorUserId,
        submittedAt: new Date(),
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
      });
      if (!updated) throw new TakeoffVersionConflictError();
      await this.repository.updateRevisionStatus(tx, scope.organizationId, scope.projectId, revision.id, 'PENDING_APPROVAL');
      await this.audit(tx, scope, FINANCIAL_AUDIT_ACTIONS.TAKEOFF_SHEET_SUBMITTED, sheetId, { status: sheet.status }, {
        status: 'PENDING_APPROVAL',
        revisionNumber: revision.revisionNumber,
      });
      return updated;
    });
  }

  async approveSheet(scope: Scope, sheetId: string, expectedVersion: number) {
    return this.db.transaction(async (tx) => {
      const sheet = await this.requireSheet(tx, scope, sheetId, true);
      assertVersion(sheet.version, expectedVersion);
      if (sheet.status !== 'PENDING_APPROVAL') {
        throw new TakeoffConflictError('Only takeoff sheets pending approval can be approved.');
      }
      assertFinancialActorSeparation('approve', {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        actorUserId: scope.actorUserId,
        creatorUserId: sheet.createdBy,
        preparerUserId: sheet.submittedBy,
      });
      const revision = await this.currentRevision(tx, scope, sheet);
      const updated = await this.repository.updateSheet(tx, scope.organizationId, scope.projectId, sheetId, expectedVersion, {
        status: 'APPROVED',
        approvedBy: scope.actorUserId,
        approvedAt: new Date(),
      });
      if (!updated) throw new TakeoffVersionConflictError();
      await this.repository.updateRevisionStatus(tx, scope.organizationId, scope.projectId, revision.id, 'APPROVED');
      await this.audit(tx, scope, FINANCIAL_AUDIT_ACTIONS.TAKEOFF_SHEET_APPROVED, sheetId, { status: sheet.status }, {
        status: 'APPROVED',
        revisionNumber: revision.revisionNumber,
      });
      return updated;
    });
  }

  async rejectSheet(scope: Scope, sheetId: string, expectedVersion: number, reason: string) {
    return this.db.transaction(async (tx) => {
      const sheet = await this.requireSheet(tx, scope, sheetId, true);
      assertVersion(sheet.version, expectedVersion);
      if (sheet.status !== 'PENDING_APPROVAL') {
        throw new TakeoffConflictError('Only takeoff sheets pending approval can be rejected.');
      }
      assertFinancialActorSeparation('approve', {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        actorUserId: scope.actorUserId,
        creatorUserId: sheet.createdBy,
        preparerUserId: sheet.submittedBy,
      });
      const revision = await this.currentRevision(tx, scope, sheet);
      const updated = await this.repository.updateSheet(tx, scope.organizationId, scope.projectId, sheetId, expectedVersion, {
        status: 'REJECTED',
        rejectedBy: scope.actorUserId,
        rejectedAt: new Date(),
        rejectionReason: reason,
      });
      if (!updated) throw new TakeoffVersionConflictError();
      await this.repository.updateRevisionStatus(tx, scope.organizationId, scope.projectId, revision.id, 'REJECTED');
      await this.audit(tx, scope, FINANCIAL_AUDIT_ACTIONS.TAKEOFF_SHEET_REJECTED, sheetId, { status: sheet.status }, {
        status: 'REJECTED',
        revisionNumber: revision.revisionNumber,
      });
      return updated;
    });
  }

  // ---- Revisions ----------------------------------------------------------

  async createRevision(scope: Scope, sheetId: string, expectedVersion: number) {
    return this.db.transaction(async (tx) => {
      const sheet = await this.requireSheet(tx, scope, sheetId, true);
      assertVersion(sheet.version, expectedVersion);
      if (sheet.status !== 'APPROVED' && sheet.status !== 'REJECTED') {
        throw new TakeoffConflictError('A new revision can only be created from an approved or rejected takeoff.');
      }
      const previous = await this.currentRevision(tx, scope, sheet);
      const revisionId = generateId();
      const revisionNumber = sheet.currentRevisionNumber + 1;
      const revision = await this.repository.createRevision(tx, {
        id: revisionId,
        sheetId,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        revisionNumber,
        status: 'DRAFT',
        calculationVersion: CALCULATION_VERSION,
        createdBy: scope.actorUserId,
      });

      await this.copySources(tx, scope, previous.id, revisionId, sheetId);
      await this.copyMeasurements(tx, scope, previous.id, revisionId, sheetId);

      const updated = await this.repository.updateSheet(tx, scope.organizationId, scope.projectId, sheetId, expectedVersion, {
        status: 'DRAFT',
        currentRevisionNumber: revisionNumber,
        submittedBy: null,
        submittedAt: null,
        approvedBy: null,
        approvedAt: null,
      });
      if (!updated) throw new TakeoffVersionConflictError();
      await this.audit(tx, scope, FINANCIAL_AUDIT_ACTIONS.TAKEOFF_REVISION_CREATED, sheetId, {
        revisionNumber: previous.revisionNumber,
      }, { revisionNumber, revisionId: revision.id });
      return revision;
    });
  }

  async listRevisions(scope: Scope, sheetId: string) {
    await this.requireSheet(this.db, scope, sheetId);
    return this.repository.listRevisions(this.db, scope.organizationId, scope.projectId, sheetId);
  }

  // ---- Measurements -------------------------------------------------------

  async listMeasurements(scope: Scope, sheetId: string, revisionNumber?: number) {
    const sheet = await this.requireSheet(this.db, scope, sheetId);
    const revision = await this.resolveRevision(this.db, scope, sheet, revisionNumber);
    const measurements = await this.repository.listMeasurements(this.db, scope.organizationId, scope.projectId, revision.id);
    const inputs = await this.repository.listInputsForMeasurements(
      this.db,
      scope.organizationId,
      scope.projectId,
      measurements.map((m) => m.id),
    );
    return measurements.map((m) => ({
      ...m,
      inputs: inputs.filter((i) => i.measurementId === m.id),
    }));
  }

  async createMeasurement(scope: Scope, sheetId: string, input: CreateTakeoffMeasurementInput) {
    return this.db.transaction(async (tx) => {
      const sheet = await this.requireSheet(tx, scope, sheetId, true);
      const revision = await this.currentRevision(tx, scope, sheet);
      assertEditable(revision.status);

      await this.assertMeasurementReferences(tx, scope, revision.id, input.sourceId, input.boqItemId, input.costCodeId);

      const computed = computeQuantities(input);
      const [existing] = await tx
        .select({ max: sql<number>`coalesce(max(${takeoffMeasurements.lineNumber}), 0)` })
        .from(takeoffMeasurements)
        .where(eq(takeoffMeasurements.revisionId, revision.id));
      const lineNumber = Number(existing?.max ?? 0) + 1;
      const measurementId = generateId();

      const [measurement] = await this.repository.createMeasurements(tx, [
        {
          id: measurementId,
          revisionId: revision.id,
          sheetId,
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          lineNumber,
          stableKey: generateId(),
          description: input.description,
          dimension: input.dimension,
          unit: input.unit,
          measurementMode: input.measurementMode,
          sourceId: input.sourceId ?? null,
          formulaText: input.formulaText ?? null,
          manualQuantity: input.manualQuantity ?? null,
          grossQuantity: computed.gross,
          deductionQuantity: input.deductionQuantity,
          wastePercent: input.wastePercent,
          resultQuantity: computed.result,
          boqItemId: input.boqItemId ?? null,
          costCodeId: input.costCodeId ?? null,
          notes: input.notes ?? null,
          calculationVersion: CALCULATION_VERSION,
          createdBy: scope.actorUserId,
        },
      ]);
      await this.insertInputs(tx, scope, revision.id, measurementId, input.inputs);

      await this.bumpSheetVersion(tx, scope, sheet);
      await this.audit(tx, scope, FINANCIAL_AUDIT_ACTIONS.TAKEOFF_MEASUREMENT_CREATED, sheetId, null, {
        measurementId,
        lineNumber,
        resultQuantity: computed.result,
      });
      return measurement!;
    });
  }

  async updateMeasurement(
    scope: Scope,
    sheetId: string,
    measurementId: string,
    input: UpdateTakeoffMeasurementInput,
  ) {
    return this.db.transaction(async (tx) => {
      const sheet = await this.requireSheet(tx, scope, sheetId, true);
      assertVersion(sheet.version, input.expectedVersion);
      const revision = await this.currentRevision(tx, scope, sheet);
      assertEditable(revision.status);

      const current = await this.repository.findMeasurement(
        tx,
        scope.organizationId,
        scope.projectId,
        revision.id,
        measurementId,
        true,
      );
      if (!current) throw new TakeoffNotFoundError('Takeoff measurement not found.');

      const { inputs, ...changes } = input;
      const merged = {
        description: changes.description ?? current.description,
        dimension: changes.dimension ?? current.dimension,
        unit: changes.unit ?? current.unit,
        measurementMode: changes.measurementMode ?? current.measurementMode,
        sourceId: changes.sourceId !== undefined ? changes.sourceId : current.sourceId,
        manualQuantity:
          changes.manualQuantity !== undefined ? changes.manualQuantity : current.manualQuantity,
        formulaText: changes.formulaText !== undefined ? changes.formulaText : current.formulaText,
        inputs: inputs ?? (await this.loadInputs(tx, scope, measurementId)),
        deductionQuantity: changes.deductionQuantity ?? current.deductionQuantity,
        wastePercent: changes.wastePercent ?? current.wastePercent,
        boqItemId: changes.boqItemId !== undefined ? changes.boqItemId : current.boqItemId,
        costCodeId: changes.costCodeId !== undefined ? changes.costCodeId : current.costCodeId,
        notes: changes.notes !== undefined ? changes.notes : current.notes,
      };
      if (merged.measurementMode === 'MANUAL' && merged.manualQuantity == null) {
        throw new TakeoffValidationError('Manual measurements require a manual quantity.');
      }
      if (merged.measurementMode === 'FORMULA' && merged.formulaText == null) {
        throw new TakeoffValidationError('Formula measurements require formula text.');
      }
      await this.assertMeasurementReferences(
        tx,
        scope,
        revision.id,
        merged.sourceId,
        merged.boqItemId,
        merged.costCodeId,
      );

      const computed = computeQuantities(merged);
      const updated = await this.repository.updateMeasurement(
        tx,
        scope.organizationId,
        scope.projectId,
        revision.id,
        measurementId,
        {
          description: merged.description,
          dimension: merged.dimension,
          unit: merged.unit,
          measurementMode: merged.measurementMode,
          sourceId: merged.sourceId ?? null,
          formulaText: merged.formulaText ?? null,
          manualQuantity: merged.manualQuantity ?? null,
          grossQuantity: computed.gross,
          deductionQuantity: merged.deductionQuantity,
          wastePercent: merged.wastePercent,
          resultQuantity: computed.result,
          boqItemId: merged.boqItemId ?? null,
          costCodeId: merged.costCodeId ?? null,
          notes: merged.notes ?? null,
        },
      );
      if (!updated) throw new TakeoffVersionConflictError();
      await this.repository.updateSheet(tx, scope.organizationId, scope.projectId, sheet.id, sheet.version, {});

      if (inputs) {
        await this.repository.replaceInputs(tx, scope.organizationId, scope.projectId, measurementId, []);
        await this.insertInputs(tx, scope, revision.id, measurementId, inputs);
      }

      await this.bumpSheetVersion(tx, scope, sheet);
      await this.audit(tx, scope, FINANCIAL_AUDIT_ACTIONS.TAKEOFF_MEASUREMENT_UPDATED, sheetId, {
        resultQuantity: current.resultQuantity,
      }, { measurementId, resultQuantity: computed.result });
      return updated;
    });
  }

  previewFormula(input: TakeoffFormulaPreviewInput) {
    const result = evaluateSafely(input.formulaText, input.inputs);
    return {
      formulaText: input.formulaText,
      dimension: input.dimension,
      unit: input.unit,
      result: toQuantity(result),
    };
  }

  // ---- Sources ------------------------------------------------------------

  async listSources(scope: Scope, sheetId: string, revisionNumber?: number) {
    const sheet = await this.requireSheet(this.db, scope, sheetId);
    const revision = await this.resolveRevision(this.db, scope, sheet, revisionNumber);
    return this.repository.listSources(this.db, scope.organizationId, scope.projectId, revision.id);
  }

  async createSource(
    scope: Scope,
    sheetId: string,
    input: { documentId: string; documentVersionId: string; pageReference: string; regionLabel?: string | null },
  ) {
    return this.db.transaction(async (tx) => {
      const sheet = await this.requireSheet(tx, scope, sheetId, true);
      const revision = await this.currentRevision(tx, scope, sheet);
      assertEditable(revision.status);

      const [version] = await tx
        .select({ id: documentVersions.id })
        .from(documentVersions)
        .innerJoin(documents, eq(documents.id, documentVersions.documentId))
        .where(
          and(
            eq(documentVersions.id, input.documentVersionId),
            eq(documentVersions.documentId, input.documentId),
            eq(documents.organizationId, scope.organizationId),
            eq(documents.projectId, scope.projectId),
            eq(documents.status, 'ACTIVE'),
          ),
        )
        .limit(1);
      if (!version) throw new TakeoffNotFoundError('Document version not found for this project.');

      const source = await this.repository.createSource(tx, {
        id: generateId(),
        revisionId: revision.id,
        sheetId,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        documentId: input.documentId,
        documentVersionId: input.documentVersionId,
        pageReference: input.pageReference,
        regionLabel: input.regionLabel ?? null,
        createdBy: scope.actorUserId,
      });
      await linkDocument(tx, {
        orgId: scope.organizationId,
        projectId: scope.projectId,
        docId: input.documentId,
        entityType: 'takeoff_source',
        entityId: source.id,
        createdBy: scope.actorUserId,
      });
      await this.bumpSheetVersion(tx, scope, sheet);
      await this.audit(tx, scope, FINANCIAL_AUDIT_ACTIONS.TAKEOFF_SOURCE_LINKED, sheetId, null, {
        sourceId: source.id,
        documentId: input.documentId,
        documentVersionId: input.documentVersionId,
      });
      return source;
    });
  }

  // ---- Summary and compare -----------------------------------------------

  async summary(scope: Scope, groupBy: 'BOQ_ITEM' | 'COST_CODE' | 'SHEET') {
    const rows = await this.db
      .select({
        sheetId: takeoffSheets.id,
        revisionId: takeoffSheetRevisions.id,
        boqItemId: takeoffMeasurements.boqItemId,
        costCodeId: takeoffMeasurements.costCodeId,
        unit: takeoffMeasurements.unit,
        resultQuantity: takeoffMeasurements.resultQuantity,
      })
      .from(takeoffSheets)
      .innerJoin(
        takeoffSheetRevisions,
        and(
          eq(takeoffSheetRevisions.sheetId, takeoffSheets.id),
          eq(takeoffSheetRevisions.revisionNumber, takeoffSheets.currentRevisionNumber),
        ),
      )
      .innerJoin(
        takeoffMeasurements,
        eq(takeoffMeasurements.revisionId, takeoffSheetRevisions.id),
      )
      .where(
        and(
          eq(takeoffSheets.organizationId, scope.organizationId),
          eq(takeoffSheets.projectId, scope.projectId),
          eq(takeoffSheets.status, 'APPROVED'),
        ),
      );

    const groups = new Map<string, { key: string; unit: string; total: Decimal; count: number }>();
    for (const row of rows) {
      const key =
        groupBy === 'BOQ_ITEM'
          ? (row.boqItemId ?? 'UNMAPPED')
          : groupBy === 'COST_CODE'
            ? (row.costCodeId ?? 'UNMAPPED')
            : row.sheetId;
      const groupKey = `${key}|${row.unit}`;
      const current = groups.get(groupKey) ?? { key, unit: row.unit, total: new Decimal(0), count: 0 };
      current.total = current.total.plus(row.resultQuantity);
      current.count += 1;
      groups.set(groupKey, current);
    }
    return {
      groupBy,
      basis: 'APPROVED_SHEETS_CURRENT_REVISION',
      groups: [...groups.values()].map((g) => ({
        key: g.key,
        unit: g.unit,
        total: toQuantity(g.total),
        measurementCount: g.count,
      })),
    };
  }

  async compareRevisions(scope: Scope, sheetId: string, fromRevision: number, toRevision: number) {
    const sheet = await this.requireSheet(this.db, scope, sheetId);
    const from = await this.resolveRevision(this.db, scope, sheet, fromRevision);
    const to = await this.resolveRevision(this.db, scope, sheet, toRevision);
    const [fromRows, toRows] = await Promise.all([
      this.repository.listMeasurements(this.db, scope.organizationId, scope.projectId, from.id),
      this.repository.listMeasurements(this.db, scope.organizationId, scope.projectId, to.id),
    ]);
    const fromMap = new Map(fromRows.map((r) => [r.stableKey, r]));
    const toMap = new Map(toRows.map((r) => [r.stableKey, r]));
    const changes: Array<{ stableKey: string; change: 'ADDED' | 'REMOVED' | 'CHANGED'; from: string | null; to: string | null }> = [];
    for (const [key, row] of toMap) {
      const before = fromMap.get(key);
      if (!before) {
        changes.push({ stableKey: key, change: 'ADDED', from: null, to: row.resultQuantity });
      } else if (before.resultQuantity !== row.resultQuantity) {
        changes.push({ stableKey: key, change: 'CHANGED', from: before.resultQuantity, to: row.resultQuantity });
      }
    }
    for (const [key, row] of fromMap) {
      if (!toMap.has(key)) {
        changes.push({ stableKey: key, change: 'REMOVED', from: row.resultQuantity, to: null });
      }
    }
    return { fromRevision, toRevision, changes };
  }

  // ---- Internals ----------------------------------------------------------

  private async requireSheet(db: Parameters<ProjectTakeoffRepository['findSheet']>[0], scope: Scope, sheetId: string, lock = false) {
    const sheet = await this.repository.findSheet(db, scope.organizationId, scope.projectId, sheetId, lock);
    if (!sheet) throw new TakeoffNotFoundError('Takeoff sheet not found.');
    return sheet;
  }

  private async currentRevision(
    db: Parameters<ProjectTakeoffRepository['findSheet']>[0],
    scope: Scope,
    sheet: { id: string; currentRevisionNumber: number },
  ) {
    return this.resolveRevision(db, scope, sheet, sheet.currentRevisionNumber);
  }

  private async resolveRevision(
    db: Parameters<ProjectTakeoffRepository['findSheet']>[0],
    scope: Scope,
    sheet: { id: string; currentRevisionNumber: number },
    revisionNumber?: number,
  ) {
    const number = revisionNumber ?? sheet.currentRevisionNumber;
    const revisions = await this.repository.listRevisions(db, scope.organizationId, scope.projectId, sheet.id);
    const revision = revisions.find((r) => r.revisionNumber === number);
    if (!revision) throw new TakeoffNotFoundError('Takeoff revision not found.');
    return revision;
  }

  private async assertMeasurementReferences(
    db: Parameters<ProjectTakeoffRepository['findSheet']>[0],
    scope: Scope,
    revisionId: string,
    sourceId: string | null | undefined,
    boqItemId: string | null | undefined,
    costCodeId: string | null | undefined,
  ) {
    if (sourceId) {
      const source = await this.repository.findSource(db, scope.organizationId, scope.projectId, revisionId, sourceId);
      if (!source) throw new TakeoffValidationError('The source does not belong to this revision.');
    }
    if (boqItemId) {
      const [item] = await db
        .select({ id: boqItems.id })
        .from(boqItems)
        .where(
          and(
            eq(boqItems.id, boqItemId),
            eq(boqItems.organizationId, scope.organizationId),
            eq(boqItems.projectId, scope.projectId),
          ),
        )
        .limit(1);
      if (!item) throw new TakeoffValidationError('The BOQ item does not belong to this project.');
    }
    if (costCodeId) {
      const [code] = await db
        .select({ id: projectCostCodes.id })
        .from(projectCostCodes)
        .where(
          and(
            eq(projectCostCodes.id, costCodeId),
            eq(projectCostCodes.organizationId, scope.organizationId),
            eq(projectCostCodes.projectId, scope.projectId),
          ),
        )
        .limit(1);
      if (!code) throw new TakeoffValidationError('The cost code does not belong to this project.');
    }
  }

  private async insertInputs(
    tx: Parameters<ProjectTakeoffRepository['findSheet']>[0] & object,
    scope: Scope,
    revisionId: string,
    measurementId: string,
    inputs: Array<{ variableName: string; value: string; unit: string; dimension: string }>,
  ) {
    const rows = inputs.map((input, index) => ({
      id: generateId(),
      measurementId,
      revisionId,
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      variableName: input.variableName,
      value: input.value,
      unit: input.unit,
      dimension: input.dimension,
      position: index + 1,
    }));
    if (rows.length === 0) return;
    await tx.insert(takeoffMeasurementInputs).values(rows);
  }

  private async loadInputs(
    db: Parameters<ProjectTakeoffRepository['findSheet']>[0],
    scope: Scope,
    measurementId: string,
  ) {
    const rows = await this.repository.listInputsForMeasurements(db, scope.organizationId, scope.projectId, [measurementId]);
    return rows.map((r) => ({ variableName: r.variableName, value: r.value, unit: r.unit, dimension: r.dimension }));
  }

  private async copySources(
    tx: Parameters<ProjectTakeoffRepository['findSheet']>[0] & object,
    scope: Scope,
    fromRevisionId: string,
    toRevisionId: string,
    sheetId: string,
  ) {
    const sources = await this.repository.listSources(tx, scope.organizationId, scope.projectId, fromRevisionId);
    if (sources.length === 0) return;
    await tx.insert(takeoffSources).values(
      sources.map((s) => ({
        id: generateId(),
        revisionId: toRevisionId,
        sheetId,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        documentId: s.documentId,
        documentVersionId: s.documentVersionId,
        pageReference: s.pageReference,
        regionLabel: s.regionLabel,
        createdBy: scope.actorUserId,
      })),
    );
  }

  private async copyMeasurements(
    tx: Parameters<ProjectTakeoffRepository['findSheet']>[0] & object,
    scope: Scope,
    fromRevisionId: string,
    toRevisionId: string,
    sheetId: string,
  ) {
    const measurements = await this.repository.listMeasurements(tx, scope.organizationId, scope.projectId, fromRevisionId);
    if (measurements.length === 0) return;
    const sourceMap = new Map<string, string>();
    const newSources = await this.repository.listSources(tx, scope.organizationId, scope.projectId, toRevisionId);
    const oldSources = await this.repository.listSources(tx, scope.organizationId, scope.projectId, fromRevisionId);
    for (const old of oldSources) {
      const match = newSources.find(
        (n) => n.documentVersionId === old.documentVersionId && n.pageReference === old.pageReference,
      );
      if (match) sourceMap.set(old.id, match.id);
    }
    const idMap = new Map<string, string>();
    const rows = measurements.map((m) => {
      const id = generateId();
      idMap.set(m.id, id);
      return {
        id,
        revisionId: toRevisionId,
        sheetId,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        lineNumber: m.lineNumber,
        stableKey: m.stableKey,
        description: m.description,
        dimension: m.dimension,
        unit: m.unit,
        measurementMode: m.measurementMode,
        sourceId: m.sourceId ? (sourceMap.get(m.sourceId) ?? null) : null,
        formulaText: m.formulaText,
        manualQuantity: m.manualQuantity,
        grossQuantity: m.grossQuantity,
        deductionQuantity: m.deductionQuantity,
        wastePercent: m.wastePercent,
        resultQuantity: m.resultQuantity,
        boqItemId: m.boqItemId,
        costCodeId: m.costCodeId,
        notes: m.notes,
        calculationVersion: CALCULATION_VERSION,
        createdBy: scope.actorUserId,
      };
    });
    await tx.insert(takeoffMeasurements).values(rows);

    const inputs = await this.repository.listInputsForMeasurements(
      tx,
      scope.organizationId,
      scope.projectId,
      measurements.map((m) => m.id),
    );
    if (inputs.length > 0) {
      await tx.insert(takeoffMeasurementInputs).values(
        inputs.map((i) => ({
          id: generateId(),
          measurementId: idMap.get(i.measurementId)!,
          revisionId: toRevisionId,
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          variableName: i.variableName,
          value: i.value,
          unit: i.unit,
          dimension: i.dimension,
          position: i.position,
        })),
      );
    }
  }

  private async bumpSheetVersion(
    tx: Parameters<ProjectTakeoffRepository['updateSheet']>[0],
    scope: Scope,
    sheet: { id: string; version: number },
  ) {
    await this.repository.updateSheet(tx, scope.organizationId, scope.projectId, sheet.id, sheet.version, {});
  }

  private async audit(
    tx: DatabaseTransactionLike,
    scope: Scope,
    action: string,
    sheetId: string,
    previousState: Record<string, unknown> | null,
    newState: Record<string, unknown> | null,
  ) {
    await writeFinancialAuditEvent(tx, {
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      actorUserId: scope.actorUserId,
      action,
      entityType: 'TAKEOFF_SHEET',
      entityId: sheetId,
      previousState,
      newState,
      requestId: scope.requestId,
    } as Parameters<typeof writeFinancialAuditEvent>[1]);
  }
}

type DatabaseTransactionLike = Parameters<typeof writeFinancialAuditEvent>[0];

function assertVersion(actual: number, expected: number) {
  if (actual !== expected) throw new TakeoffVersionConflictError();
}

function assertEditable(status: string) {
  if (status !== EDITABLE_REVISION_STATUS) {
    throw new TakeoffConflictError('Only draft revisions can be edited.');
  }
}

function evaluateSafely(formulaText: string, inputs: Array<{ variableName: string; value: string }>) {
  try {
    return evaluateTakeoffFormula(formulaText, inputs);
  } catch (error) {
    throw new TakeoffFormulaError(error instanceof Error ? error.message : undefined);
  }
}

function computeQuantities(input: {
  measurementMode: string;
  manualQuantity?: string | null;
  formulaText?: string | null;
  inputs?: Array<{ variableName: string; value: string }>;
  deductionQuantity: string;
  wastePercent: string;
}) {
  const gross =
    input.measurementMode === 'MANUAL'
      ? new Decimal(input.manualQuantity ?? '0')
      : evaluateSafely(input.formulaText ?? '0', input.inputs ?? []);
  const deduction = new Decimal(input.deductionQuantity);
  const waste = new Decimal(input.wastePercent).div(100);
  const net = gross.minus(deduction);
  if (net.isNegative()) {
    throw new TakeoffValidationError('Deductions cannot exceed the gross quantity.');
  }
  const result = net.times(new Decimal(1).plus(waste));
  return { gross: toQuantity(gross), result: toQuantity(result) };
}

function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id }), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      createdAt: string;
      id: string;
    };
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime()) || typeof parsed.id !== 'string') throw new Error('bad cursor');
    return { createdAt, id: parsed.id };
  } catch {
    throw new TakeoffValidationError('The pagination cursor is invalid.');
  }
}

export const projectTakeoffService = new ProjectTakeoffService();
