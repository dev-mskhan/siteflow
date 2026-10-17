/**
 * ProjectCostCodesPage — /org/:orgId/projects/:projectId/cost-codes
 * Table of cost codes with inline add, edit, and deactivate.
 * Shows inactive codes when toggled.
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Plus, Pencil, PowerOff, Check, X } from 'lucide-react';
import {
  useListCostCodesQuery,
  useCreateCostCodeMutation,
  useUpdateCostCodeMutation,
  useDeactivateCostCodeMutation,
} from '../../../features/project/costCodeApi';
import { FormField, inputCls } from '../../../components/ui/FormField';
import { useToast } from '../../../components/ui/Toast';
import { toastErrorMessage } from '../../../lib/authErrors';
import type { CostCodeDTO } from '../../../features/project/projectTypes';

const EditRow: React.FC<{
  code: CostCodeDTO;
  onDone: () => void;
  orgId: string;
  projectId: string;
}> = ({ code, onDone, orgId, projectId }) => {
  const { success: toastOk, error: toastErr } = useToast();
  const [updateCostCode, { isLoading }] = useUpdateCostCodeMutation();
  const { register, handleSubmit } = useForm({
    defaultValues: { code: code.code, description: code.description ?? '' },
  });

  const onSubmit = async (data: { code: string; description: string }) => {
    try {
      await updateCostCode({
        orgId,
        projectId,
        codeId: code.id,
        body: { code: data.code, description: data.description || null },
      }).unwrap();
      toastOk('Cost code updated', '');
      onDone();
    } catch (err) {
      toastErr('Update failed', toastErrorMessage(err as never));
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex items-center gap-3 px-4 py-3 border-b border-[var(--hairline-2)] bg-[var(--surface-2)]"
    >
      <input
        {...register('code')}
        placeholder="CODE-01"
        className={`${inputCls()} w-36 font-mono text-xs`}
      />
      <input
        {...register('description')}
        placeholder="Description"
        className={`${inputCls()} flex-1`}
      />
      <button
        type="submit"
        disabled={isLoading}
        className="p-1.5 text-[#166534] hover:bg-[#f0fdf4] transition-colors"
      >
        <Check className="h-4 w-4" strokeWidth={2} />
      </button>
      <button
        type="button"
        onClick={onDone}
        className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </form>
  );
};

export const ProjectCostCodesPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { success: toastOk, error: toastErr } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const { data, isLoading } = useListCostCodesQuery({
    orgId: orgId!,
    projectId: projectId!,
    includeInactive: showInactive,
  });
  const [createCostCode, { isLoading: creating }] = useCreateCostCodeMutation();
  const [deactivate] = useDeactivateCostCodeMutation();

  const codes = data?.costCodes ?? [];
  const { register, handleSubmit, reset } = useForm({
    defaultValues: { code: '', description: '' },
  });

  const handleCreate = async (data: { code: string; description: string }) => {
    try {
      await createCostCode({
        orgId: orgId!,
        projectId: projectId!,
        body: { code: data.code, description: data.description || undefined },
      }).unwrap();
      reset();
      setShowAdd(false);
      toastOk('Cost code created', '');
    } catch (err) {
      toastErr('Failed', toastErrorMessage(err as never));
    }
  };

  const handleDeactivate = async (codeId: string) => {
    if (!confirm('Deactivate this cost code?')) return;
    try {
      await deactivate({ orgId: orgId!, projectId: projectId!, codeId }).unwrap();
      toastOk('Cost code deactivated', '');
    } catch (err) {
      toastErr('Failed', toastErrorMessage(err as never));
    }
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Cost codes</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {codes.filter((c) => c.isActive).length} active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className={`font-mono text-[10px] uppercase tracking-[0.12em] border px-3 py-1.5 transition-colors ${showInactive ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : 'border-[var(--hairline-2)] text-[var(--muted)] hover:border-[var(--ink)]'}`}
          >
            {showInactive ? 'Hide inactive' : 'Show inactive'}
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="h-4 w-4" strokeWidth={2} /> Add code
          </button>
        </div>
      </div>

      <div className="border border-[var(--hairline-2)]">
        {/* Header */}
        <div className="grid grid-cols-[160px_1fr_100px_80px] border-b border-[var(--hairline-2)] bg-[var(--surface-2)] px-4 py-2">
          {['Code', 'Description', 'Status', ''].map((h) => (
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
        ) : codes.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--muted)]">
            No cost codes yet. Add codes to track budget by work type.
          </div>
        ) : (
          codes.map((code) =>
            editingId === code.id ? (
              <EditRow
                key={code.id}
                code={code}
                onDone={() => setEditingId(null)}
                orgId={orgId!}
                projectId={projectId!}
              />
            ) : (
              <div
                key={code.id}
                className="grid grid-cols-[160px_1fr_100px_80px] items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <p
                  className={`font-mono text-xs font-bold ${!code.isActive ? 'text-[var(--muted)] line-through' : ''}`}
                >
                  {code.code}
                </p>
                <p className="text-sm text-[var(--muted)] truncate">{code.description ?? '—'}</p>
                <span
                  className={`font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 w-fit ${code.isActive ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]' : 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]'}`}
                >
                  {code.isActive ? 'Active' : 'Inactive'}
                </span>
                <div className="flex items-center gap-1">
                  {code.isActive && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditingId(code.id)}
                        className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeactivate(code.id)}
                        className="p-1.5 text-[var(--muted)] hover:text-[#991b1b] transition-colors"
                      >
                        <PowerOff className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ),
          )
        )}

        {/* Inline add form */}
        {showAdd && (
          <form
            onSubmit={handleSubmit(handleCreate)}
            className="grid grid-cols-[160px_1fr_100px_80px] items-center gap-2 px-4 py-3 border-t border-[var(--hairline-2)] bg-[var(--surface-2)]"
          >
            <input
              {...register('code', { required: true })}
              placeholder="CODE-01"
              className={`${inputCls()} font-mono text-xs`}
            />
            <input
              {...register('description')}
              placeholder="Description (optional)"
              className={inputCls()}
            />
            <span />
            <div className="flex gap-1">
              <button
                type="submit"
                disabled={creating}
                className="p-1.5 text-[#166534] hover:bg-[#f0fdf4] transition-colors"
              >
                <Check className="h-4 w-4" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  reset();
                }}
                className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
