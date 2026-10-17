import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useListFieldLogsQuery, useCreateFieldLogMutation } from '../api/fieldLogApi';
import { useListTasksQuery } from '../api/taskApi';
import { useCanAccess } from '../hooks/usePermission';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { InlineAlert } from '../components/ui/InlineAlert';
import { getServerError } from '../lib/errors';
import type { CreateFieldLogInput, FieldLogEntryInput } from '../types/fieldLogTypes';

interface FormValues extends CreateFieldLogInput {}

const STATUS_COLORS = {
  DRAFT: 'gray',
  SUBMITTED: 'amber',
  LOCKED: 'green',
} as const;

export function ProjectFieldLogsPage() {
  const { organizationId, projectId } = useParams();
  const navigate = useNavigate();
  const canCreate = useCanAccess('project.field-log.create');

  const [isCreating, setIsCreating] = useState(false);
  const [entryRows, setEntryRows] = useState<FieldLogEntryInput[]>([]);

  const { data, isLoading } = useListFieldLogsQuery({ orgId: organizationId!, projectId: projectId! });
  const { data: tasksData } = useListTasksQuery({ orgId: organizationId!, projectId: projectId! });
  const [createFieldLog, { isLoading: isCreatingLog, error: createError }] = useCreateFieldLogMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    try {
      const input: CreateFieldLogInput = {
        ...values,
        entries: entryRows.length > 0 ? entryRows : undefined,
      };
      const result = await createFieldLog({ orgId: organizationId!, projectId: projectId!, input }).unwrap();
      reset();
      setEntryRows([]);
      setIsCreating(false);
      navigate(`/${organizationId}/projects/${projectId}/field-logs/${result.id}`);
    } catch (e) {
      // Error shown via createError
    }
  };

  const addEntryRow = () => {
    setEntryRows([
      ...entryRows,
      { taskId: '', completionPctRecorded: 0, quantityCompleted: '', unit: '', notes: '' },
    ]);
  };

  const updateEntryRow = (index: number, field: keyof FieldLogEntryInput, value: string | number) => {
    const updated = [...entryRows];
    updated[index] = { ...updated[index], [field]: value };
    setEntryRows(updated);
  };

  const removeEntryRow = (index: number) => {
    setEntryRows(entryRows.filter((_, i) => i !== index));
  };

  if (isLoading) return <div>Loading field logs...</div>;

  const logs = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Field Logs</h1>
        {canCreate && !isCreating && (
          <Button onClick={() => setIsCreating(true)}>New Log</Button>
        )}
      </div>

      {isCreating && (
        <Card className="p-6">
          <h2 className="text-lg font-medium mb-4">Create Field Log</h2>
          {createError && (
            <InlineAlert variant="error" className="mb-4">
              {getServerError(createError)}
            </InlineAlert>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Log Date</label>
              <input
                type="date"
                {...register('logDate', { required: 'Date is required' })}
                className="w-full px-3 py-2 border rounded-lg"
              />
              {errors.logDate && <p className="text-sm text-red-600 mt-1">{errors.logDate.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                {...register('notes')}
                rows={3}
                maxLength={4000}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">Task Entries</label>
                <Button type="button" variant="outline" size="sm" onClick={addEntryRow}>
                  Add Entry
                </Button>
              </div>
              {entryRows.map((entry, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 mb-2 p-3 border rounded">
                  <select
                    className="col-span-3 px-2 py-1 border rounded text-sm"
                    value={entry.taskId}
                    onChange={(e) => updateEntryRow(idx, 'taskId', e.target.value)}
                  >
                    <option value="">Select task</option>
                    {tasksData?.tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.taskCode} - {t.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="% Complete"
                    min={0}
                    max={100}
                    className="col-span-2 px-2 py-1 border rounded text-sm"
                    value={entry.completionPctRecorded}
                    onChange={(e) => updateEntryRow(idx, 'completionPctRecorded', Number(e.target.value))}
                  />
                  <input
                    type="text"
                    placeholder="Qty (optional)"
                    className="col-span-2 px-2 py-1 border rounded text-sm"
                    value={entry.quantityCompleted || ''}
                    onChange={(e) => updateEntryRow(idx, 'quantityCompleted', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Unit"
                    maxLength={50}
                    className="col-span-1 px-2 py-1 border rounded text-sm"
                    value={entry.unit || ''}
                    onChange={(e) => updateEntryRow(idx, 'unit', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Notes"
                    maxLength={2000}
                    className="col-span-3 px-2 py-1 border rounded text-sm"
                    value={entry.notes || ''}
                    onChange={(e) => updateEntryRow(idx, 'notes', e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEntryRow(idx)}
                    className="col-span-1"
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button type="submit" isLoading={isCreatingLog}>
                Create Log
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreating(false);
                  reset();
                  setEntryRows([]);
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
              <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Entries</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((log) => (
              <tr
                key={log.id}
                onClick={() => navigate(`/${organizationId}/projects/${projectId}/field-logs/${log.id}`)}
                className="hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-4 py-3 text-sm">{log.logDate}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_COLORS[log.status]}>{log.status}</Badge>
                </td>
                <td className="px-4 py-3 text-sm">{log.entries?.length || 0}</td>
                <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-xs">
                  {log.notes || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
