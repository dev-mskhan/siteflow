import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  useGetIssueQuery,
  useUpdateIssueMutation,
  useTransitionIssueMutation,
} from '../api/issueApi';
import { useListProjectMembersQuery } from '../features/project/projectMemberApi';
import { useCanAccess } from '../hooks/usePermission';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { InlineAlert } from '../components/ui/InlineAlert';
import { getServerError } from '../lib/errors';
import type { UpdateIssueInput, IssueStatus } from '../types/issueTypes';

interface FormValues extends UpdateIssueInput {}

const STATUS_COLORS = {
  OPEN: 'amber',
  IN_PROGRESS: 'blue',
  RESOLVED: 'green',
  CLOSED: 'gray',
} as const;

const TRANSITIONS: Record<IssueStatus, Array<{ label: string; status: IssueStatus }>> = {
  OPEN: [
    { label: 'Start Progress', status: 'IN_PROGRESS' },
    { label: 'Close', status: 'CLOSED' },
  ],
  IN_PROGRESS: [
    { label: 'Mark Resolved', status: 'RESOLVED' },
    { label: 'Reopen', status: 'OPEN' },
  ],
  RESOLVED: [
    { label: 'Close', status: 'CLOSED' },
    { label: 'Reopen', status: 'OPEN' },
  ],
  CLOSED: [],
};

export function ProjectIssueDetailPage() {
  const { organizationId, projectId, issueId } = useParams();
  const canUpdate = useCanAccess('project.issue.update');
  const canTransition = useCanAccess('project.issue.transition');

  const [isEditing, setIsEditing] = useState(false);

  const { data: issue, isLoading } = useGetIssueQuery({ orgId: organizationId!, projectId: projectId!, issueId: issueId! });
  const { data: membersData } = useListProjectMembersQuery({ orgId: organizationId!, projectId: projectId! });

  const [updateIssue, { isLoading: isUpdating, error: updateError }] = useUpdateIssueMutation();
  const [transitionIssue, { isLoading: isTransitioning }] = useTransitionIssueMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>();

  const onUpdate = async (values: FormValues) => {
    try {
      const input: UpdateIssueInput = {
        ...values,
        reportedImpactDays: values.reportedImpactDays ? Number(values.reportedImpactDays) : undefined,
        approvedImpactDays: values.approvedImpactDays ? Number(values.approvedImpactDays) : undefined,
      };
      await updateIssue({ orgId: organizationId!, projectId: projectId!, issueId: issueId!, input }).unwrap();
      setIsEditing(false);
    } catch (e) {
      // Error shown via updateError
    }
  };

  const onTransition = async (status: IssueStatus) => {
    await transitionIssue({ orgId: organizationId!, projectId: projectId!, issueId: issueId!, status });
  };

  const startEdit = () => {
    if (issue) {
      reset({
        title: issue.title,
        description: issue.description || '',
        reportedImpactDays: issue.reportedImpactDays,
        approvedImpactDays: issue.approvedImpactDays,
        assignedTo: issue.assignedTo || undefined,
      });
      setIsEditing(true);
    }
  };

  if (isLoading) return <div>Loading issue...</div>;
  if (!issue) return <div>Issue not found</div>;

  const availableTransitions = TRANSITIONS[issue.status];
  const canEditDetails = canUpdate && (issue.status === 'OPEN' || issue.status === 'IN_PROGRESS');

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-semibold">{issue.title}</h1>
              <Badge variant={STATUS_COLORS[issue.status]}>{issue.status.replace('_', ' ')}</Badge>
            </div>
            <p className="text-sm text-gray-600">
              Created {new Date(issue.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-2">
            {canEditDetails && !isEditing && (
              <Button variant="outline" onClick={startEdit}>
                Edit
              </Button>
            )}
            {canTransition &&
              availableTransitions.map((t) => (
                <Button
                  key={t.status}
                  onClick={() => onTransition(t.status)}
                  isLoading={isTransitioning}
                  variant={t.status === 'CLOSED' ? 'outline' : 'primary'}
                >
                  {t.label}
                </Button>
              ))}
          </div>
        </div>

        {/* Status pipeline */}
        <div className="flex items-center gap-2 mb-6 pb-6 border-b">
          <div className={`flex items-center gap-2 ${issue.status === 'OPEN' ? 'text-gray-900' : 'text-gray-400'}`}>
            <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-medium text-sm">1</div>
            <span className="text-sm font-medium">OPEN</span>
          </div>
          <div className="flex-1 h-0.5 bg-gray-300" />
          <div className={`flex items-center gap-2 ${issue.status === 'IN_PROGRESS' ? 'text-gray-900' : 'text-gray-400'}`}>
            <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-medium text-sm">2</div>
            <span className="text-sm font-medium">IN PROGRESS</span>
          </div>
          <div className="flex-1 h-0.5 bg-gray-300" />
          <div className={`flex items-center gap-2 ${issue.status === 'RESOLVED' ? 'text-gray-900' : 'text-gray-400'}`}>
            <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-medium text-sm">3</div>
            <span className="text-sm font-medium">RESOLVED</span>
          </div>
          <div className="flex-1 h-0.5 bg-gray-300" />
          <div className={`flex items-center gap-2 ${issue.status === 'CLOSED' ? 'text-gray-900' : 'text-gray-400'}`}>
            <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-medium text-sm">4</div>
            <span className="text-sm font-medium">CLOSED</span>
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit(onUpdate)} className="space-y-4">
            {updateError && (
              <InlineAlert variant="error">{getServerError(updateError)}</InlineAlert>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                {...register('title', { required: 'Title is required', minLength: 1, maxLength: 500 })}
                className="w-full px-3 py-2 border rounded-lg"
              />
              {errors.title && <p className="text-sm text-red-600 mt-1">{errors.title.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                {...register('description')}
                rows={4}
                maxLength={4000}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Reported Impact (days)</label>
                <input
                  type="number"
                  {...register('reportedImpactDays')}
                  min={0}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Approved Impact (days)</label>
                <input
                  type="number"
                  {...register('approvedImpactDays')}
                  min={0}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">PM/Finance only</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Assign To</label>
              <select {...register('assignedTo')} className="w-full px-3 py-2 border rounded-lg">
                <option value="">Unassigned</option>
                {membersData?.members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.userFirstName} {m.userLastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <Button type="submit" isLoading={isUpdating}>
                Save Changes
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Description</h3>
                <p className="text-sm">{issue.description || '—'}</p>
              </div>

              <div className="grid grid-cols-3 gap-6 pt-4 border-t">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Reported Impact</h3>
                  <p className="text-lg font-semibold">{issue.reportedImpactDays} days</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Approved Impact</h3>
                  <p className="text-lg font-semibold">
                    {issue.approvedImpactDays} days
                    {issue.approvedImpactDays !== issue.reportedImpactDays && (
                      <span className="text-sm text-amber-600 ml-2">(differs from reported)</span>
                    )}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Assigned To</h3>
                  <p className="text-sm">{issue.assignedTo || 'Unassigned'}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
