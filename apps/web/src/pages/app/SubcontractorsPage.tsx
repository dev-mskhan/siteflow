/**
 * SubcontractorsPage — /org/:orgId/subcontractors
 * Org-level subcontractor catalog. Create + list.
 *
 * Backend:
 *   GET  /:orgId/subcontractors               permission: project.subcontractor.read (org-admin)
 *   POST /:orgId/subcontractors               permission: project.subcontractor.create
 *
 * Validation: packages/shared/src/modules/project/subcontractor.schema.ts
 *   legalName:    min:1 max:500
 *   displayName:  min:1 max:500
 *   trade:        max:200
 *   primaryEmail: email max:254
 *   primaryPhone: max:50
 *   address:      max:1000
 *   notes:        max:4000
 */
import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, ArrowUpRight, HardHat } from 'lucide-react';
import {
  useListSubcontractorsQuery,
  useCreateSubcontractorMutation,
} from '../../api/subcontractorApi';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useToast } from '../../components/ui/Toast';
import {
  getServerError,
  isInlineError,
  isToastError,
  toastErrorMessage,
} from '../../lib/authErrors';
import { inputCls } from '../../components/ui/FormField';
import type { SubcontractorStatus } from '../../types/subcontractorTypes';

const STATUS_BADGE: Record<SubcontractorStatus, string> = {
  ACTIVE:    'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  INACTIVE:  'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  SUSPENDED: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
};

const STATUS_FILTER_OPTIONS = ['ALL', 'ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;

export const SubcontractorsPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { success: toastOk, error: toastErr } = useToast();

  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTER_OPTIONS[number]>('ALL');
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [legalName, setLegalName]     = useState('');
  const [displayName, setDisplayName] = useState('');
  const [trade, setTrade]             = useState('');
  const [primaryEmail, setPrimaryEmail] = useState('');
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [address, setAddress]         = useState('');
  const [notes, setNotes]             = useState('');

  const { data, isLoading } = useListSubcontractorsQuery({
    orgId: orgId!,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
  });
  const [createSubcontractor, { isLoading: creating, error: createErr }] =
    useCreateSubcontractorMutation();

  const handleCreate = async () => {
    if (!legalName.trim() || !displayName.trim()) {
      toastErr('Required fields missing', 'Legal name and display name are required.');
      return;
    }
    try {
      await createSubcontractor({
        orgId: orgId!,
        input: {
          legalName: legalName.trim(),
          displayName: displayName.trim(),
          trade: trade.trim() || undefined,
          primaryEmail: primaryEmail.trim() || undefined,
          primaryPhone: primaryPhone.trim() || undefined,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      }).unwrap();
      toastOk('Subcontractor created', '');
      setShowCreate(false);
      setLegalName(''); setDisplayName(''); setTrade('');
      setPrimaryEmail(''); setPrimaryPhone(''); setAddress(''); setNotes('');
    } catch (err) {
      if (isToastError(err as never)) toastErr('Create failed', toastErrorMessage(err as never));
    }
  };

  const subcontractors = data?.data ?? [];

  return (
    <div className="p-6 sm:p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-medium tracking-[-0.03em]">Subcontractors</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {subcontractors.length} subcontractor{subcontractors.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          New subcontractor
        </button>
      </div>

      {/* Create panel */}
      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            New subcontractor
          </p>
          {isInlineError(createErr) && (
            <InlineAlert variant="error" message={getServerError(createErr)?.message ?? 'Error'} />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Legal name *',   value: legalName,    onChange: setLegalName,    placeholder: 'Al-Barkat Construction (Pvt) Ltd', max: 500 },
              { label: 'Display name *', value: displayName,  onChange: setDisplayName,  placeholder: 'Al-Barkat Construction', max: 500 },
              { label: 'Trade',          value: trade,        onChange: setTrade,        placeholder: 'Civil & Structural', max: 200 },
              { label: 'Email',          value: primaryEmail, onChange: setPrimaryEmail, placeholder: 'contracts@sub.com', max: 254 },
              { label: 'Phone',          value: primaryPhone, onChange: setPrimaryPhone, placeholder: '+92-300-0000000', max: 50 },
            ].map(({ label, value, onChange, placeholder, max }) => (
              <div key={label}>
                <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
                  {label}
                </label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={placeholder}
                  maxLength={max}
                  className={inputCls()}
                />
              </div>
            ))}
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
              Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, city, country"
              maxLength={1000}
              className={inputCls()}
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
              placeholder="Internal notes (max 4000 chars)"
              className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
            />
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0"
            >
              {creating ? 'Creating…' : 'Create subcontractor'}
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

      {/* Status filter */}
      <div className="flex border border-[var(--hairline-2)] mb-6 w-fit">
        {STATUS_FILTER_OPTIONS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            className={`px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
              statusFilter === f
                ? 'bg-[var(--ink)] text-white'
                : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[1fr_1fr_120px_120px_80px_40px] gap-4 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['Name', 'Trade', 'Status', 'Email', 'Phone', ''].map((h) => (
            <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">
              {h}
            </p>
          ))}
        </div>

        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />
          ))
        ) : subcontractors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <HardHat className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">
              {statusFilter === 'ALL' ? 'No subcontractors yet.' : `No ${statusFilter.toLowerCase()} subcontractors.`}
            </p>
          </div>
        ) : (
          subcontractors.map((sub) => (
            <div
              key={sub.id}
              className="grid grid-cols-[1fr_1fr_120px_120px_80px_40px] gap-4 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{sub.displayName}</p>
                <p className="font-mono text-[10px] text-[var(--muted)] truncate">{sub.legalName}</p>
              </div>
              <p className="text-sm text-[var(--muted)] truncate">{sub.trade ?? '—'}</p>
              <span className={`inline-block font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 w-fit ${STATUS_BADGE[sub.status]}`}>
                {sub.status}
              </span>
              <p className="font-mono text-[10px] text-[var(--muted)] truncate">{sub.primaryEmail ?? '—'}</p>
              <p className="font-mono text-[10px] text-[var(--muted)] truncate">{sub.primaryPhone ?? '—'}</p>
              <Link
                to={`/org/${orgId}/subcontractors/${sub.id}`}
                aria-label={`View ${sub.displayName}`}
                className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
