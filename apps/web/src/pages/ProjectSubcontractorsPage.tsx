/**
 * ProjectSubcontractorsPage — /org/:orgId/projects/:projectId/subcontractors
 * Project-level: assign an org subcontractor, manage scope/value/dates,
 * manage task assignments, view performance.
 *
 * Backend:
 *   GET    /:orgId/projects/:projectId/subcontractors                                 permission: project.subcontractor.read
 *   POST   /:orgId/projects/:projectId/subcontractors                                 permission: project.subcontractor.create
 *   GET    /:orgId/projects/:projectId/subcontractors/:subcontractorId                permission: project.subcontractor.read
 *   PATCH  /:orgId/projects/:projectId/subcontractors/:subcontractorId                permission: project.subcontractor.update
 *   POST   /:orgId/projects/:projectId/subcontractors/:subcontractorId/task-assignments  permission: project.subcontractor.assign
 *   DELETE /:orgId/projects/:projectId/subcontractors/:subcontractorId/task-assignments/:taskId  permission: project.subcontractor.assign
 *   GET    /:orgId/projects/:projectId/performance/subcontractors/:subcontractorId    permission: project.performance.read
 *
 * Validation: packages/shared/src/modules/project/subcontractor.schema.ts
 *   scopeDescription: max:2000
 *   contractValue:    regex /^\d+(\.\d{1,2})?$/
 *   currencyCode:     len:3
 *   startDate/endDate: YYYY-MM-DD  (DB check: endDate >= startDate)
 *   assignmentRole:   max:200
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, X, ChevronDown, ChevronRight, HardHat, TrendingUp } from 'lucide-react';
import { cn } from '../lib/cn';
import {
  useListProjectSubcontractorsQuery,
  useAssignSubcontractorToProjectMutation,
  useUpdateProjectSubcontractorMutation,
  useListTaskAssignmentsQuery,
  useAssignTaskToSubcontractorMutation,
  useRemoveTaskFromSubcontractorMutation,
  useGetSubcontractorPerformanceQuery,
  useListSubcontractorsQuery,
} from '../api/subcontractorApi';
import { useListTasksQuery } from '../features/project/taskApi';
import { usePermission } from '../hooks/usePermission';
import { InlineAlert } from '../components/ui/InlineAlert';
import { useToast } from '../components/ui/Toast';
import {
  getServerError,
  isInlineError,
  isToastError,
  toastErrorMessage,
} from '../lib/authErrors';
import { inputCls } from '../components/ui/FormField';
import type { ProjectSubcontractorStatus, PerformanceEventType } from '../types/subcontractorTypes';

// ── Performance badge config ──────────────────────────────────────────────────

const PERF_BADGE: Record<string, string> = {
  TASK_COMPLETE_ON_TIME: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  TASK_COMPLETE_LATE:    'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  DELIVERY_ON_TIME:      'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  DELIVERY_LATE:         'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  RECEIPT_REJECTION:     'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
};

const STATUS_BADGE: Record<ProjectSubcontractorStatus, string> = {
  ACTIVE:   'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  INACTIVE: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
};

// ── Detail drawer (assignments + performance) ─────────────────────────────────

const SubcontractorDrawer: React.FC<{
  orgId: string;
  projectId: string;
  subcontractorId: string;
}> = ({ orgId, projectId, subcontractorId }) => {
  const canAssign = usePermission('project.subcontractor.assign');
  const { success: toastOk, error: toastErr } = useToast();
  const [tab, setTab] = useState<'assignments' | 'performance'>('assignments');
  const [showAddTask, setShowAddTask] = useState(false);
  const [selTaskId, setSelTaskId] = useState('');
  const [selRole, setSelRole] = useState('');

  const { data: assignments = [] } = useListTaskAssignmentsQuery({ orgId, projectId, subcontractorId });
  const { data: perfData } = useGetSubcontractorPerformanceQuery({ orgId, projectId, subcontractorId });
  const { data: allTasks } = useListTasksQuery({ orgId, projectId });

  const [assignTask, { isLoading: assigning, error: assignErr }] = useAssignTaskToSubcontractorMutation();
  const [removeTask] = useRemoveTaskFromSubcontractorMutation();

  const taskName = (taskId: string) => {
    const t = allTasks?.tasks.find((x) => x.id === taskId);
    return t ? `${t.taskCode} — ${t.name}` : taskId;
  };

  const assignedTaskIds = new Set(assignments.map((a) => a.taskId));
  const availableTasks = (allTasks?.tasks ?? []).filter(
    (t) => t.taskType !== 'SUMMARY' && t.status !== 'CANCELLED' && !assignedTaskIds.has(t.id),
  );

  const onAssign = async () => {
    if (!selTaskId) { toastErr('Task required', ''); return; }
    try {
      await assignTask({ orgId, projectId, subcontractorId, input: { taskId: selTaskId, assignmentRole: selRole || undefined } }).unwrap();
      toastOk('Task assigned', '');
      setShowAddTask(false); setSelTaskId(''); setSelRole('');
    } catch (err) {
      if (isToastError(err as never)) toastErr('Assign failed', toastErrorMessage(err as never));
    }
  };

  const onRemove = async (taskId: string) => {
    try {
      await removeTask({ orgId, projectId, subcontractorId, taskId }).unwrap();
      toastOk('Assignment removed', '');
    } catch (err) {
      toastErr('Remove failed', toastErrorMessage(err as never));
    }
  };

  const events = perfData?.data ?? [];

  return (
    <div className="border-t border-[var(--hairline-2)] bg-[var(--surface-2)]">
      {/* Tabs */}
      <div className="flex border-b border-[var(--hairline-2)] px-6">
        {(['assignments', 'performance'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-2 font-mono text-[9px] uppercase tracking-[0.12em] border-b-2 transition-colors ${
              tab === t ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Task assignments tab */}
      {tab === 'assignments' && (
        <div className="px-6 py-4 space-y-3">
          {canAssign && !showAddTask && (
            <button type="button" onClick={() => setShowAddTask(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium border border-[var(--hairline-2)] px-3 py-1.5 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
              <Plus className="h-3 w-3" strokeWidth={2} /> Assign task
            </button>
          )}

          {showAddTask && (
            <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-4 space-y-3">
              {isInlineError(assignErr) && (
                <InlineAlert variant="error" message={getServerError(assignErr)?.message ?? 'Error'} />
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Task *</label>
                  <select value={selTaskId} onChange={(e) => setSelTaskId(e.target.value)} className={inputCls()}>
                    <option value="">Select task…</option>
                    {availableTasks.map((t) => (
                      <option key={t.id} value={t.id}>{t.taskCode} — {t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Role</label>
                  <input type="text" value={selRole} onChange={(e) => setSelRole(e.target.value)}
                    placeholder="e.g. Main contractor" maxLength={200} className={inputCls()} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={onAssign} disabled={assigning}
                  className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50">
                  {assigning ? 'Assigning…' : 'Assign'}
                </button>
                <button type="button" onClick={() => setShowAddTask(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
              </div>
            </div>
          )}

          {assignments.length === 0 ? (
            <p className="text-sm text-[var(--muted)] py-2">No tasks assigned yet.</p>
          ) : (
            <div className="border border-[var(--hairline-2)] bg-[var(--paper)]">
              {assignments.map((a) => (
                <div key={a.id} className="flex items-center gap-4 px-4 py-3 border-b border-[var(--hairline-2)] last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{taskName(a.taskId)}</p>
                    {a.assignmentRole && (
                      <p className="font-mono text-[9px] text-[var(--muted)]">{a.assignmentRole}</p>
                    )}
                  </div>
                  {canAssign && (
                    <button type="button" onClick={() => onRemove(a.taskId)}
                      className="p-1 text-[var(--muted)] hover:text-[#991b1b] transition-colors">
                      <X className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Performance tab */}
      {tab === 'performance' && (
        <div className="px-6 py-4">
          {events.length === 0 ? (
            <div className="flex items-center gap-2 py-4 text-sm text-[var(--muted)]">
              <TrendingUp className="h-4 w-4" strokeWidth={1.5} />
              No performance events recorded yet.
            </div>
          ) : (
            <div className="border border-[var(--hairline-2)] bg-[var(--paper)]">
              <div className="grid grid-cols-[110px_90px_2fr_90px_80px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
                {['Date', 'Source', 'Notes', 'Metric', 'Event'].map((h) => (
                  <p key={h} className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">{h}</p>
                ))}
              </div>
              {events.map((e) => (
                <div key={e.id} className="grid grid-cols-[110px_90px_2fr_90px_80px] gap-3 items-center px-4 py-3 border-b border-[var(--hairline-2)] last:border-b-0">
                  <p className="font-mono text-[10px] text-[var(--muted)]">
                    {new Date(e.occurredAt).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                  </p>
                  <p className="font-mono text-[9px] text-[var(--muted)] uppercase">{e.sourceType}</p>
                  <p className="text-sm text-[var(--muted)] truncate">{e.notes ?? '—'}</p>
                  <p className="font-mono text-[10px]">
                    {e.metricValue !== null ? `${e.metricValue}${e.unit ? ' ' + e.unit : ''}` : '—'}
                  </p>
                  <span className={`inline-block font-mono text-[8px] uppercase tracking-[0.1em] border px-1.5 py-0.5 w-fit ${PERF_BADGE[e.eventType] ?? 'border-[var(--hairline-2)] text-[var(--muted)]'}`}>
                    {e.eventType.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

export const ProjectSubcontractorsPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const canCreate = usePermission('project.subcontractor.create');
  const canUpdate = usePermission('project.subcontractor.update');
  const { success: toastOk, error: toastErr } = useToast();

  const [showAssign, setShowAssign] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Assign form state
  const [selSubId, setSelSubId]     = useState('');
  const [scope, setScope]           = useState('');
  const [contractValue, setContractValue] = useState('');
  const [currencyCode, setCurrencyCode]   = useState('PKR');
  const [startDate, setStartDate]   = useState('');
  const [endDate, setEndDate]       = useState('');

  // Edit form state
  const [eScope, setEScope]             = useState('');
  const [eContractValue, setEContractValue] = useState('');
  const [eCurrency, setECurrency]       = useState('PKR');
  const [eStart, setEStart]             = useState('');
  const [eEnd, setEEnd]                 = useState('');
  const [eStatus, setEStatus]           = useState<ProjectSubcontractorStatus>('ACTIVE');

  const { data: projectSubs = [], isLoading } = useListProjectSubcontractorsQuery({ orgId: orgId!, projectId: projectId! });
  const { data: orgSubsData } = useListSubcontractorsQuery({ orgId: orgId!, status: 'ACTIVE' });

  const [assignToProject, { isLoading: assigning, error: assignErr }] = useAssignSubcontractorToProjectMutation();
  const [updateProjectSub, { isLoading: updating }] = useUpdateProjectSubcontractorMutation();

  const assignedIds = new Set(projectSubs.map((ps) => ps.subcontractorId));
  const availableSubs = (orgSubsData?.data ?? []).filter((s) => !assignedIds.has(s.id));

  const onAssign = async () => {
    if (!selSubId) { toastErr('Subcontractor required', ''); return; }
    try {
      await assignToProject({
        orgId: orgId!, projectId: projectId!,
        input: {
          subcontractorId: selSubId,
          scopeDescription: scope.trim() || undefined,
          contractValue: contractValue.trim() || undefined,
          currencyCode: currencyCode.trim() || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      }).unwrap();
      toastOk('Subcontractor assigned', '');
      setShowAssign(false);
      setSelSubId(''); setScope(''); setContractValue(''); setCurrencyCode('PKR'); setStartDate(''); setEndDate('');
    } catch (err) {
      if (isToastError(err as never)) toastErr('Assign failed', toastErrorMessage(err as never));
    }
  };

  const startEditPS = (ps: typeof projectSubs[0]) => {
    setEScope(ps.scopeDescription ?? '');
    setEContractValue(ps.contractValue ?? '');
    setECurrency(ps.currencyCode ?? 'PKR');
    setEStart(ps.startDate ?? '');
    setEEnd(ps.endDate ?? '');
    setEStatus(ps.status);
    setEditingId(ps.subcontractorId);
  };

  const onUpdatePS = async (subcontractorId: string) => {
    try {
      await updateProjectSub({
        orgId: orgId!, projectId: projectId!, subcontractorId,
        input: {
          status: eStatus,
          scopeDescription: eScope || undefined,
          contractValue: eContractValue || null,
          currencyCode: eCurrency || undefined,
          startDate: eStart || null,
          endDate: eEnd || null,
        },
      }).unwrap();
      toastOk('Updated', '');
      setEditingId(null);
    } catch (err) {
      toastErr('Update failed', toastErrorMessage(err as never));
    }
  };

  return (
    <div className="p-6 sm:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Subcontractors</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {projectSubs.length} assigned to this project
          </p>
        </div>
        {canCreate && !showAssign && (
          <button type="button" onClick={() => setShowAssign(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0">
            <Plus className="h-4 w-4" strokeWidth={2} /> Assign subcontractor
          </button>
        )}
      </div>

      {/* Assign panel */}
      {showAssign && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Assign subcontractor</p>
          {isInlineError(assignErr) && (
            <InlineAlert variant="error" message={getServerError(assignErr)?.message ?? 'Error'} />
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Subcontractor *</label>
              <select value={selSubId} onChange={(e) => setSelSubId(e.target.value)} className={inputCls()}>
                <option value="">Select subcontractor…</option>
                {availableSubs.map((s) => (
                  <option key={s.id} value={s.id}>{s.displayName} — {s.trade ?? 'General'}</option>
                ))}
              </select>
              {availableSubs.length === 0 && (
                <p className="mt-1 font-mono text-[9px] text-[var(--muted)]">All active subcontractors are already assigned.</p>
              )}
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Currency</label>
              <input type="text" value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())} maxLength={3} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Contract value</label>
              <input type="text" value={contractValue} onChange={(e) => setContractValue(e.target.value)}
                placeholder="e.g. 1500000.00" className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls()} />
            </div>
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Scope description</label>
            <textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={2} maxLength={2000}
              placeholder="Works covered by this subcontract…"
              className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onAssign} disabled={assigning}
              className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0">
              {assigning ? 'Assigning…' : 'Assign'}
            </button>
            <button type="button" onClick={() => setShowAssign(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="border border-[var(--hairline-2)]">
        {isLoading ? (
          [1, 2].map((i) => <div key={i} className="h-14 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />)
        ) : projectSubs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <HardHat className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No subcontractors assigned to this project.</p>
          </div>
        ) : (
          projectSubs.map((ps) => (
            <div key={ps.id}>
              {/* Row */}
              {editingId === ps.subcontractorId ? (
                /* Edit inline */
                <div className="px-4 py-4 border-b border-[var(--hairline-2)] bg-[var(--surface-2)] space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Status</label>
                      <select value={eStatus} onChange={(e) => setEStatus(e.target.value as ProjectSubcontractorStatus)} className={inputCls()}>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Contract value</label>
                      <input type="text" value={eContractValue} onChange={(e) => setEContractValue(e.target.value)} className={inputCls()} />
                    </div>
                    <div>
                      <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Currency</label>
                      <input type="text" value={eCurrency} onChange={(e) => setECurrency(e.target.value.toUpperCase())} maxLength={3} className={inputCls()} />
                    </div>
                    <div>
                      <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Start date</label>
                      <input type="date" value={eStart} onChange={(e) => setEStart(e.target.value)} className={inputCls()} />
                    </div>
                    <div>
                      <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">End date</label>
                      <input type="date" value={eEnd} onChange={(e) => setEEnd(e.target.value)} className={inputCls()} />
                    </div>
                  </div>
                  <div>
                    <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Scope</label>
                    <textarea value={eScope} onChange={(e) => setEScope(e.target.value)} rows={2} maxLength={2000}
                      className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => onUpdatePS(ps.subcontractorId)} disabled={updating}
                      className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50">
                      {updating ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3.5 border-b border-[var(--hairline-2)] bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Expand toggle */}
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === ps.subcontractorId ? null : ps.subcontractorId)}
                      className="mt-0.5 p-0.5 text-[var(--muted)] hover:text-[var(--ink)] transition-colors shrink-0"
                    >
                      {expandedId === ps.subcontractorId
                        ? <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
                        : <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="text-sm font-medium">{ps.subcontractor.displayName}</p>
                        <span className={`font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 ${STATUS_BADGE[ps.status]}`}>
                          {ps.status}
                        </span>
                        {ps.subcontractor.trade && (
                          <span className="font-mono text-[9px] text-[var(--muted)]">{ps.subcontractor.trade}</span>
                        )}
                      </div>
                      {ps.scopeDescription && (
                        <p className="text-sm text-[var(--muted)] truncate">{ps.scopeDescription}</p>
                      )}
                      <div className="flex items-center gap-4 mt-1">
                        {ps.contractValue && (
                          <p className="font-mono text-[10px] text-[var(--muted)]">
                            {ps.currencyCode ?? ''} {parseFloat(ps.contractValue).toLocaleString()}
                          </p>
                        )}
                        {ps.startDate && (
                          <p className="font-mono text-[10px] text-[var(--muted)]">
                            {ps.startDate} → {ps.endDate ?? 'ongoing'}
                          </p>
                        )}
                      </div>
                    </div>

                    {canUpdate && (
                      <button type="button" onClick={() => startEditPS(ps)}
                        className="font-mono text-[9px] uppercase tracking-[0.12em] border border-[var(--hairline-2)] px-2 py-1 hover:bg-[var(--surface-2)] transition-colors shrink-0">
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Expanded drawer */}
              {expandedId === ps.subcontractorId && editingId !== ps.subcontractorId && (
                <SubcontractorDrawer
                  orgId={orgId!}
                  projectId={projectId!}
                  subcontractorId={ps.subcontractorId}
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
