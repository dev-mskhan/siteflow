/**
 * SequenceSettingsPage — /org/:orgId/settings/sequences
 * GET  /organizations/:orgId/document-sequences
 * PATCH /organizations/:orgId/document-sequences/:type { prefix, padding }
 *
 * NOTE: nextValue is READ-ONLY per sequences.validation.ts — not in PATCH body.
 * Permission: settings:read (view) / settings:update (edit)
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import { PermissionGate } from '../../../components/guards/PermissionGate';
import { useListSequencesQuery, useUpdateSequenceMutation, type DocumentSequenceType } from '../../../features/org/sequenceApi';
import { isToastError, toastErrorMessage } from '../../../lib/authErrors';
import { useToast } from '../../../components/ui/Toast';
import { inputCls } from '../../../components/ui/FormField';

const SEQ_LABELS: Record<DocumentSequenceType, string> = {
  PROJECT:        'Project',
  ESTIMATE:       'Estimate',
  INVOICE:        'Invoice',
  PURCHASE_ORDER: 'Purchase Order',
  CHANGE_ORDER:   'Change Order',
  RFI:            'RFI',
  SUBMITTAL:      'Submittal',
};

function previewNumber(prefix: string, padding: number, next: number): string {
  return `${prefix}${String(next).padStart(padding, '0')}`;
}

export const SequenceSettingsPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { success: toastOk, error: toastErr } = useToast();
  const { data, isLoading } = useListSequencesQuery(orgId!);
  const [updateSequence, { isLoading: saving }] = useUpdateSequenceMutation();

  // Local draft state per sequence type
  const [drafts, setDrafts] = useState<Record<string, { prefix: string; padding: number }>>({});

  const handleChange = (type: string, field: 'prefix' | 'padding', value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [type]: {
        prefix:  field === 'prefix'  ? value : (prev[type]?.prefix ?? ''),
        padding: field === 'padding' ? Math.max(1, Math.min(10, Number(value))) : (prev[type]?.padding ?? 4),
      },
    }));
  };

  const handleSave = async (type: DocumentSequenceType) => {
    const draft = drafts[type];
    if (!draft) return;
    try {
      await updateSequence({ orgId: orgId!, type, body: draft }).unwrap();
      toastOk('Sequence updated', `${SEQ_LABELS[type]} sequence has been saved.`);
      setDrafts((prev) => { const n = { ...prev }; delete n[type]; return n; });
    } catch (err) {
      if (isToastError(err as never)) toastErr('Save failed', toastErrorMessage(err as never));
    }
  };

  if (isLoading) return (
    <div className="space-y-2">
      {[1,2,3,4,5,6,7].map((i) => (
        <div key={i} className="h-14 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]" />
      ))}
    </div>
  );

  const sequences = data?.sequences ?? [];

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-[var(--muted)] mb-6">
        Configure the prefix and digit padding for each document type. The next number shown is read-only — it increments automatically when a document is created.
      </p>

      <div className="border border-[var(--hairline-2)]">
        {/* Header row */}
        <div className="grid grid-cols-[1.4fr_1fr_80px_80px_80px] gap-0 border-b border-[var(--hairline-2)] bg-[var(--surface-2)] px-4 py-2">
          {['Type', 'Prefix', 'Padding', 'Next', 'Preview'].map((h) => (
            <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
          ))}
        </div>

        {sequences.map((seq) => {
          const draft = drafts[seq.type];
          const prefix  = draft?.prefix  ?? seq.prefix;
          const padding = draft?.padding ?? seq.padding;
          const isDirty = !!draft;

          return (
            <div key={seq.type} className="grid grid-cols-[1.4fr_1fr_80px_80px_80px] gap-0 items-center border-b border-[var(--hairline-2)] last:border-b-0 px-4 py-3">
              <p className="text-sm font-medium text-[var(--ink)]">{SEQ_LABELS[seq.type as DocumentSequenceType]}</p>

              <PermissionGate require="settings:update" fallback={
                <p className="font-mono text-[10px] text-[var(--muted)]">{seq.prefix}</p>
              }>
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => handleChange(seq.type, 'prefix', e.target.value)}
                  maxLength={10}
                  className={`${inputCls()} text-xs py-1.5 max-w-[100px]`}
                />
              </PermissionGate>

              <PermissionGate require="settings:update" fallback={
                <p className="font-mono text-[10px] text-[var(--muted)]">{seq.padding}</p>
              }>
                <input
                  type="number"
                  min={1} max={10}
                  value={padding}
                  onChange={(e) => handleChange(seq.type, 'padding', e.target.value)}
                  className={`${inputCls()} text-xs py-1.5 w-14`}
                />
              </PermissionGate>

              <p className="font-mono text-[10px] text-[var(--muted)]">{seq.nextValue}</p>

              <div className="flex items-center gap-2">
                <p className="font-mono text-[10px] text-[var(--ink)]">
                  {previewNumber(prefix, padding, seq.nextValue)}
                </p>
                <PermissionGate require="settings:update">
                  {isDirty && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSave(seq.type as DocumentSequenceType)}
                      aria-label="Save"
                      className="p-1 text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                    >
                      <Save className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  )}
                </PermissionGate>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
