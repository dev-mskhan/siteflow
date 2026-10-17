/**
 * ProjectTasksPage — /org/:orgId/projects/:projectId/tasks
 * WBS flat-list with status filters, inline create, row actions.
 * Backend: apps/server/src/modules/project/task/task.handler.ts
 * Schemas:  packages/shared/src/modules/project/task.schema.ts
 */
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, ListChecks, ChevronRight } from 'lucide-react';
import { cn } from '../lib/cn';
import {
  useListTasksQuery,
  useCreateTaskMutation,
  useTransitionTaskMutation,
} from '../api/taskApi';
import { useListPhasesQuery } from '../features/project/phaseApi';
import { useListProjectMembersQuery } from '../features/project/projectMemberApi';
import { usePermission } from '../hooks/usePermission';
import { inputCls } from '../components/ui/FormField';
import { useToast } from '../components/ui/Toast';
import { toastErrorMessage } from '../lib/authErrors';
import type { TaskStatus, TaskType, TaskPriority, TaskDTO } from '../types/taskTypes';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<TaskStatus, string> = {
  NOT_STARTED: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  READY:       'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
  IN_PROGRESS: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  BLOCKED:     'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
  COMPLETED:   'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  CANCELLED:   'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)] opacity-50',
};

const PRIORITY_DOT: Record<TaskPriority, string> = {
  LOW:      'bg-[var(--muted)]',
  NORMAL:   'bg-[var(--muted)]',
  HIGH:     'bg-[#d97706]',
  CRITICAL: 'bg-[#991b1b]',
};

const TYPE_ICON: Record<TaskType, string> = {
  TASK:      '▸',
  MILESTONE: '◆',
  SUMMARY:   '▼',
};

const NEXT_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  NOT_STARTED: ['READY', 'IN_PROGRESS'],
  READY:       ['IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS: ['COMPLETED', 'BLOCKED'],
  BLOCKED:     ['IN_PROGRESS', 'READY'],
  COMPLETED:   [],
  CANCELLED:   [],
};

const STATUS_FILTERS = ['ALL', 'NOT_STARTED', 'READY', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'] as const;

// ── Status transition popover ─────────────────────────────────────────────────

const TransitionMenu: React.FC<{
  task: TaskDTO;
  orgId: string;
  projectId: string;
  onClose: () => void;
}> = ({ task, orgId, projectId, onClose }) => {
  const { success: toastOk, error: toastErr } = useToast();
  const [transition] = useTransitionTaskMutation();
  const nexts = NEXT_TRANSITIONS[task.status];

  const STATUS_LABELS: Record<TaskStatus, string> = {
    NOT_STARTED: 'Not started',
    READY: 'Ready',
    IN_PROGRESS: 'In progress',
    BLOCKED: 'Blocked',
    COMPLETED: 'Complete',
    CANCELLED: 'Cancel',
  };

  if (task.taskType === 'SUMMARY' || nexts.length === 0) return null;

  return (
    <div className="absolute left-0 top-[calc(100%+2px)] z-30 w-40 border border-[var(--ink)] bg-[var(--paper)]">
      {nexts.map((s) => (
        <button
          key={s}
          type="button"
          onClick={async () => {
            onClose();
            try {
              await transition({ orgId, projectId, taskId: task.id, input: { status: s, expectedVersion: task.version } }).unwrap();
              toastOk(`Marked ${STATUS_LABELS[s]}`, '');
            } catch (err) {
              toastErr('Transition failed', toastErrorMessage(err as never));
            }
          }}
          className="w-full px-3 py-2 text-left text-sm text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
        >
          {STATUS_LABELS[s]}
        </button>
      ))}
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

export const ProjectTasksPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const navigate = useNavigate();
  const canCreate = usePermission('project.task.create');
  const { success: toastOk, error: toastErr } = useToast();

  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>('ALL');
  const [phaseFilter, setPhaseFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<TaskType | ''>('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<TaskType>('TASK');
  const [newPhase, setNewPhase] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newFinish, setNewFinish] = useState('');
  const [newAssignee, setNewAssignee] = useState('');

  const { data: tasksData, isLoading } = useListTasksQuery({
    orgId: orgId!,
    projectId: projectId!,
    query: {
      status: statusFilter !== 'ALL' ? (statusFilter as TaskStatus) : undefined,
      taskType: typeFilter || undefined,
      phaseId: phaseFilter || undefined,
      search: search || undefined,
    },
  });

  const { data: phasesData } = useListPhasesQuery({ orgId: orgId!, projectId: projectId! });
  const { data: membersData } = useListProjectMembersQuery({ orgId: orgId!, projectId: projectId! });
  const [createTask, { isLoading: creating }] = useCreateTaskMutation();

  const tasks = tasksData?.tasks ?? [];

  const phaseName = (phaseId: string | null) => {
    if (!phaseId) return null;
    return phasesData?.phases.find((p) => p.id === phaseId)?.name ?? null;
  };

  const memberName = (userId: string | null) => {
    if (!userId) return null;
    const m = membersData?.members.find((m) => m.userId === userId);
    return m ? `${m.user.firstName} ${m.user.lastName ?? ''}`.trim() : userId;
  };

  const handleCreate = async () => {
    if (!newName.trim()) { toastErr('Name required', ''); return; }
    try {
      await createTask({
        orgId: orgId!,
        projectId: projectId!,
        input: {
          name: newName.trim(),
          taskType: newType,
          phaseId: newPhase || undefined,
          currentStartDate: newStart || undefined,
          currentFinishDate: newFinish || undefined,
          assignedTo: newAssignee || undefined,
        },
      }).unwrap();
      toastOk('Task created', '');
      setNewName(''); setNewType('TASK'); setNewPhase(''); setNewStart(''); setNewFinish(''); setNewAssignee('');
      setShowAdd(false);
    } catch (err) {
      toastErr('Create failed', toastErrorMessage(err as never));
    }
  };

  return (
    <div className="p-6 sm:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Tasks</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {tasksData?.totalCount ?? 0} task{(tasksData?.totalCount ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add task
          </button>
        )}
      </div>

      {/* Inline add form */}
      {showAdd && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New task</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Name *</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Task name"
                className={inputCls()}
              />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Type</label>
              <select value={newType} onChange={(e) => setNewType(e.target.value as TaskType)} className={inputCls()}>
                <option value="TASK">Task</option>
                <option value="MILESTONE">Milestone</option>
                <option value="SUMMARY">Summary</option>
              </select>
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Phase</label>
              <select value={newPhase} onChange={(e) => setNewPhase(e.target.value)} className={inputCls()}>
                <option value="">No phase</option>
                {(phasesData?.phases ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Start date</label>
              <input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Finish date</label>
              <input type="date" value={newFinish} onChange={(e) => setNewFinish(e.target.value)} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Assign to</label>
              <select value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)} className={inputCls()}>
                <option value="">Unassigned</option>
                {(membersData?.members ?? []).map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.firstName} {m.user.lastName ?? ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1 border-t border-[var(--hairline-2)]">
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0"
            >
              {creating ? 'Creating…' : 'Create task'}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Status tabs */}
        <div className="flex border border-[var(--hairline-2)]">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={cn(
                'px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors',
                statusFilter === f
                  ? 'bg-[var(--ink)] text-white'
                  : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]',
              )}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Phase filter */}
        <select
          value={phaseFilter}
          onChange={(e) => setPhaseFilter(e.target.value)}
          className="border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[10px] text-[var(--muted)] focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
        >
          <option value="">All phases</option>
          {(phasesData?.phases ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TaskType | '')}
          className="border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[10px] text-[var(--muted)] focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
        >
          <option value="">All types</option>
          <option value="TASK">Task</option>
          <option value="MILESTONE">Milestone</option>
          <option value="SUMMARY">Summary</option>
        </select>

        {/* Search */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks…"
          className="border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-1.5 text-sm placeholder:text-[var(--muted)] focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)] min-w-[180px]"
        />
      </div>

      {/* Table */}
      <div className="border border-[var(--hairline-2)]">
        {/* Header */}
        <div className="grid grid-cols-[28px_36px_1fr_100px_80px_110px_110px_90px_60px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['', '', 'Name', 'Phase', 'Type', 'Start', 'Finish', 'Status', '%'].map((h) => (
            <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
          ))}
        </div>

        {isLoading ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />
          ))
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <ListChecks className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No tasks found.</p>
            {canCreate && statusFilter === 'ALL' && (
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="mt-3 inline-flex items-center gap-2 border border-[var(--hairline-2)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-2)] transition-colors"
              >
                <Plus className="h-4 w-4" strokeWidth={1.8} />
                Add first task
              </button>
            )}
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                'grid grid-cols-[28px_36px_1fr_100px_80px_110px_110px_90px_60px] gap-3 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors group',
                task.taskType === 'SUMMARY' && 'bg-[var(--surface-2)]',
                task.status === 'CANCELLED' && 'opacity-50',
              )}
              onClick={() => navigate(`/org/${orgId}/projects/${projectId}/tasks/${task.id}`)}
            >
              {/* Priority dot */}
              <div className="flex justify-center">
                {task.priority !== 'NORMAL' && task.priority !== 'LOW' && (
                  <div className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_DOT[task.priority])} />
                )}
              </div>

              {/* Type icon */}
              <span className="font-mono text-[10px] text-[var(--muted)] text-center">
                {TYPE_ICON[task.taskType]}
              </span>

              {/* Name + code */}
              <div className="min-w-0" style={{ paddingLeft: task.parentTaskId ? '1rem' : undefined }}>
                <p className={cn(
                  'text-sm truncate',
                  task.taskType === 'SUMMARY' ? 'font-medium' : '',
                  task.isCritical ? 'text-[var(--ink)]' : '',
                )}>
                  {task.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-[9px] text-[var(--muted)]">{task.taskCode}</span>
                  {task.isCritical && (
                    <span className="font-mono text-[8px] uppercase tracking-[0.1em] border border-[#fecaca] bg-[#fef2f2] text-[#991b1b] px-1 py-0">critical</span>
                  )}
                  {task.assignedTo && (
                    <span className="font-mono text-[9px] text-[var(--muted)] truncate max-w-[80px]">{memberName(task.assignedTo)}</span>
                  )}
                </div>
              </div>

              {/* Phase */}
              <p className="font-mono text-[10px] text-[var(--muted)] truncate">{phaseName(task.phaseId) ?? '—'}</p>

              {/* Type label */}
              <p className="font-mono text-[9px] text-[var(--muted)]">{task.taskType}</p>

              {/* Start */}
              <p className="font-mono text-[10px] text-[var(--muted)]">{task.currentStartDate ?? '—'}</p>

              {/* Finish */}
              <p className="font-mono text-[10px] text-[var(--muted)]">{task.currentFinishDate ?? '—'}</p>

              {/* Status badge — click opens transition menu */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setMenuTaskId(menuTaskId === task.id ? null : task.id)}
                  className={cn(
                    'font-mono text-[9px] uppercase tracking-[0.1em] border px-1.5 py-0.5 cursor-pointer',
                    STATUS_BADGE[task.status],
                  )}
                >
                  {task.status.replace('_', ' ')}
                </button>
                {menuTaskId === task.id && (
                  <TransitionMenu
                    task={task}
                    orgId={orgId!}
                    projectId={projectId!}
                    onClose={() => setMenuTaskId(null)}
                  />
                )}
              </div>

              {/* Progress */}
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1 bg-[var(--surface-2)] border border-[var(--hairline-2)]">
                  <div
                    className="h-full bg-[var(--ink)]"
                    style={{ width: `${task.progressPercent}%` }}
                  />
                </div>
                <span className="font-mono text-[9px] text-[var(--muted)]">{task.progressPercent}%</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Close transition menu on outside click */}
      {menuTaskId && (
        <div className="fixed inset-0 z-20" onClick={() => setMenuTaskId(null)} />
      )}
    </div>
  );
};
