/**
 * ProjectIssuesPage — /org/:orgId/projects/:projectId/issues
 * Lists all project issues. Status filter tabs. Inline create panel.
 */
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Plus, AlertTriangle } from 'lucide-react';
import { useListIssuesQuery, useCreateIssueMutation } from '../api/issueApi';
import { useListProjectMembersQuery } from '../features/project/projectMemberApi';
import { usePermission } from '../hooks/usePermission';
import { InlineAlert } from '../components/ui/InlineAlert';
import { useToast } from '../components/ui/Toast';
import { getServerError, isInlineError, isToastError, toastErrorMessage } from '../lib/authErrors';
import type { CreateIssueInput, IssueStatus } from '../types/issueTypes';

const STATUS_BADGE: Record<IssueStatus, string> = {
  OPEN: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  IN_PROGRESS: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
  RESOLVED: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  CLOSED: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
};

const STATUS_LABELS: Record<IssueStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const ALL_FILTERS = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

export const ProjectIssuesPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const navigate = useNavigate();
  const canCreate = usePermission('project.issue.create');
  const { success: toastOk, error: toastErr } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<(typeof ALL_FILTERS)[number]>('ALL');

  const { data, isLoading } = useListIssuesQuery({ orgId: orgId!, projectId: projectId! });
  const { data: membersData } = useListProjectMembersQuery({
    orgId: orgId!,
    projectId: projectId!,
  });
  const [createIssue, { isLoading: creating, error: createErr }] = useCreateIssueMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateIssueInput>();

  const onSubmit = async (values: CreateIssueInput) => {
    try {
      const result = await createIssue({
        orgId: orgId!,
        projectId: projectId!,
        input: {
          ...values,
          reportedImpactDays: values.reportedImpactDays ? Number(values.reportedImpactDays) : 0,
          assignedTo: values.assignedTo || undefined,
        },
      }).unwrap();
      toastOk('Issue created', '');
      reset();
      setShowCreate(false);
      navigate(`/org/${orgId}/projects/${projectId}/issues/${result.id}`);
    } catch (err) {
      if (isToastError(err as never)) toastErr('Create failed', toastErrorMessage(err as never));
    }
  };

  const allIssues = data?.data ?? [];
  const issues =
    statusFilter === 'ALL' ? allIssues : allIssues.filter((i) => i.status === statusFilter);

  return (
    <div className="p-6 sm:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Issues</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {allIssues.length} issue{allIssues.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && !showCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New issue
          </button>
        )}
      </div>

      {/* Create panel */}
      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            New issue
          </p>
          {isInlineError(createErr) && (
            <InlineAlert variant="error" message={getServerError(createErr)?.message ?? 'Error'} />
          )}
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
              Title *
            </label>
            <input
              type="text"
              {...register('title', { required: 'Title is required', maxLength: 500 })}
              className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
              placeholder="Brief description of the issue"
            />
            {errors.title && (
              <p className="mt-1 font-mono text-[9px] text-[#991b1b]">{errors.title.message}</p>
            )}
          </div>

          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
              Description
            </label>
            <textarea
              {...register('description')}
              rows={4}
              maxLength={4000}
              className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
              placeholder="Details, context, and impact (max 4000 chars)"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
                Reported impact (days)
              </label>
              <input
                type="number"
                {...register('reportedImpactDays')}
                min={0}
                defaultValue={0}
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
              />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
                Assign to
              </label>
              <select
                {...register('assignedTo')}
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
              >
                <option value="">Unassigned</option>
                {membersData?.members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.firstName} {m.user.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button
              onClick={handleSubmit(onSubmit)}
              disabled={creating}
              className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
            >
              {creating ? 'Creating…' : 'Create issue'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                reset();
              }}
              className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex border-b border-[var(--hairline-2)] mb-6">
        {ALL_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            className={`px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] border-b-2 transition-colors ${
              statusFilter === f
                ? 'border-[var(--ink)] text-[var(--ink)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[2fr_110px_100px_120px_100px] gap-4 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['Title', 'Status', 'Impact', 'Assigned', 'Created'].map((h) => (
            <p
              key={h}
              className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]"
            >
              {h}
            </p>
          ))}
        </div>

        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]"
            />
          ))
        ) : issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <AlertTriangle className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">
              {statusFilter === 'ALL'
                ? 'No issues recorded yet.'
                : `No ${STATUS_LABELS[statusFilter as IssueStatus]?.toLowerCase()} issues.`}
            </p>
          </div>
        ) : (
          issues.map((issue) => (
            <div
              key={issue.id}
              onClick={() => navigate(`/org/${orgId}/projects/${projectId}/issues/${issue.id}`)}
              className="grid grid-cols-[2fr_110px_100px_120px_100px] gap-4 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors"
            >
              <p className="text-sm font-medium truncate">{issue.title}</p>
              <span
                className={`inline-block font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 w-fit ${STATUS_BADGE[issue.status]}`}
              >
                {STATUS_LABELS[issue.status]}
              </span>
              <div>
                <p className="font-mono text-[11px] text-[var(--muted)]">
                  {issue.reportedImpactDays}d reported
                </p>
                {issue.approvedImpactDays > 0 && (
                  <p className="font-mono text-[10px] text-[#166534]">
                    {issue.approvedImpactDays}d approved
                  </p>
                )}
              </div>
              <p className="text-sm text-[var(--muted)] truncate">{issue.assignedTo ?? '—'}</p>
              <p className="font-mono text-[10px] text-[var(--muted)]">
                {new Date(issue.createdAt).toLocaleDateString('en', {
                  day: 'numeric',
                  month: 'short',
                })}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
