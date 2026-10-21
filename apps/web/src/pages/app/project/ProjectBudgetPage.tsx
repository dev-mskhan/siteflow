/**
 * ProjectBudgetPage — /org/:orgId/projects/:projectId/budget
 *
 * Flow:
 *   1. listBudgets to get the active budget id (budget list → pick first)
 *   2. getBudget + getBudgetSummary using that id
 *   3. Create / edit / submit / approve inline
 *
 * Server constraints respected:
 *   - createBudget: min 1 line (server validates)
 *   - updateBudget: only when DRAFT or APPROVED; requires expectedVersion
 *   - submitBudget / approveBudget: require budgetId + expectedVersion
 *   - Actor separation: approve button hidden when current user == submittedBy
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Trash2, CheckCircle2, Send, Edit2, XCircle } from 'lucide-react';
import { useActiveProject } from '../../../features/project/useActiveProject';
import {
  useListBudgetsQuery,
  useGetBudgetQuery,
  useGetBudgetSummaryQuery,
  useCreateBudgetMutation,
  useUpdateBudgetMutation,
  useSubmitBudgetMutation,
  useApproveBudgetMutation,
} from '../../../features/project/budgetApi';
import { useListPhasesQuery } from '../../../features/project/phaseApi';
import { useListCostCodesQuery } from '../../../features/project/costCodeApi';
import { useAuth } from '../../../features/auth/useAuth';
import { inputCls } from '../../../components/ui/FormField';
import { CustomSelect } from '../../../components/ui/CustomSelect';
import { InlineAlert } from '../../../components/ui/InlineAlert';
import { useToast } from '../../../components/ui/Toast';
import {
  getServerError,
  isInlineError,
  isToastError,
  toastErrorMessage,
} from '../../../lib/authErrors';
import type { ProjectBudgetDTO } from '../../../features/project/projectTypes';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_BADGES: Record<ProjectBudgetDTO['status'], { label: string; cls: string }> = {
  DRAFT: {
    label: 'Draft',
    cls: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  },
  PENDING_APPROVAL: {
    label: 'Pending Approval',
    cls: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  },
  APPROVED: { label: 'Approved', cls: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]' },
  SUPERSEDED: {
    label: 'Superseded',
    cls: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  },
  CLOSED: {
    label: 'Closed',
    cls: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  },
};

function fmtAmt(val: string, code: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return `${code} 0.00`;
  return `${code} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface LineInput {
  costCodeId: string;
  phaseId: string | null;
  description: string;
  amount: string;
}

function emptyLine(): LineInput {
  return { costCodeId: '', phaseId: null, description: '', amount: '0.00' };
}

// ── Line editor (shared for create + edit) ────────────────────────────────────

const LineEditor: React.FC<{
  lines: LineInput[];
  phaseOptions: { value: string; label: string }[];
  codeOptions: { value: string; label: string }[];
  onChange: (lines: LineInput[]) => void;
}> = ({ lines, phaseOptions, codeOptions, onChange }) => {
  const update = (idx: number, patch: Partial<LineInput>) =>
    onChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const remove = (idx: number) => onChange(lines.filter((_, i) => i !== idx));
  const add = () => onChange([...lines, emptyLine()]);

  return (
    <div className="space-y-3">
      {lines.map((line, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-3">
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">
              Cost code
            </label>
            <CustomSelect
              options={codeOptions}
              value={line.costCodeId}
              onChange={(v) => update(idx, { costCodeId: v })}
            />
          </div>
          <div className="col-span-3">
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">
              Phase
            </label>
            <CustomSelect
              options={phaseOptions}
              value={line.phaseId ?? ''}
              onChange={(v) => update(idx, { phaseId: v || null })}
            />
          </div>
          <div className="col-span-4">
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">
              Description
            </label>
            <input
              type="text"
              className={inputCls()}
              value={line.description}
              onChange={(e) => update(idx, { description: e.target.value })}
            />
          </div>
          <div className="col-span-2 flex items-end gap-2">
            <div className="flex-1">
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">
                Amount
              </label>
              <input
                type="text"
                className={inputCls()}
                value={line.amount}
                onChange={(e) => update(idx, { amount: e.target.value })}
              />
            </div>
            <button
              type="button"
              onClick={() => remove(idx)}
              className="min-h-10 px-2 border border-[var(--hairline-2)] hover:border-[#991b1b] hover:text-[#991b1b] transition-colors"
              aria-label="Remove line"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-2 text-sm font-medium border border-[var(--hairline-2)] px-4 py-2 hover:bg-[var(--surface-2)] transition-colors"
      >
        <Plus className="h-4 w-4" strokeWidth={1.8} />
        Add line
      </button>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

export const ProjectBudgetPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { activeProject } = useActiveProject();
  const { user } = useAuth();
  const { success: toastOk, error: toastErr } = useToast();

  // Step 1: list to get active budgetId
  const { data: listData, isLoading: listLoading } = useListBudgetsQuery({
    orgId: orgId!,
    projectId: projectId!,
  });
  const activeBudgetId = listData?.budgets[0]?.id;

  // Step 2: fetch full budget + summary (skip until we have an id)
  const { data: budgetData, isLoading: budgetLoading } = useGetBudgetQuery(
    { orgId: orgId!, projectId: projectId!, budgetId: activeBudgetId! },
    { skip: !activeBudgetId },
  );
  const { data: summaryData } = useGetBudgetSummaryQuery(
    { orgId: orgId!, projectId: projectId!, budgetId: activeBudgetId! },
    { skip: !activeBudgetId },
  );

  const { data: phasesData } = useListPhasesQuery({ orgId: orgId!, projectId: projectId! });
  const { data: costCodesData } = useListCostCodesQuery({ orgId: orgId!, projectId: projectId! });

  const [createBudget, { isLoading: creating, error: createErr }] = useCreateBudgetMutation();
  const [updateBudget, { isLoading: updating, error: updateErr }] = useUpdateBudgetMutation();
  const [submitBudget, { isLoading: submitting }] = useSubmitBudgetMutation();
  const [approveBudget, { isLoading: approving }] = useApproveBudgetMutation();

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [draftLines, setDraftLines] = useState<LineInput[]>([]);

  const budget = budgetData?.budget ?? null;
  const phases = phasesData?.phases ?? [];
  const costCodes = costCodesData?.costCodes ?? [];

  const phaseOptions = [
    { value: '', label: '(no phase)' },
    ...phases.map((p) => ({ value: p.id, label: p.name })),
  ];
  const codeOptions = costCodes.map((c) => ({ value: c.id, label: c.code }));

  // ── handlers ────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (draftLines.length === 0) {
      toastErr('At least one line required', 'Add a line before creating the budget.');
      return;
    }
    try {
      await createBudget({
        orgId: orgId!,
        projectId: projectId!,
        body: {
          currencyCode: activeProject?.currency ?? 'PKR',
          lines: draftLines.map((l) => ({
            costCodeId: l.costCodeId,
            phaseId: l.phaseId ?? undefined,
            description: l.description || undefined,
            amount: l.amount,
          })),
        },
      }).unwrap();
      toastOk('Budget created', '');
      setShowCreate(false);
      setDraftLines([]);
    } catch (err) {
      if (isToastError(err as never)) toastErr('Create failed', toastErrorMessage(err as never));
    }
  };

  const openEdit = () => {
    if (!budget) return;
    setDraftLines(
      budget.lines.map((l) => ({
        costCodeId: l.costCodeId,
        phaseId: l.phaseId,
        description: l.description ?? '',
        amount: l.amount,
      })),
    );
    setShowEdit(true);
  };

  const handleUpdate = async () => {
    if (!budget || !activeBudgetId || draftLines.length === 0) return;
    try {
      await updateBudget({
        orgId: orgId!,
        projectId: projectId!,
        budgetId: activeBudgetId,
        body: {
          expectedVersion: budget.version,
          lines: draftLines.map((l) => ({
            costCodeId: l.costCodeId,
            phaseId: l.phaseId ?? undefined,
            description: l.description || undefined,
            amount: l.amount,
          })),
        },
      }).unwrap();
      toastOk('Budget updated', '');
      setShowEdit(false);
      setDraftLines([]);
    } catch (err) {
      if (isToastError(err as never)) toastErr('Update failed', toastErrorMessage(err as never));
    }
  };

  const handleSubmit = async () => {
    if (!budget || !activeBudgetId) return;
    try {
      await submitBudget({
        orgId: orgId!,
        projectId: projectId!,
        budgetId: activeBudgetId,
        expectedVersion: budget.version,
      }).unwrap();
      toastOk('Budget submitted for approval', '');
    } catch (err) {
      if (isToastError(err as never)) toastErr('Submit failed', toastErrorMessage(err as never));
    }
  };

  const handleApprove = async () => {
    if (!budget || !activeBudgetId) return;
    try {
      await approveBudget({
        orgId: orgId!,
        projectId: projectId!,
        budgetId: activeBudgetId,
        expectedVersion: budget.version,
      }).unwrap();
      toastOk('Budget approved', '');
    } catch (err) {
      if (isToastError(err as never)) toastErr('Approve failed', toastErrorMessage(err as never));
    }
  };

  // ── derived state ────────────────────────────────────────────────────────────

  const canEdit = budget && (budget.status === 'DRAFT' || budget.status === 'APPROVED');
  const canSubmit = budget && budget.status === 'DRAFT' && budget.lines.length > 0;
  const canApprove = budget && budget.status === 'PENDING_APPROVAL';
  const isSubmitter = budget?.submittedBy === user?.id;

  const isLoading = listLoading || (!!activeBudgetId && budgetLoading);
  const currency = activeProject?.currency ?? 'PKR';

  // ── render ───────────────────────────────────────────────────────────────────

  if (isLoading || !activeProject) {
    return (
      <div className="p-6 sm:p-8 space-y-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-4xl space-y-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--hairline-2)]">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            Project budget
          </p>
          <h1 className="mt-1 text-2xl font-medium tracking-[-0.04em]">{activeProject.name}</h1>
          {budget && (
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`font-mono text-[9px] uppercase tracking-[0.12em] border px-2 py-0.5 ${STATUS_BADGES[budget.status].cls}`}
              >
                {STATUS_BADGES[budget.status].label}
              </span>
              <span className="font-mono text-[10px] text-[var(--muted)]">
                Rev. {budget.currentRevisionNumber}
              </span>
            </div>
          )}
        </div>
        {!budget && !showCreate && (
          <button
            onClick={() => {
              setShowCreate(true);
              setDraftLines([emptyLine()]);
            }}
            className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="h-4 w-4" strokeWidth={1.8} />
            Create budget
          </button>
        )}
      </div>

      {/* ── Summary ── */}
      {summaryData && budget && (
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-3">
            Budget summary
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-[var(--muted)]">Original</p>
              <p className="mt-1 text-lg font-medium">
                {fmtAmt(summaryData.summary.original, currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Approved changes</p>
              <p className="mt-1 text-lg font-medium">
                {fmtAmt(summaryData.summary.approvedChanges, currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Revised total</p>
              <p className="mt-1 text-lg font-medium text-[#166534]">
                {fmtAmt(summaryData.summary.revised, currency)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Actor separation warning ── */}
      {canApprove && isSubmitter && (
        <InlineAlert
          variant="warning"
          message="You submitted this budget — another user must approve it (actor separation)."
        />
      )}

      {/* ── Create form ── */}
      {showCreate && (
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            New budget
          </p>
          {isInlineError(createErr) && (
            <InlineAlert variant="error" message={getServerError(createErr)?.message ?? ''} />
          )}
          <LineEditor
            lines={draftLines}
            phaseOptions={phaseOptions}
            codeOptions={codeOptions}
            onChange={setDraftLines}
          />
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button
              onClick={handleCreate}
              disabled={creating || draftLines.length === 0}
              className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
            >
              {creating ? 'Creating…' : 'Create budget'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setDraftLines([]);
              }}
              className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Edit form ── */}
      {showEdit && budget && (
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Edit budget lines
          </p>
          {isInlineError(updateErr) && (
            <InlineAlert variant="error" message={getServerError(updateErr)?.message ?? ''} />
          )}
          <LineEditor
            lines={draftLines}
            phaseOptions={phaseOptions}
            codeOptions={codeOptions}
            onChange={setDraftLines}
          />
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button
              onClick={handleUpdate}
              disabled={updating || draftLines.length === 0}
              className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
            >
              {updating ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowEdit(false);
                setDraftLines([]);
              }}
              className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Lines read-only ── */}
      {budget && !showEdit && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Budget lines
            </p>
            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  onClick={openEdit}
                  disabled={budget.status === 'PENDING_APPROVAL'}
                  className="inline-flex items-center gap-2 border border-[var(--hairline-2)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Edit2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Edit
                </button>
              )}
              {canSubmit && (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" strokeWidth={1.8} />
                  {submitting ? 'Submitting…' : 'Submit for approval'}
                </button>
              )}
              {canApprove && !isSubmitter && (
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="inline-flex items-center gap-2 min-h-10 bg-[#166534] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
                  {approving ? 'Approving…' : 'Approve'}
                </button>
              )}
            </div>
          </div>

          <div className="border border-[var(--hairline-2)] divide-y divide-[var(--hairline-2)]">
            {/* Column header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-[var(--surface-2)]">
              {['#', 'Cost code', 'Phase', 'Description', 'Amount'].map((h) => (
                <p
                  key={h}
                  className={`font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] ${h === 'Amount' ? 'col-span-3 text-right' : h === 'Description' ? 'col-span-4' : h === '#' ? 'col-span-1' : 'col-span-2'}`}
                >
                  {h}
                </p>
              ))}
            </div>

            {budget.lines.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">No lines.</div>
            ) : (
              budget.lines.map((line) => {
                const phase = phases.find((p) => p.id === line.phaseId);
                const cc = costCodes.find((c) => c.id === line.costCodeId);
                return (
                  <div
                    key={line.id}
                    className="grid grid-cols-12 gap-4 px-4 py-3 bg-[var(--paper)]"
                  >
                    <div className="col-span-1">
                      <p className="font-mono text-[10px] text-[var(--muted)]">
                        #{line.lineNumber}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm font-medium">{cc?.code ?? '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm">{phase?.name ?? '—'}</p>
                    </div>
                    <div className="col-span-4">
                      <p className="text-sm">{line.description ?? '—'}</p>
                    </div>
                    <div className="col-span-3 text-right">
                      <p className="text-sm font-medium">{fmtAmt(line.amount, currency)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Total */}
          <div className="flex justify-end border-t-2 border-[var(--ink)] pt-3">
            <div className="text-right">
              <p className="text-xs text-[var(--muted)]">Total</p>
              <p className="text-xl font-medium mt-0.5">{fmtAmt(budget.total, currency)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!budget && !showCreate && (
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] px-6 py-16 text-center">
          <XCircle className="h-12 w-12 text-[var(--muted)] mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-[var(--muted)]">No budget created yet.</p>
          <button
            onClick={() => {
              setShowCreate(true);
              setDraftLines([emptyLine()]);
            }}
            className="mt-4 inline-flex items-center gap-2 min-h-9 border border-[var(--hairline-2)] px-5 text-sm font-medium hover:bg-[var(--surface-2)] transition-colors"
          >
            <Plus className="h-4 w-4" strokeWidth={1.8} /> Create budget
          </button>
        </div>
      )}
    </div>
  );
};
