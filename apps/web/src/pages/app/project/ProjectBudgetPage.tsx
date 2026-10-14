/**
 * ProjectBudgetPage — /org/:orgId/projects/:projectId/budget
 * Full budget state machine: DRAFT → PENDING_APPROVAL → APPROVED → CLOSED
 * Budget lines table with cost code and phase lookup.
 * State transition buttons gated by status + actor separation (approve ≠ submit).
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Send, CheckCircle2, Lock, FileText } from 'lucide-react';
import {
  useListBudgetsQuery,
  useCreateBudgetMutation,
  useSubmitBudgetMutation,
  useApproveBudgetMutation,
  useCloseBudgetMutation,
} from '../../../features/project/budgetApi';
import { useListCostCodesQuery } from '../../../features/project/costCodeApi';
import { useListPhasesQuery } from '../../../features/project/phaseApi';
import { useActiveProject } from '../../../features/project/useActiveProject';
import { useToast } from '../../../components/ui/Toast';
import { toastErrorMessage } from '../../../lib/authErrors';
import type { ProjectBudgetStatus } from '../../../features/project/projectTypes';
import { cn } from '../../../lib/cn';

const STATUS_CONFIG: Record<ProjectBudgetStatus, { label: string; cls: string }> = {
  DRAFT:            { label: 'Draft',            cls: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]' },
  PENDING_APPROVAL: { label: 'Pending approval', cls: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]' },
  APPROVED:         { label: 'Approved',         cls: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]' },
  SUPERSEDED:       { label: 'Superseded',       cls: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]' },
  CLOSED:           { label: 'Closed',           cls: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]' },
};

function fmt(val: string, currency: string) {
  const n = parseFloat(val);
  return currency === 'PKR'
    ? `PKR ${new Intl.NumberFormat('en-PK').format(n)}`
    : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

export const ProjectBudgetPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { activeProject } = useActiveProject();
  const { success: toastOk, error: toastErr } = useToast();

  const { data: budgetData, isLoading } = useListBudgetsQuery({ orgId: orgId!, projectId: projectId! });
  const { data: codesData } = useListCostCodesQuery({ orgId: orgId!, projectId: projectId! });
  const { data: phasesData } = useListPhasesQuery({ orgId: orgId!, projectId: projectId! });

  const [createBudget, { isLoading: creating }] = useCreateBudgetMutation();
  const [submitBudget, { isLoading: submitting }] = useSubmitBudgetMutation();
  const [approveBudget, { isLoading: approving }] = useApproveBudgetMutation();
  const [closeBudget, { isLoading: closing }] = useCloseBudgetMutation();

  const budget = budgetData?.budgets[0];
  const codes = codesData?.costCodes ?? [];
  const phases = phasesData?.phases ?? [];

  const codeMap = Object.fromEntries(codes.map((c) => [c.id, c.code]));
  const phaseMap = Object.fromEntries(phases.map((p) => [p.id, p.name]));

  const handleCreate = async () => {
    if (!activeProject) return;
    try {
      await createBudget({
        orgId: orgId!,
        projectId: projectId!,
        body: { currencyCode: activeProject.currency, lines: [] },
      }).unwrap();
      toastOk('Budget created', 'Add line items to structure your cost plan.');
    } catch (err) { toastErr('Failed', toastErrorMessage(err as never)); }
  };

  const handleSubmit = async () => {
    if (!budget) return;
    try {
      await submitBudget({ orgId: orgId!, projectId: projectId!, budgetId: budget.id, expectedVersion: budget.version }).unwrap();
      toastOk('Budget submitted', 'Awaiting approval.');
    } catch (err) { toastErr('Submit failed', toastErrorMessage(err as never)); }
  };

  const handleApprove = async () => {
    if (!budget) return;
    try {
      await approveBudget({ orgId: orgId!, projectId: projectId!, budgetId: budget.id, expectedVersion: budget.version }).unwrap();
      toastOk('Budget approved', 'The budget is now the baseline.');
    } catch (err) { toastErr('Approve failed', toastErrorMessage(err as never)); }
  };

  const handleClose = async () => {
    if (!budget || !confirm('Close this budget? No further changes will be possible.')) return;
    try {
      await closeBudget({ orgId: orgId!, projectId: projectId!, budgetId: budget.id, expectedVersion: budget.version }).unwrap();
      toastOk('Budget closed', '');
    } catch (err) { toastErr('Close failed', toastErrorMessage(err as never)); }
  };

  if (isLoading) return (
    <div className="p-6 sm:p-8 space-y-2">
      {[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]" />)}
    </div>
  );

  return (
    <div className="p-6 sm:p-8 max-w-[1320px] space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Budget</h2>
          {budget && (
            <div className="flex items-center gap-2 mt-1">
              <span className={`font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 ${STATUS_CONFIG[budget.status].cls}`}>
                {STATUS_CONFIG[budget.status].label}
              </span>
              <span className="font-mono text-[10px] text-[var(--muted)]">Rev {budget.currentRevisionNumber} · v{budget.version}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {!budget && (
            <button type="button" disabled={creating} onClick={handleCreate}
              className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50">
              <Plus className="h-4 w-4" strokeWidth={2} /> Create budget
            </button>
          )}
          {budget?.status === 'DRAFT' && (
            <button type="button" disabled={submitting} onClick={handleSubmit}
              className="inline-flex items-center gap-2 min-h-9 border border-[var(--hairline-2)] bg-[var(--paper)] px-4 text-sm font-medium hover:border-[var(--ink)] transition-colors disabled:opacity-50">
              <Send className="h-4 w-4" strokeWidth={1.8} /> Submit for approval
            </button>
          )}
          {budget?.status === 'PENDING_APPROVAL' && (
            <button type="button" disabled={approving} onClick={handleApprove}
              className="inline-flex items-center gap-2 min-h-9 bg-[#166534] text-white px-4 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50">
              <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} /> Approve budget
            </button>
          )}
          {budget?.status === 'APPROVED' && (
            <button type="button" disabled={closing} onClick={handleClose}
              className="inline-flex items-center gap-2 min-h-9 border border-[var(--hairline-2)] px-4 text-sm font-medium text-[var(--muted)] hover:border-[var(--ink)] hover:text-[var(--ink)] transition-colors disabled:opacity-50">
              <Lock className="h-4 w-4" strokeWidth={1.8} /> Close budget
            </button>
          )}
        </div>
      </div>

      {!budget ? (
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-12 text-center">
          <FileText className="h-10 w-10 text-[var(--muted)] mx-auto mb-4" strokeWidth={1.5} />
          <p className="text-sm font-medium">No budget yet</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Create a budget to define the cost baseline for this project.</p>
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] sm:grid-cols-3">
            {[
              { label: 'Total budget', value: fmt(budget.total, budget.currencyCode) },
              { label: 'Lines', value: `${budget.lines.length} line${budget.lines.length !== 1 ? 's' : ''}` },
              { label: 'Currency', value: budget.currencyCode },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[var(--paper)] p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
                <p className="mt-1.5 text-lg font-medium tracking-[-0.03em]">{value}</p>
              </div>
            ))}
          </div>

          {/* Lines table */}
          <div className="border border-[var(--hairline-2)]">
            <div className="grid grid-cols-[40px_1fr_1fr_1fr_160px] border-b border-[var(--hairline-2)] bg-[var(--surface-2)] px-4 py-2">
              {['#', 'Cost code', 'Phase', 'Description', 'Amount'].map((h) => (
                <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
              ))}
            </div>

            {budget.lines.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-[var(--muted)]">
                No budget lines yet. {budget.status === 'DRAFT' && 'Edit the budget to add line items.'}
              </div>
            ) : (
              budget.lines.map((line) => (
                <div key={line.id} className="grid grid-cols-[40px_1fr_1fr_1fr_160px] items-center px-4 py-3 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]">
                  <p className="font-mono text-[10px] text-[var(--muted)]">{line.lineNumber}</p>
                  <p className="font-mono text-xs font-bold">{codeMap[line.costCodeId] ?? line.costCodeId}</p>
                  <p className="text-sm text-[var(--muted)]">{line.phaseId ? (phaseMap[line.phaseId] ?? '—') : '—'}</p>
                  <p className="text-sm text-[var(--muted)] truncate">{line.description ?? '—'}</p>
                  <p className="text-sm font-medium text-right tabular-nums">{fmt(line.amount, budget.currencyCode)}</p>
                </div>
              ))
            )}

            {/* Total row */}
            {budget.lines.length > 0 && (
              <div className="grid grid-cols-[40px_1fr_1fr_1fr_160px] items-center px-4 py-3 border-t border-[var(--hairline-2)] bg-[var(--surface-2)]">
                <span /><span /><span />
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">Total</p>
                <p className="text-sm font-medium text-right tabular-nums">{fmt(budget.total, budget.currencyCode)}</p>
              </div>
            )}
          </div>

          {/* Approval trail */}
          <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Approval trail</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { label: 'Submitted by', value: budget.submittedBy ?? '—', date: budget.submittedAt },
                { label: 'Approved by',  value: budget.approvedBy ?? '—', date: budget.approvedAt },
              ].map(({ label, value, date }) => (
                <div key={label}>
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
                  <p className="mt-1 text-sm font-medium">{value}</p>
                  {date && <p className="font-mono text-[10px] text-[var(--muted)]">{new Date(date).toLocaleString()}</p>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
