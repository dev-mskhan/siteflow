/**
 * MaterialRequestsPage — /org/:orgId/projects/:projectId/procurement/requests
 * Lists material requests. Inline create form. Status filter tabs.
 */
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Package } from 'lucide-react';
import {
  useListMaterialRequestsQuery,
  useCreateMaterialRequestMutation,
  useSubmitMaterialRequestMutation,
  useCancelMaterialRequestMutation,
} from '../../api/procurementApi';
import { usePermission } from '../../hooks/usePermission';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useToast } from '../../components/ui/Toast';
import { useListMaterialsQuery } from '../../features/material/materialApi';
import {
  getServerError,
  isInlineError,
  isToastError,
  toastErrorMessage,
} from '../../lib/authErrors';
import type { MaterialRequestStatus } from '../../types/procurementTypes';

const STATUS_BADGE: Record<MaterialRequestStatus, string> = {
  DRAFT: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  SUBMITTED: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
  UNDER_REVIEW: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  APPROVED: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  PARTIALLY_ORDERED: 'border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3]',
  ORDERED: 'border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3]',
  FULFILLED: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  CANCELLED: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  REJECTED: 'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
};

const PRIORITY_BADGE: Record<string, string> = {
  LOW: 'border-[var(--hairline-2)] text-[var(--muted)]',
  NORMAL: 'border-[var(--hairline-2)] text-[var(--muted)]',
  HIGH: 'border-[#fde68a] text-[#92400e]',
  URGENT: 'border-[#fecaca] text-[#991b1b]',
};

const FILTERS = ['ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'CANCELLED'] as const;

export const MaterialRequestsPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const navigate = useNavigate();
  const canCreate = usePermission('project.material_request.create');
  const { success: toastOk, error: toastErr } = useToast();

  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [notes, setNotes] = useState('');
  const [requiredByDate, setRequiredByDate] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [deliveryLocation, setDeliveryLocation] = useState('');

  const { data, isLoading } = useListMaterialRequestsQuery({
    orgId: orgId!,
    projectId: projectId!,
  });
  const { data: materialsData } = useListMaterialsQuery({ orgId: orgId! });
  const [createMR, { isLoading: creating, error: createErr }] = useCreateMaterialRequestMutation();
  const [submitMR, { isLoading: submitting }] = useSubmitMaterialRequestMutation();
  const [cancelMR] = useCancelMaterialRequestMutation();

  const onCreate = async () => {
    try {
      const result = await createMR({
        orgId: orgId!,
        projectId: projectId!,
        input: {
          priority,
          requiredByDate: requiredByDate || undefined,
          deliveryLocation: deliveryLocation || undefined,
          notes: notes || undefined,
          items: [],
        },
      }).unwrap();
      toastOk('Material request created', '');
      setShowCreate(false);
      setNotes('');
      setRequiredByDate('');
      setDeliveryLocation('');
      setPriority('NORMAL');
      navigate(`/org/${orgId}/projects/${projectId}/procurement/requests/${result.id}`);
    } catch (err) {
      if (isToastError(err as never)) toastErr('Create failed', toastErrorMessage(err as never));
    }
  };

  const onQuickSubmit = async (requestId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await submitMR({ orgId: orgId!, projectId: projectId!, mrId: requestId }).unwrap();
      toastOk('Submitted', '');
    } catch (err) {
      toastErr('Submit failed', toastErrorMessage(err as never));
    }
  };

  const onCancel = async (requestId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await cancelMR({ orgId: orgId!, projectId: projectId!, mrId: requestId }).unwrap();
      toastOk('Cancelled', '');
    } catch (err) {
      toastErr('Cancel failed', toastErrorMessage(err as never));
    }
  };

  const all = data ?? [];
  const rows = filter === 'ALL' ? all : all.filter((r) => r.status === filter);
  const materialsById = new Map((materialsData?.data ?? []).map((material) => [material.id, material]));

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Material requests</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {all.length} request{all.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && !showCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New request
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            New material request
          </p>
          {isInlineError(createErr) && (
            <InlineAlert variant="error" message={getServerError(createErr)?.message ?? 'Error'} />
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
                Required by date
              </label>
              <input
                type="date"
                value={requiredByDate}
                onChange={(e) => setRequiredByDate(e.target.value)}
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
              />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
              >
                {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
              Delivery location
            </label>
            <input
              type="text"
              value={deliveryLocation}
              onChange={(e) => setDeliveryLocation(e.target.value)}
              maxLength={500}
              placeholder="e.g. Site A — Entrance gate"
              className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
            />
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={4000}
              className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
            />
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button
              onClick={onCreate}
              disabled={creating}
              className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0"
            >
              {creating ? 'Creating…' : 'Create request'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex border-b border-[var(--hairline-2)] mb-6">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] border-b-2 transition-colors ${filter === f ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[120px_2fr_90px_80px_100px_120px] gap-4 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['Number', 'Items', 'Status', 'Priority', 'Required by', ''].map((h) => (
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
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <Package className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No material requests found.</p>
          </div>
        ) : (
          rows.map((mr) => (
            <div
              key={mr.id}
              onClick={() =>
                navigate(`/org/${orgId}/projects/${projectId}/procurement/requests/${mr.id}`)
              }
              className="grid grid-cols-[120px_2fr_90px_80px_100px_120px] gap-4 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors"
            >
              <p className="font-mono text-[10px] text-[var(--muted)]">{mr.requestNumber}</p>
              <p className="text-sm truncate">
                {mr.items.length > 0 ? (
                  mr.items
                    .map(
                      (item) =>
                        item.description ??
                        materialsById.get(item.materialId)?.name ??
                        item.materialId,
                    )
                    .join(', ')
                ) : (
                  <span className="text-[var(--muted)]">No items</span>
                )}
              </p>
              <span
                className={`inline-block font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 w-fit ${STATUS_BADGE[mr.status]}`}
              >
                {mr.status}
              </span>
              <span
                className={`inline-block font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 w-fit ${PRIORITY_BADGE[mr.priority]}`}
              >
                {mr.priority}
              </span>
              <p className="font-mono text-[10px] text-[var(--muted)]">
                {mr.requiredByDate ?? '—'}
              </p>
              <div className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                {mr.status === 'DRAFT' && (
                  <button
                    onClick={(e) => onQuickSubmit(mr.id, e)}
                    disabled={submitting}
                    className="font-mono text-[9px] uppercase tracking-[0.12em] border border-[var(--hairline-2)] px-2 py-1 hover:bg-[var(--surface-2)] transition-colors"
                  >
                    Submit
                  </button>
                )}
                {['DRAFT', 'SUBMITTED', 'APPROVED'].includes(mr.status) && (
                  <button
                    onClick={(e) => onCancel(mr.id, e)}
                    className="font-mono text-[9px] uppercase tracking-[0.12em] border border-[var(--hairline-2)] px-2 py-1 text-[#991b1b] hover:bg-[#fef2f2] transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
