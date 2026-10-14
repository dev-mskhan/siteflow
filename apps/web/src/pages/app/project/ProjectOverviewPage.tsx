/**
 * ProjectOverviewPage — index tab of /org/:orgId/projects/:projectId
 * Shows: key stats, budget summary, team preview, lifecycle actions.
 */
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowUpRight, Play, PauseCircle, CheckCircle2, XCircle, Archive } from 'lucide-react';
import { useActiveProject } from '../../../features/project/useActiveProject';
import { useTransitionProjectMutation } from '../../../features/project/projectApi';
import { useListBudgetsQuery, useGetBudgetSummaryQuery } from '../../../features/project/budgetApi';
import { useListProjectMembersQuery } from '../../../features/project/projectMemberApi';
import { ProjectRoleBadge } from '../../../components/project/ProjectRoleBadge';
import { InlineAlert } from '../../../components/ui/InlineAlert';
import { useToast } from '../../../components/ui/Toast';
import { toastErrorMessage } from '../../../lib/authErrors';
import type { ProjectTransition } from '../../../features/project/projectTypes';

function formatMoney(val: string, currency: string): string {
  const n = parseFloat(val);
  if (currency === 'PKR') return `PKR ${new Intl.NumberFormat('en-PK').format(n)}`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));
}

type TransitionBtn = { label: string; transition: ProjectTransition; icon: React.ElementType; danger?: boolean };

const TRANSITION_MAP: Record<string, TransitionBtn[]> = {
  DRAFT:     [{ label: 'Activate', transition: 'activate', icon: Play }],
  ACTIVE:    [
    { label: 'Put on hold', transition: 'hold', icon: PauseCircle },
    { label: 'Mark complete', transition: 'complete', icon: CheckCircle2 },
    { label: 'Cancel', transition: 'cancel', icon: XCircle, danger: true },
  ],
  ON_HOLD:   [
    { label: 'Resume', transition: 'resume', icon: Play },
    { label: 'Cancel', transition: 'cancel', icon: XCircle, danger: true },
  ],
  COMPLETED: [{ label: 'Archive', transition: 'archive', icon: Archive }],
  CANCELLED: [{ label: 'Archive', transition: 'archive', icon: Archive }],
  ARCHIVED:  [],
};

export const ProjectOverviewPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { activeProject } = useActiveProject();
  const { error: toastErr } = useToast();
  const [confirmTransition, setConfirmTransition] = useState<ProjectTransition | null>(null);

  const { data: budgetData } = useListBudgetsQuery({ orgId: orgId!, projectId: projectId! });
  const budget = budgetData?.budgets[0];
  const { data: summaryData } = useGetBudgetSummaryQuery(
    { orgId: orgId!, projectId: projectId!, budgetId: budget?.id ?? '' },
    { skip: !budget },
  );
  const { data: membersData } = useListProjectMembersQuery({ orgId: orgId!, projectId: projectId! });

  const [transition, { isLoading: transitioning }] = useTransitionProjectMutation();

  if (!activeProject) return null;

  const transitions = TRANSITION_MAP[activeProject.status] ?? [];
  const members = membersData?.members ?? [];

  const handleTransition = async (t: ProjectTransition) => {
    if (t === 'cancel' || t === 'archive') {
      setConfirmTransition(t);
      return;
    }
    await doTransition(t);
  };

  const doTransition = async (t: ProjectTransition) => {
    setConfirmTransition(null);
    try {
      await transition({ orgId: orgId!, projectId: projectId!, transition: t }).unwrap();
    } catch (err) {
      toastErr('Transition failed', toastErrorMessage(err as never));
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-[1320px] space-y-8">

      {/* Key metrics */}
      <div className="grid gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] sm:grid-cols-4">
        {[
          { label: 'Contract value', value: activeProject.contractValue ? formatMoney(activeProject.contractValue, activeProject.currency) : '—' },
          { label: 'Planned start',  value: formatDate(activeProject.plannedStartDate) },
          { label: 'Planned end',    value: formatDate(activeProject.plannedEndDate) },
          { label: 'Actual start',   value: formatDate(activeProject.actualStartDate) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[var(--paper)] p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-lg font-medium tracking-[-0.03em]">{value}</p>
          </div>
        ))}
      </div>

      {/* Budget summary */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Budget</p>
          <Link to={`/org/${orgId}/projects/${projectId}/budget`} className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] hover:text-[var(--ink)] transition-colors flex items-center gap-1">
            View detail <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
          </Link>
        </div>
        {!budget ? (
          <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5 text-sm text-[var(--muted)]">
            No budget created yet.{' '}
            <Link to={`/org/${orgId}/projects/${projectId}/budget`} className="underline underline-offset-4 hover:text-[var(--ink)] transition-colors">Create one →</Link>
          </div>
        ) : (
          <div className="grid gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] sm:grid-cols-4">
            {[
              { label: 'Status',    value: budget.status.replace('_', ' ') },
              { label: 'Original',  value: summaryData ? formatMoney(summaryData.summary.original, budget.currencyCode) : '—' },
              { label: 'Changes',   value: summaryData ? formatMoney(summaryData.summary.approvedChanges, budget.currencyCode) : '—' },
              { label: 'Revised',   value: summaryData ? formatMoney(summaryData.summary.revised, budget.currencyCode) : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[var(--paper)] p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
                <p className="mt-2 text-base font-medium">{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team preview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Team</p>
          <Link to={`/org/${orgId}/projects/${projectId}/team`} className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] hover:text-[var(--ink)] transition-colors flex items-center gap-1">
            Manage <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
          </Link>
        </div>
        <div className="border border-[var(--hairline-2)] divide-y divide-[var(--hairline-2)]">
          {members.slice(0, 5).map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[var(--ink)] text-white font-mono text-[10px] font-bold">
                {[m.user.firstName[0], m.user.lastName?.[0]].filter(Boolean).join('').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--ink)] truncate">{m.user.firstName} {m.user.lastName}</p>
                <p className="font-mono text-[10px] text-[var(--muted)] truncate">{m.user.email}</p>
              </div>
              <ProjectRoleBadge role={m.role} />
            </div>
          ))}
          {members.length === 0 && (
            <div className="px-4 py-6 text-sm text-[var(--muted)] text-center">No team members yet.</div>
          )}
        </div>
      </div>

      {/* Lifecycle actions */}
      {transitions.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-3">Actions</p>
          <div className="flex flex-wrap gap-2">
            {transitions.map(({ label, transition: t, icon: Icon, danger }) => (
              <button
                key={t}
                type="button"
                disabled={transitioning}
                onClick={() => handleTransition(t)}
                className={cn(
                  'inline-flex items-center gap-2 min-h-9 px-4 text-sm font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                  danger
                    ? 'border-[#fecaca] bg-[#fef2f2] text-[#991b1b] hover:bg-[#fee2e2]'
                    : 'border-[var(--hairline-2)] bg-[var(--paper)] text-[var(--ink)] hover:border-[var(--ink)] hover:bg-[var(--surface-2)]',
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Confirm modal for destructive transitions */}
      {confirmTransition && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--ink)]/60 px-4">
          <div className="w-full max-w-sm border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-4">
            <h3 className="text-base font-medium">Confirm {confirmTransition}</h3>
            <p className="text-sm text-[var(--muted)]">
              This action will {confirmTransition === 'cancel' ? 'cancel' : 'archive'} the project.
              {confirmTransition === 'cancel' && ' This cannot be undone without creating a new project.'}
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => doTransition(confirmTransition)} className="flex-1 min-h-10 bg-[#991b1b] text-white text-sm font-medium hover:opacity-80 transition-opacity">
                Confirm
              </button>
              <button type="button" onClick={() => setConfirmTransition(null)} className="flex-1 min-h-10 border border-[var(--hairline-2)] text-sm font-medium text-[var(--muted)] hover:border-[var(--ink)] hover:text-[var(--ink)] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
