/**
 * ProjectIssueDetailPage — /org/:orgId/projects/:projectId/issues/:issueId
 * Detail + edit form + transition actions + status pipeline.
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Pencil, ArrowRight } from 'lucide-react';
import {
  useGetIssueQuery,
  useUpdateIssueMutation,
  useTransitionIssueMutation,
} from '../api/issueApi';
import { useListProjectMembersQuery } from '../features/project/projectMemberApi';
import { usePermission } from '../hooks/usePermission';
import { InlineAlert } from '../components/ui/InlineAlert';
import { useToast } from '../components/ui/Toast';
import { getServerError, isInlineError, isToastError, toastErrorMessage } from '../lib/authErrors';
import type { UpdateIssueInput, IssueStatus } from '../types/issueTypes';

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

const TRANSITIONS: Record<
  IssueStatus,
  Array<{ label: string; to: IssueStatus; primary?: boolean }>
> = {
  OPEN: [
    { label: 'Start progress', to: 'IN_PROGRESS', primary: true },
    { label: 'Close', to: 'CLOSED' },
  ],
  IN_PROGRESS: [
    { label: 'Mark resolved', to: 'RESOLVED', primary: true },
    { label: 'Reopen', to: 'OPEN' },
  ],
  RESOLVED: [
    { label: 'Close', to: 'CLOSED', primary: true },
    { label: 'Reopen', to: 'OPEN' },
  ],
  CLOSED: [],
};

const STEPS: IssueStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export const ProjectIssueDetailPage: React.FC = () => {
  const { orgId, projectId, issueId } = useParams<{
    orgId: string;
    projectId: string;
    issueId: string;
  }>();
  const canUpdate = usePermission('project.issue.update');
  const canTransition = usePermission('project.issue.transition');
  const { success: toastOk, error: toastErr } = useToast();

  const [isEditing, setIsEditing] = useState(false);

  const { data: issue, isLoading } = useGetIssueQuery({
    orgId: orgId!,
    projectId: projectId!,
    issueId: issueId!,
  });
  const { data: membersData } = useListProjectMembersQuery({
    orgId: orgId!,
    projectId: projectId!,
  });

  const [updateIssue, { isLoading: updating, error: updateErr }] = useUpdateIssueMutation();
  const [transitionIssue, { isLoading: transitioning }] = useTransitionIssueMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateIssueInput>();

  const startEdit = () => {
    if (!issue) return;
    reset({
      title: issue.title,
      description: issue.description ?? '',
      reportedImpactDays: issue.reportedImpactDays,
      approvedImpactDays: issue.approvedImpactDays,
      assignedTo: issue.assignedTo ?? undefined,
    });
    setIsEditing(true);
  };

  const onSave = async (values: UpdateIssueInput) => {
    try {
      await updateIssue({
        orgId: orgId!,
        projectId: projectId!,
        issueId: issueId!,
        input: {
          ...values,
          reportedImpactDays:
            values.reportedImpactDays !== undefined ? Number(values.reportedImpactDays) : undefined,
          approvedImpactDays:
            values.approvedImpactDays !== undefined ? Number(values.approvedImpactDays) : undefined,
          assignedTo: values.assignedTo || undefined,
        },
      }).unwrap();
      toastOk('Issue updated', '');
      setIsEditing(false);
    } catch (err) {
      if (isToastError(err as never)) toastErr('Update failed', toastErrorMessage(err as never));
    }
  };

  const onTransition = async (status: IssueStatus) => {
    try {
      await transitionIssue({
        orgId: orgId!,
        projectId: projectId!,
        issueId: issueId!,
        status,
      }).unwrap();
      toastOk(`Issue moved to ${STATUS_LABELS[status]}`, '');
    } catch (err) {
      toastErr('Transition failed', toastErrorMessage(err as never));
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 sm:p-8 space-y-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]"
          />
        ))}
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="p-6 sm:p-8">
        <p className="text-sm text-[var(--muted)]">Issue not found.</p>
      </div>
    );
  }

  const canEditDetails = canUpdate && (issue.status === 'OPEN' || issue.status === 'IN_PROGRESS');
  const availableTransitions = TRANSITIONS[issue.status];

  return (
    <div className="p-6 sm:p-8 max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--hairline-2)]">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            Issue
          </p>
          <h1 className="mt-1 text-2xl font-medium tracking-[-0.04em] leading-snug">
            {issue.title}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={`font-mono text-[9px] uppercase tracking-[0.12em] border px-2 py-0.5 ${STATUS_BADGE[issue.status]}`}
            >
              {STATUS_LABELS[issue.status]}
            </span>
            <span className="font-mono text-[10px] text-[var(--muted)]">
              {new Date(issue.createdAt).toLocaleDateString('en', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {canEditDetails && !isEditing && (
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center gap-2 border border-[var(--hairline-2)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-2)] transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
              Edit
            </button>
          )}
          {canTransition &&
            availableTransitions.map((t) => (
              <button
                key={t.to}
                type="button"
                disabled={transitioning}
                onClick={() => onTransition(t.to)}
                className={`inline-flex items-center gap-2 min-h-9 px-4 text-sm font-medium transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 ${
                  t.primary
                    ? 'bg-[var(--ink)] text-white'
                    : 'border border-[var(--hairline-2)] text-[var(--ink)] hover:bg-[var(--surface-2)]'
                }`}
              >
                {t.label}
              </button>
            ))}
        </div>
      </div>

      {/* Status pipeline */}
      <div className="flex items-center gap-0">
        {STEPS.map((step, idx) => {
          const active = issue.status === step;
          const done = STEPS.indexOf(issue.status) > idx;
          return (
            <React.Fragment key={step}>
              <div
                className={`flex items-center gap-2 px-3 py-1.5 border ${active ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : done ? 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]' : 'border-[var(--hairline-2)] bg-[var(--paper)] text-[var(--muted)]'}`}
              >
                <span className="font-mono text-[9px] uppercase tracking-[0.14em]">
                  {STATUS_LABELS[step]}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <ArrowRight
                  className="h-3.5 w-3.5 text-[var(--muted)] shrink-0"
                  strokeWidth={1.5}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Edit form */}
      {isEditing && (
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Edit issue
          </p>
          {isInlineError(updateErr) && (
            <InlineAlert variant="error" message={getServerError(updateErr)?.message ?? 'Error'} />
          )}
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
              Title *
            </label>
            <input
              type="text"
              {...register('title', { required: 'Title is required', maxLength: 500 })}
              className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
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
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
              />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
                Approved impact (days)
                <span className="ml-1 font-mono text-[8px] normal-case tracking-normal text-[var(--muted)]">
                  PM / Finance only
                </span>
              </label>
              <input
                type="number"
                {...register('approvedImpactDays')}
                min={0}
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
              />
            </div>
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

          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button
              onClick={handleSubmit(onSave)}
              disabled={updating}
              className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0"
            >
              {updating ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Details (read-only) */}
      {!isEditing && (
        <div className="space-y-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-2">
              Description
            </p>
            <p className="text-sm">{issue.description || '—'}</p>
          </div>

          <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-4">
              Impact days
            </p>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-[var(--muted)] mb-1">Reported</p>
                <p className="text-2xl font-medium tracking-[-0.04em]">
                  {issue.reportedImpactDays}
                </p>
                <p className="font-mono text-[9px] text-[var(--muted)] mt-0.5">days</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)] mb-1">Approved</p>
                <p
                  className={`text-2xl font-medium tracking-[-0.04em] ${issue.approvedImpactDays !== issue.reportedImpactDays ? 'text-[#166534]' : ''}`}
                >
                  {issue.approvedImpactDays}
                </p>
                <p className="font-mono text-[9px] text-[var(--muted)] mt-0.5">days</p>
              </div>
              {issue.approvedImpactDays !== issue.reportedImpactDays && (
                <div className="flex items-center">
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] border border-[#fde68a] bg-[#fffbeb] text-[#92400e] px-2 py-1">
                    Differs from reported
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-2">
                Assigned to
              </p>
              <p className="text-sm">{issue.assignedTo ?? 'Unassigned'}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-2">
                Created
              </p>
              <p className="text-sm">
                {new Date(issue.createdAt).toLocaleString('en', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
