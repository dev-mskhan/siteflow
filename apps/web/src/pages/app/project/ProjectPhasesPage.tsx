/**
 * ProjectPhasesPage — /org/:orgId/projects/:projectId/phases
 * Sortable phase list. Drag-reorder calls POST .../phases/reorder.
 * Add phase inline modal. Edit + archive per row.
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Plus, GripVertical, Pencil, Archive, X, Check } from 'lucide-react';
import {
  useListPhasesQuery,
  useCreatePhaseMutation,
  useUpdatePhaseMutation,
  useArchivePhaseMutation,
  useReorderPhasesMutation,
} from '../../../features/project/phaseApi';
import { FormField, inputCls } from '../../../components/ui/FormField';
import { useToast } from '../../../components/ui/Toast';
import { toastErrorMessage } from '../../../lib/authErrors';
import type { PhaseDTO } from '../../../features/project/projectTypes';

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(d),
  );
}

const EditRow: React.FC<{
  phase: PhaseDTO;
  onDone: () => void;
  orgId: string;
  projectId: string;
}> = ({ phase, onDone, orgId, projectId }) => {
  const { success: toastOk, error: toastErr } = useToast();
  const [updatePhase, { isLoading }] = useUpdatePhaseMutation();
  const { register, handleSubmit } = useForm({
    defaultValues: {
      name: phase.name,
      description: phase.description ?? '',
      startsAt: phase.startsAt ?? '',
      endsAt: phase.endsAt ?? '',
    },
  });

  const onSubmit = async (data: {
    name: string;
    description: string;
    startsAt: string;
    endsAt: string;
  }) => {
    try {
      await updatePhase({
        orgId,
        projectId,
        phaseId: phase.id,
        body: {
          name: data.name,
          description: data.description || null,
          startsAt: data.startsAt || null,
          endsAt: data.endsAt || null,
        },
      }).unwrap();
      toastOk('Phase updated', '');
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
      <div className="flex-1 grid grid-cols-2 gap-2">
        <input {...register('name')} className={inputCls()} placeholder="Phase name" />
        <input {...register('description')} className={inputCls()} placeholder="Description" />
        <input {...register('startsAt')} type="date" className={inputCls()} />
        <input {...register('endsAt')} type="date" className={inputCls()} />
      </div>
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

export const ProjectPhasesPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { success: toastOk, error: toastErr } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading } = useListPhasesQuery({ orgId: orgId!, projectId: projectId! });
  const [createPhase, { isLoading: creating }] = useCreatePhaseMutation();
  const [archivePhase] = useArchivePhaseMutation();
  const [reorderPhases] = useReorderPhasesMutation();

  const phases = data?.phases ?? [];
  const { register, handleSubmit, reset } = useForm({
    defaultValues: { name: '', startsAt: '', endsAt: '' },
  });

  const handleCreate = async (data: { name: string; startsAt: string; endsAt: string }) => {
    try {
      await createPhase({
        orgId: orgId!,
        projectId: projectId!,
        body: {
          name: data.name,
          startsAt: data.startsAt || undefined,
          endsAt: data.endsAt || undefined,
        },
      }).unwrap();
      reset();
      setShowAdd(false);
      toastOk('Phase created', '');
    } catch (err) {
      toastErr('Failed', toastErrorMessage(err as never));
    }
  };

  const handleArchive = async (phaseId: string) => {
    if (!confirm('Archive this phase?')) return;
    try {
      await archivePhase({ orgId: orgId!, projectId: projectId!, phaseId }).unwrap();
      toastOk('Phase archived', '');
    } catch (err) {
      toastErr('Failed', toastErrorMessage(err as never));
    }
  };

  // Simple drag-reorder (mousedown + mousemove, no external library)
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDragEnd = async () => {
    if (dragIdx === null || dragOverIdx === null || dragIdx === dragOverIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const reordered = [...phases];
    const [removed] = reordered.splice(dragIdx, 1);
    reordered.splice(dragOverIdx, 0, removed!);
    setDragIdx(null);
    setDragOverIdx(null);
    try {
      await reorderPhases({
        orgId: orgId!,
        projectId: projectId!,
        body: { orderedIds: reordered.map((p) => p.id) },
      }).unwrap();
    } catch (err) {
      toastErr('Reorder failed', toastErrorMessage(err as never));
    }
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium tracking-[-0.03em]">Phases</h2>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <Plus className="h-4 w-4" strokeWidth={2} /> Add phase
        </button>
      </div>

      <div className="border border-[var(--hairline-2)]">
        {/* Header */}
        <div className="grid grid-cols-[32px_1fr_1fr_150px_150px_80px] border-b border-[var(--hairline-2)] bg-[var(--surface-2)] px-4 py-2">
          <span />
          {['Name', 'Description', 'Starts', 'Ends', ''].map((h) => (
            <p
              key={h}
              className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]"
            >
              {h}
            </p>
          ))}
        </div>

        {isLoading ? (
          [1, 2].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]"
            />
          ))
        ) : phases.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--muted)]">
            No phases yet. Add one to structure your project work.
          </div>
        ) : (
          phases.map((phase, idx) =>
            editingId === phase.id ? (
              <EditRow
                key={phase.id}
                phase={phase}
                onDone={() => setEditingId(null)}
                orgId={orgId!}
                projectId={projectId!}
              />
            ) : (
              <div
                key={phase.id}
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverIdx(idx);
                }}
                onDragEnd={handleDragEnd}
                className={`grid grid-cols-[32px_1fr_1fr_150px_150px_80px] items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 transition-colors ${dragOverIdx === idx ? 'bg-[var(--surface-2)]' : 'bg-[var(--paper)] hover:bg-[var(--surface-2)]'}`}
              >
                <GripVertical
                  className="h-4 w-4 text-[var(--muted)] cursor-grab"
                  strokeWidth={1.6}
                />
                <p className="text-sm font-medium truncate">{phase.name}</p>
                <p className="text-sm text-[var(--muted)] truncate">{phase.description ?? '—'}</p>
                <p className="font-mono text-[10px] text-[var(--muted)]">
                  {formatDate(phase.startsAt)}
                </p>
                <p className="font-mono text-[10px] text-[var(--muted)]">
                  {formatDate(phase.endsAt)}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingId(phase.id)}
                    className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchive(phase.id)}
                    className="p-1.5 text-[var(--muted)] hover:text-[#991b1b] transition-colors"
                  >
                    <Archive className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            ),
          )
        )}

        {/* Add phase inline form */}
        {showAdd && (
          <form
            onSubmit={handleSubmit(handleCreate)}
            className="grid grid-cols-[32px_1fr_1fr_150px_150px_80px] items-center gap-2 px-4 py-3 border-t border-[var(--hairline-2)] bg-[var(--surface-2)]"
          >
            <span />
            <input
              {...register('name', { required: true })}
              placeholder="Phase name"
              className={inputCls()}
            />
            <span />
            <input {...register('startsAt')} type="date" className={inputCls()} />
            <input {...register('endsAt')} type="date" className={inputCls()} />
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
