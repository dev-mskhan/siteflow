import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  useGetFieldLogQuery,
  useUpdateFieldLogMutation,
  useSubmitFieldLogMutation,
  useLockFieldLogMutation,
  useListAmendmentsQuery,
  useCreateAmendmentMutation,
} from '../api/fieldLogApi';
import { useListTasksQuery } from '../api/taskApi';
import { useCanAccess } from '../hooks/usePermission';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { InlineAlert } from '../components/ui/InlineAlert';
import { getServerError } from '../lib/authErrors';
import type {
  UpdateFieldLogInput,
  FieldLogEntryInput,
  CreateAmendmentInput,
} from '../types/fieldLogTypes';

const STATUS_COLORS = {
  DRAFT: 'gray',
  SUBMITTED: 'amber',
  LOCKED: 'green',
} as const;

export function ProjectFieldLogDetailPage() {
  const { organizationId, projectId, logId } = useParams();
  const canUpdate = useCanAccess('project.field-log.update');
  const canSubmit = useCanAccess('project.field-log.submit');
  const canLock = useCanAccess('project.field-log.lock');

  const [isEditing, setIsEditing] = useState(false);
  const [isCreatingAmendment, setIsCreatingAmendment] = useState(false);
  const [entryRows, setEntryRows] = useState<FieldLogEntryInput[]>([]);

  const { data: log, isLoading } = useGetFieldLogQuery({
    orgId: organizationId!,
    projectId: projectId!,
    logId: logId!,
  });
  const { data: amendmentsData } = useListAmendmentsQuery({
    orgId: organizationId!,
    projectId: projectId!,
    logId: logId!,
  });
  const { data: tasksData } = useListTasksQuery({ orgId: organizationId!, projectId: projectId! });

  const [updateFieldLog, { isLoading: isUpdating, error: updateError }] =
    useUpdateFieldLogMutation();
  const [submitFieldLog, { isLoading: isSubmitting }] = useSubmitFieldLogMutation();
  const [lockFieldLog, { isLoading: isLocking }] = useLockFieldLogMutation();
  const [createAmendment, { isLoading: isCreatingAmend, error: amendError }] =
    useCreateAmendmentMutation();

  const {
    register: registerUpdate,
    handleSubmit: handleUpdate,
    reset: resetUpdate,
  } = useForm<UpdateFieldLogInput>();

  const {
    register: registerAmend,
    handleSubmit: handleAmend,
    reset: resetAmend,
  } = useForm<CreateAmendmentInput>();

  const onUpdate = async (values: UpdateFieldLogInput) => {
    try {
      const input: UpdateFieldLogInput = {
        ...values,
        entries: entryRows.length > 0 ? entryRows : undefined,
      };
      await updateFieldLog({
        orgId: organizationId!,
        projectId: projectId!,
        logId: logId!,
        input,
      }).unwrap();
      setIsEditing(false);
    } catch (e) {
      // Error shown via updateError
    }
  };

  const onSubmit = async () => {
    await submitFieldLog({ orgId: organizationId!, projectId: projectId!, logId: logId! });
  };

  const onLock = async () => {
    await lockFieldLog({ orgId: organizationId!, projectId: projectId!, logId: logId! });
  };

  const onCreateAmendment = async (values: CreateAmendmentInput) => {
    try {
      await createAmendment({
        orgId: organizationId!,
        projectId: projectId!,
        logId: logId!,
        input: values,
      }).unwrap();
      resetAmend();
      setIsCreatingAmendment(false);
    } catch (e) {
      // Error shown via amendError
    }
  };

  const startEdit = () => {
    if (log) {
      resetUpdate({ notes: log.notes || '' });
      setEntryRows(
        log.entries?.map((e) => ({
          taskId: e.taskId,
          completionPctRecorded: e.completionPctRecorded,
          quantityCompleted: e.quantityCompleted || '',
          unit: e.unit || '',
          notes: e.notes || '',
        })) || [],
      );
      setIsEditing(true);
    }
  };

  const addEntryRow = () => {
    setEntryRows([
      ...entryRows,
      { taskId: '', completionPctRecorded: 0, quantityCompleted: '', unit: '', notes: '' },
    ]);
  };

  const updateEntryRow = (
    index: number,
    field: keyof FieldLogEntryInput,
    value: string | number,
  ) => {
    const updated = [...entryRows];
    updated[index] = { ...updated[index], [field]: value };
    setEntryRows(updated);
  };

  const removeEntryRow = (index: number) => {
    setEntryRows(entryRows.filter((_, i) => i !== index));
  };

  const getTaskName = (taskId: string) => {
    const task = tasksData?.tasks.find((t) => t.id === taskId);
    return task ? `${task.taskCode} - ${task.name}` : taskId;
  };

  if (isLoading) return <div>Loading field log...</div>;
  if (!log) return <div>Field log not found</div>;

  const amendments = amendmentsData?.data || [];

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold mb-2">Field Log - {log.logDate}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>Supervisor: {log.supervisorId}</span>
              <Badge variant={STATUS_COLORS[log.status]}>{log.status}</Badge>
            </div>
          </div>
          <div className="flex gap-2">
            {log.status === 'DRAFT' && canUpdate && !isEditing && (
              <>
                <Button variant="outline" onClick={startEdit}>
                  Edit
                </Button>
                {canSubmit && (
                  <Button onClick={onSubmit} isLoading={isSubmitting}>
                    Submit
                  </Button>
                )}
              </>
            )}
            {log.status === 'SUBMITTED' && canLock && (
              <Button onClick={onLock} isLoading={isLocking}>
                Lock
              </Button>
            )}
            {log.status === 'LOCKED' && canUpdate && !isCreatingAmendment && (
              <Button variant="outline" onClick={() => setIsCreatingAmendment(true)}>
                Add Amendment
              </Button>
            )}
          </div>
        </div>

        {/* Status pipeline */}
        <div className="flex items-center gap-2 mb-6 pb-6 border-b">
          <div
            className={`flex items-center gap-2 ${log.status === 'DRAFT' ? 'text-gray-900' : 'text-gray-400'}`}
          >
            <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-medium text-sm">
              1
            </div>
            <span className="text-sm font-medium">DRAFT</span>
          </div>
          <div className="flex-1 h-0.5 bg-gray-300" />
          <div
            className={`flex items-center gap-2 ${log.status === 'SUBMITTED' ? 'text-gray-900' : 'text-gray-400'}`}
          >
            <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-medium text-sm">
              2
            </div>
            <span className="text-sm font-medium">SUBMITTED</span>
          </div>
          <div className="flex-1 h-0.5 bg-gray-300" />
          <div
            className={`flex items-center gap-2 ${log.status === 'LOCKED' ? 'text-gray-900' : 'text-gray-400'}`}
          >
            <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-medium text-sm">
              3
            </div>
            <span className="text-sm font-medium">LOCKED</span>
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleUpdate(onUpdate)} className="space-y-4">
            {updateError && (
              <InlineAlert variant="error">{getServerError(updateError)}</InlineAlert>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                {...registerUpdate('notes')}
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
                    onChange={(e) =>
                      updateEntryRow(idx, 'completionPctRecorded', Number(e.target.value))
                    }
                  />
                  <input
                    type="text"
                    placeholder="Qty"
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
              <Button type="submit" isLoading={isUpdating}>
                Save
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Notes</h3>
              <p className="text-sm">{log.notes || '—'}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-3">Task Entries</h3>
              {log.entries && log.entries.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Task</th>
                        <th className="px-3 py-2 text-left font-medium">Progress</th>
                        <th className="px-3 py-2 text-left font-medium">Quantity</th>
                        <th className="px-3 py-2 text-left font-medium">Unit</th>
                        <th className="px-3 py-2 text-left font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {log.entries.map((entry) => (
                        <tr key={entry.id}>
                          <td className="px-3 py-2">{getTaskName(entry.taskId)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-600"
                                  style={{ width: `${entry.completionPctRecorded}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600">
                                {entry.completionPctRecorded}%
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2">{entry.quantityCompleted || '—'}</td>
                          <td className="px-3 py-2">{entry.unit || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{entry.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No entries recorded</p>
              )}
            </div>
          </>
        )}
      </Card>

      {log.status === 'LOCKED' && (
        <Card className="p-6">
          <h2 className="text-lg font-medium mb-4">Amendments</h2>

          {isCreatingAmendment && (
            <form
              onSubmit={handleAmend(onCreateAmendment)}
              className="mb-6 p-4 border rounded-lg space-y-3"
            >
              {amendError && (
                <InlineAlert variant="error">{getServerError(amendError)}</InlineAlert>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Reason</label>
                <textarea
                  {...registerAmend('reason', { required: true, minLength: 1, maxLength: 2000 })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Correction (JSON)</label>
                <textarea
                  {...registerAmend('correction', {
                    required: true,
                    setValueAs: (v) => {
                      try {
                        return JSON.parse(v);
                      } catch {
                        return {};
                      }
                    },
                  })}
                  rows={4}
                  placeholder='{"field": "value"}'
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" isLoading={isCreatingAmend}>
                  Submit Amendment
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsCreatingAmendment(false);
                    resetAmend();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {amendments.length > 0 ? (
            <div className="space-y-3">
              {amendments.map((amendment) => (
                <div key={amendment.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium">Requested by: {amendment.requestedBy}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(amendment.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {amendment.approvedBy && <Badge variant="green">Approved</Badge>}
                  </div>
                  <p className="text-sm mb-2">{amendment.reason}</p>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-600">View correction</summary>
                    <pre className="mt-2 p-2 bg-gray-50 rounded overflow-x-auto">
                      {JSON.stringify(amendment.correction, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No amendments yet</p>
          )}
        </Card>
      )}
    </div>
  );
}
