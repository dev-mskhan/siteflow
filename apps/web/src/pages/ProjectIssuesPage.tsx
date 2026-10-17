import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useListIssuesQuery, useCreateIssueMutation } from '../api/issueApi';
import { useListProjectMembersQuery } from '../features/project/projectMemberApi';
import { useCanAccess } from '../hooks/usePermission';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { InlineAlert } from '../components/ui/InlineAlert';
import { getServerError } from '../lib/authErrors';
import type { CreateIssueInput, IssueStatus } from '../types/issueTypes';

interface FormValues extends CreateIssueInput {}

const STATUS_COLORS = {
  OPEN: 'amber',
  IN_PROGRESS: 'blue',
  RESOLVED: 'green',
  CLOSED: 'gray',
} as const;

export function ProjectIssuesPage() {
  const { organizationId, projectId } = useParams();
  const navigate = useNavigate();
  const canCreate = useCanAccess('project.issue.create');

  const [isCreating, setIsCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'ALL'>('ALL');

  const { data, isLoading } = useListIssuesQuery({ orgId: organizationId!, projectId: projectId! });
  const { data: membersData } = useListProjectMembersQuery({
    orgId: organizationId!,
    projectId: projectId!,
  });
  const [createIssue, { isLoading: isCreatingIssue, error: createError }] =
    useCreateIssueMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    try {
      const input: CreateIssueInput = {
        ...values,
        reportedImpactDays: values.reportedImpactDays ? Number(values.reportedImpactDays) : 0,
      };
      const result = await createIssue({
        orgId: organizationId!,
        projectId: projectId!,
        input,
      }).unwrap();
      reset();
      setIsCreating(false);
      navigate(`/${organizationId}/projects/${projectId}/issues/${result.id}`);
    } catch (e) {
      // Error shown via createError
    }
  };

  if (isLoading) return <div>Loading issues...</div>;

  const allIssues = data?.data || [];
  const filteredIssues =
    statusFilter === 'ALL' ? allIssues : allIssues.filter((i) => i.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Issues</h1>
        {canCreate && !isCreating && <Button onClick={() => setIsCreating(true)}>New Issue</Button>}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 border-b">
        {(['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === status
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {isCreating && (
        <Card className="p-6">
          <h2 className="text-lg font-medium mb-4">Create Issue</h2>
          {createError && (
            <InlineAlert variant="error" className="mb-4">
              {getServerError(createError)}
            </InlineAlert>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                {...register('title', {
                  required: 'Title is required',
                  minLength: 1,
                  maxLength: 500,
                })}
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
                  defaultValue={0}
                  className="w-full px-3 py-2 border rounded-lg"
                />
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
            </div>

            <div className="flex gap-2">
              <Button type="submit" isLoading={isCreatingIssue}>
                Create Issue
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreating(false);
                  reset();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Title</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Impact Days</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Assigned</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredIssues.map((issue) => (
              <tr
                key={issue.id}
                onClick={() =>
                  navigate(`/${organizationId}/projects/${projectId}/issues/${issue.id}`)
                }
                className="hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-4 py-3 text-sm font-medium">{issue.title}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_COLORS[issue.status]}>
                    {issue.status.replace('_', ' ')}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="text-gray-600">{issue.reportedImpactDays}</span>
                  {issue.approvedImpactDays !== issue.reportedImpactDays && (
                    <span className="ml-1 text-green-600">/ {issue.approvedImpactDays}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{issue.assignedTo || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {new Date(issue.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
