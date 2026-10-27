/**
 * ProjectTaskDetailPage — /org/:orgId/projects/:projectId/tasks/:taskId
 * Full task view: details, edit, status transition, dependency list.
 */
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Pencil, X, Check, Plus, Trash2 } from 'lucide-react';
import { cn } from '../lib/cn';
import {
  useGetTaskQuery,
  useUpdateTaskMutation,
  useTransitionTaskMutation,
  useDeleteTaskMutation,
  useListDependenciesQuery,
  useCreateDependencyMutation,
  useDeleteDependencyMutation,
  useListTasksQuery,
} from '../features/project/taskApi';
import { useListPhasesQuery } from '../features/project/phaseApi';
import { useListProjectMembersQuery } from '../features/project/projectMemberApi';
import { usePermission } from '../hooks/usePermission';
import { inputCls } from '../components/ui/FormField';
import { InlineAlert } from '../components/ui/InlineAlert';
import { useToast } from '../components/ui/Toast';
import { getServerError, isInlineError, toastErrorMessage } from '../lib/authErrors';
import type { TaskStatus, TaskPriority, DependencyType } from '../types/taskTypes';

const STATUS_BADGE: Record<TaskStatus, string> = {
  NOT_STARTED: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  READY:       'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
  IN_PROGRESS: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  BLOCKED:     'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
  COMPLETED:   'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  CANCELLED:   'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
};

const STATUS_STEPS: TaskStatus[] = ['NOT_STARTED', 'READY', 'IN_PROGRESS', 'COMPLETED'];
const NEXT_TRANSITIONS: Record<TaskStatus, Array<{ label: string; status: TaskStatus }>> = {
  NOT_STARTED: [{ label: 'Mark ready', status: 'READY' }, { label: 'Start', status: 'IN_PROGRESS' }],
  READY:       [{ label: 'Start', status: 'IN_PROGRESS' }, { label: 'Block', status: 'BLOCKED' }],
  IN_PROGRESS: [{ label: 'Complete', status: 'COMPLETED' }, { label: 'Block', status: 'BLOCKED' }],
  BLOCKED:     [{ label: 'Unblock', status: 'IN_PROGRESS' }, { label: 'Mark ready', status: 'READY' }],
  COMPLETED:   [],
  CANCELLED:   [],
};

export const ProjectTaskDetailPage: React.FC = () => {
  const { orgId, projectId, taskId } = useParams<{ orgId: string; projectId: string; taskId: string }>();
  const navigate = useNavigate();
  const canUpdate = usePermission('project.task.update');
  const canDelete = usePermission('project.task.delete');
  const { success: toastOk, error: toastErr } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [showAddDep, setShowAddDep] = useState(false);

  // Edit form state
  const [eName, setEName] = useState('');
  const [eDescription, setEDescription] = useState('');
  const [ePriority, setEPriority] = useState<TaskPriority>('NORMAL');
  const [eStart, setEStart] = useState('');
  const [eFinish, setEFinish] = useState('');
  const [eProgress, setEProgress] = useState(0);
  const [eAssignee, setEAssignee] = useState('');
  const [ePhase, setEPhase] = useState('');

  // Dependency form state
  const [depPredecessor, setDepPredecessor] = useState('');
  const [depSuccessor, setDepSuccessor] = useState('');
  const [depType, setDepType] = useState<DependencyType>('FS');
  const [depLag, setDepLag] = useState(0);

  const { data: task, isLoading } = useGetTaskQuery({ orgId: orgId!, projectId: projectId!, taskId: taskId! });
  const { data: depsData } = useListDependenciesQuery({ orgId: orgId!, projectId: projectId!, taskId: taskId! });
  const { data: allTasksData } = useListTasksQuery({ orgId: orgId!, projectId: projectId! });
  const { data: phasesData } = useListPhasesQuery({ orgId: orgId!, projectId: projectId! });
  const { data: membersData } = useListProjectMembersQuery({ orgId: orgId!, projectId: projectId! });

  const [updateTask, { isLoading: updating, error: updateErr }] = useUpdateTaskMutation();
  const [transitionTask, { isLoading: transitioning }] = useTransitionTaskMutation();
  const [deleteTask, { isLoading: deleting }] = useDeleteTaskMutation();
  const [createDep, { isLoading: creatingDep }] = useCreateDependencyMutation();
  const [deleteDep] = useDeleteDependencyMutation();

  const startEdit = () => {
    if (!task) return;
    setEName(task.name);
    setEDescription(task.description ?? '');
    setEPriority(task.priority);
    setEStart(task.currentStartDate ?? '');
    setEFinish(task.currentFinishDate ?? '');
    setEProgress(task.progressPercent);
    setEAssignee(task.assignedTo ?? '');
    setEPhase(task.phaseId ?? '');
    setIsEditing(true);
  };

  const onSave = async () => {
    if (!task) return;
    try {
      await updateTask({
        orgId: orgId!, projectId: projectId!, taskId: taskId!,
        input: {
          name: eName,
          description: eDescription || null,
          priority: ePriority,
          phaseId: ePhase || null,
          assignedTo: eAssignee || null,
          currentStartDate: task.taskType !== 'SUMMARY' ? (eStart || null) : undefined,
          currentFinishDate: task.taskType !== 'SUMMARY' ? (eFinish || null) : undefined,
          progressPercent: task.taskType !== 'SUMMARY' ? eProgress : undefined,
          expectedVersion: task.version,
        },
      }).unwrap();
      toastOk('Task updated', '');
      setIsEditing(false);
    } catch (err) {
      toastErr('Update failed', toastErrorMessage(err as never));
    }
  };

  const onTransition = async (status: TaskStatus) => {
    if (!task) return;
    try {
      await transitionTask({ orgId: orgId!, projectId: projectId!, taskId: taskId!, input: { status, expectedVersion: task.version } }).unwrap();
      toastOk(`Marked ${status.replace('_', ' ').toLowerCase()}`, '');
    } catch (err) {
      toastErr('Transition failed', toastErrorMessage(err as never));
    }
  };

  const onDelete = async () => {
    if (!task) return;
    if (!confirm('Cancel this task? This cannot be undone.')) return;
    try {
      await deleteTask({ orgId: orgId!, projectId: projectId!, taskId: taskId!, expectedVersion: task.version }).unwrap();
      toastOk('Task cancelled', '');
      navigate(`/org/${orgId}/projects/${projectId}/tasks`);
    } catch (err) {
      toastErr('Delete failed', toastErrorMessage(err as never));
    }
  };

  const onAddDep = async () => {
    if (!depPredecessor || !depSuccessor) { toastErr('Both tasks required', ''); return; }
    try {
      await createDep({ orgId: orgId!, projectId: projectId!, input: { predecessorTaskId: depPredecessor, successorTaskId: depSuccessor, dependencyType: depType, lagDays: depLag } }).unwrap();
      toastOk('Dependency added', '');
      setShowAddDep(false); setDepPredecessor(''); setDepSuccessor(''); setDepType('FS'); setDepLag(0);
    } catch (err) {
      toastErr('Add failed', toastErrorMessage(err as never));
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 sm:p-8 space-y-3">
        {[1, 2].map((i) => <div key={i} className="h-20 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]" />)}
      </div>
    );
  }

  if (!task) {
    return <div className="p-6 sm:p-8"><p className="text-sm text-[var(--muted)]">Task not found.</p></div>;
  }

  const deps = depsData ?? [];
  const allTasks = allTasksData?.tasks ?? [];
  const otherTasks = allTasks.filter((t) => t.id !== taskId);
  const phaseName = phasesData?.phases.find((p) => p.id === task.phaseId)?.name;
  const memberName = (uid: string | null) => {
    if (!uid) return null;
    const m = membersData?.members.find((m) => m.userId === uid);
    return m ? `${m.user.firstName} ${m.user.lastName ?? ''}`.trim() : uid;
  };
  const taskName = (id: string) => allTasks.find((t) => t.id === id)?.name ?? id;
  const nexts = NEXT_TRANSITIONS[task.status];

  return (
    <div className="p-6 sm:p-8 max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--hairline-2)]">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">Task · {task.taskCode}</p>
          <h1 className="mt-1 text-2xl font-medium tracking-[-0.04em] leading-snug">{task.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className={cn('font-mono text-[9px] uppercase tracking-[0.12em] border px-2 py-0.5', STATUS_BADGE[task.status])}>
              {task.status.replace('_', ' ')}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] border border-[var(--hairline-2)] px-2 py-0.5 text-[var(--muted)]">
              {task.taskType}
            </span>
            {task.isCritical && (
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] border border-[#fecaca] bg-[#fef2f2] text-[#991b1b] px-1.5 py-0.5">critical path</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {canUpdate && !isEditing && task.status !== 'CANCELLED' && (
            <button type="button" onClick={startEdit}
              className="inline-flex items-center gap-1.5 border border-[var(--hairline-2)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface-2)] transition-colors">
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} /> Edit
            </button>
          )}
          {nexts.map((t) => (
            <button key={t.status} type="button" disabled={transitioning} onClick={() => onTransition(t.status)}
              className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50">
              {t.label}
            </button>
          ))}
          {canDelete && task.status !== 'CANCELLED' && (
            <button type="button" onClick={onDelete} disabled={deleting}
              className="inline-flex items-center gap-1.5 border border-[#fecaca] bg-[#fef2f2] text-[#991b1b] px-3 py-1.5 text-sm font-medium hover:bg-[#fee2e2] transition-colors disabled:opacity-50">
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} /> Cancel
            </button>
          )}
        </div>
      </div>

      {/* Status pipeline */}
      <div className="flex items-center gap-0">
        {STATUS_STEPS.map((step, idx) => {
          const active = task.status === step;
          const done = STATUS_STEPS.indexOf(task.status) > idx;
          return (
            <React.Fragment key={step}>
              <div className={cn(
                'flex items-center gap-2 px-3 py-1.5 border',
                active ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
                  : done ? 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]'
                  : 'border-[var(--hairline-2)] bg-[var(--paper)] text-[var(--muted)]',
              )}>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em]">{step.replace('_', ' ')}</span>
              </div>
              {idx < STATUS_STEPS.length - 1 && (
                <ArrowRight className="h-3.5 w-3.5 text-[var(--muted)] shrink-0" strokeWidth={1.5} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Edit form */}
      {isEditing && (
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Edit task</p>
          {isInlineError(updateErr) && (
            <InlineAlert variant="error" message={getServerError(updateErr)?.message ?? 'Error'} />
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Name *</label>
              <input value={eName} onChange={(e) => setEName(e.target.value)} className={inputCls()} />
            </div>
            <div className="col-span-2">
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Description</label>
              <textarea value={eDescription} onChange={(e) => setEDescription(e.target.value)} rows={2} maxLength={2000}
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Priority</label>
              <select value={ePriority} onChange={(e) => setEPriority(e.target.value as TaskPriority)} className={inputCls()}>
                {(['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Phase</label>
              <select value={ePhase} onChange={(e) => setEPhase(e.target.value)} className={inputCls()}>
                <option value="">No phase</option>
                {(phasesData?.phases ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {task.taskType !== 'SUMMARY' && (
              <>
                <div>
                  <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Start date</label>
                  <input type="date" value={eStart} onChange={(e) => setEStart(e.target.value)} className={inputCls()} />
                </div>
                <div>
                  <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Finish date</label>
                  <input type="date" value={eFinish} onChange={(e) => setEFinish(e.target.value)} className={inputCls()} />
                </div>
                <div>
                  <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Progress %</label>
                  <input type="number" min={0} max={100} value={eProgress} onChange={(e) => setEProgress(Number(e.target.value))} className={inputCls()} />
                </div>
              </>
            )}
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Assigned to</label>
              <select value={eAssignee} onChange={(e) => setEAssignee(e.target.value)} className={inputCls()}>
                <option value="">Unassigned</option>
                {(membersData?.members ?? []).map((m) => (
                  <option key={m.userId} value={m.userId}>{m.user.firstName} {m.user.lastName ?? ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onSave} disabled={updating}
              className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0">
              {updating ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" onClick={() => setIsEditing(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Details (read view) */}
      {!isEditing && (
        <div className="grid gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Phase',    value: phaseName ?? '—' },
            { label: 'Priority', value: task.priority },
            { label: 'Assigned', value: memberName(task.assignedTo) ?? 'Unassigned' },
            { label: 'Progress', value: `${task.progressPercent}%` },
            { label: 'Start',    value: task.currentStartDate ?? '—' },
            { label: 'Finish',   value: task.currentFinishDate ?? '—' },
            { label: 'Duration', value: task.taskType === 'MILESTONE' ? '0 days (milestone)' : `${task.currentDurationDays} day${task.currentDurationDays !== 1 ? 's' : ''}` },
            { label: 'Constraint', value: task.constraintType + (task.constraintDate ? ` · ${task.constraintDate}` : '') },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[var(--paper)] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
              <p className="mt-1.5 text-sm font-medium">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Description */}
      {!isEditing && task.description && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-2">Description</p>
          <p className="text-sm">{task.description}</p>
        </div>
      )}

      {/* Parent task link */}
      {task.parentTaskId && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-2">Part of</p>
          <Link
            to={`/org/${orgId}/projects/${projectId}/tasks/${task.parentTaskId}`}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
          >
            {taskName(task.parentTaskId)}
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Link>
        </div>
      )}

      {/* Dependencies */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Dependencies</p>
          {canUpdate && (
            <button type="button" onClick={() => setShowAddDep((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-medium border border-[var(--hairline-2)] px-3 py-1.5 hover:bg-[var(--surface-2)] transition-colors">
              <Plus className="h-3 w-3" strokeWidth={2} /> Add
            </button>
          )}
        </div>

        {showAddDep && (
          <div className="mb-4 border border-[var(--hairline-2)] bg-[var(--paper)] p-4 space-y-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">New dependency</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Predecessor</label>
                <select value={depPredecessor} onChange={(e) => setDepPredecessor(e.target.value)} className={inputCls()}>
                  <option value="">Select…</option>
                  {otherTasks.map((t) => <option key={t.id} value={t.id}>{t.taskCode} — {t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Successor</label>
                <select value={depSuccessor} onChange={(e) => setDepSuccessor(e.target.value)} className={inputCls()}>
                  <option value="">Select…</option>
                  {otherTasks.map((t) => <option key={t.id} value={t.id}>{t.taskCode} — {t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Type</label>
                <select value={depType} onChange={(e) => setDepType(e.target.value as DependencyType)} className={inputCls()}>
                  {(['FS','SS','FF','SF'] as DependencyType[]).map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Lag (days)</label>
                <input type="number" value={depLag} onChange={(e) => setDepLag(Number(e.target.value))} className={inputCls()} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={onAddDep} disabled={creatingDep}
                className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50">
                {creatingDep ? 'Adding…' : 'Add'}
              </button>
              <button type="button" onClick={() => setShowAddDep(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
            </div>
          </div>
        )}

        <div className="border border-[var(--hairline-2)]">
          {deps.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">No dependencies.</div>
          ) : (
            deps.map((dep) => (
              <div key={dep.id} className="flex items-center gap-4 px-4 py-3 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]">
                <p className="text-sm flex-1 truncate">
                  <span className="text-[var(--muted)]">{taskName(dep.predecessorTaskId)}</span>
                  <ArrowRight className="inline h-3.5 w-3.5 mx-2 text-[var(--muted)]" strokeWidth={1.5} />
                  <span className="font-medium">{taskName(dep.successorTaskId)}</span>
                </p>
                <span className="font-mono text-[9px] uppercase border border-[var(--hairline-2)] px-1.5 py-0.5 text-[var(--muted)]">{dep.dependencyType}</span>
                {dep.lagDays !== 0 && (
                  <span className="font-mono text-[9px] text-[var(--muted)]">+{dep.lagDays}d</span>
                )}
                {canUpdate && (
                  <button type="button"
                    onClick={async () => {
                      await deleteDep({ orgId: orgId!, projectId: projectId!, dependencyId: dep.id });
                      toastOk('Dependency removed', '');
                    }}
                    className="p-1 text-[var(--muted)] hover:text-[#991b1b] transition-colors">
                    <X className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
