/**
 * SuppliersPage — /org/:orgId/suppliers
 * Lists all org-level suppliers. Create inline slide-down panel.
 * Permission: supplier:read (view) · supplier:create (create button)
 */
import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, Search, ArrowUpRight, Building } from 'lucide-react';
import { PermissionGate } from '../../components/guards/PermissionGate';
import { useListSuppliersQuery, useCreateSupplierMutation } from '../../features/supplier/supplierApi';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { useToast } from '../../components/ui/Toast';
import { isInlineError, isToastError, getServerError, toastErrorMessage } from '../../lib/authErrors';
import { cn } from '../../lib/cn';
import type { SupplierStatus, SupplierType } from '../../features/supplier/supplierTypes';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_BADGES: Record<SupplierStatus, string> = {
  ACTIVE:    'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  INACTIVE:  'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  SUSPENDED: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
};

const TYPE_LABELS: Record<SupplierType, string> = {
  MATERIAL_SUPPLIER:  'Material',
  SERVICE_PROVIDER:   'Service',
  EQUIPMENT_SUPPLIER: 'Equipment',
  GENERAL_SUPPLIER:   'General',
};

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'MATERIAL_SUPPLIER', label: 'Material supplier' },
  { value: 'SERVICE_PROVIDER', label: 'Service provider' },
  { value: 'EQUIPMENT_SUPPLIER', label: 'Equipment supplier' },
  { value: 'GENERAL_SUPPLIER', label: 'General supplier' },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export const SuppliersPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { success: toastOk, error: toastErr } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Form state
  const [form, setForm] = useState({
    legalName: '', displayName: '',
    supplierType: '', email: '', phone: '', address: '',
    website: '', paymentTerms: '', currencyCode: '', notes: '',
  });

  const { data, isLoading } = useListSuppliersQuery({
    orgId: orgId!,
    status: statusFilter || undefined,
  });
  const [createSupplier, { isLoading: creating, error: createErr }] = useCreateSupplierMutation();

  const allSuppliers = data?.data ?? [];
  const suppliers = allSuppliers.filter((s) =>
    !search ||
    s.displayName.toLowerCase().includes(search.toLowerCase()) ||
    s.legalName.toLowerCase().includes(search.toLowerCase()) ||
    s.supplierCode.toLowerCase().includes(search.toLowerCase()),
  );

  const setField = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.legalName.trim() || !form.displayName.trim()) {
      toastErr('Required fields missing', 'Legal name and display name are required.');
      return;
    }
    try {
      await createSupplier({
        orgId: orgId!,
        body: {
          legalName: form.legalName.trim(),
          displayName: form.displayName.trim(),
          supplierType: (form.supplierType as SupplierType) || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          address: form.address.trim() || undefined,
          website: form.website.trim() || undefined,
          paymentTerms: form.paymentTerms.trim() || undefined,
          currencyCode: form.currencyCode.trim() || undefined,
          notes: form.notes.trim() || undefined,
        },
      }).unwrap();
      toastOk('Supplier created', '');
      setShowCreate(false);
      setForm({ legalName: '', displayName: '', supplierType: '', email: '', phone: '', address: '', website: '', paymentTerms: '', currencyCode: '', notes: '' });
    } catch (err) {
      if (isToastError(err as never)) toastErr('Create failed', toastErrorMessage(err as never));
    }
  };

  return (
    <div className="p-6 sm:p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-medium tracking-[-0.03em]">Suppliers</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <PermissionGate require="supplier:create">
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New supplier
          </button>
        </PermissionGate>
      </div>

      {/* Create panel */}
      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New supplier</p>
          {isInlineError(createErr) && (
            <InlineAlert variant="error" message={getServerError(createErr).message} />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Legal name *', key: 'legalName', placeholder: 'Company (Pvt) Ltd', hint: '1–500 chars' },
              { label: 'Display name *', key: 'displayName', placeholder: 'Short name', hint: '1–500 chars' },
            ].map(({ label, key, placeholder, hint }) => (
              <div key={key}>
                <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
                  {label}
                </label>
                <input
                  type="text"
                  className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
                  placeholder={placeholder}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setField(key as keyof typeof form)(e.target.value)}
                />
                <p className="mt-1 font-mono text-[9px] text-[var(--muted)]">{hint}</p>
              </div>
            ))}
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Type</label>
              <CustomSelect options={TYPE_OPTIONS.slice(1)} value={form.supplierType} onChange={setField('supplierType')} placeholder="Select type…" />
            </div>
            {[
              { label: 'Email', key: 'email', placeholder: 'sales@supplier.com', type: 'email' },
              { label: 'Phone', key: 'phone', placeholder: '+92-300-0000000', type: 'text' },
              { label: 'Payment terms', key: 'paymentTerms', placeholder: 'Net 30', type: 'text' },
              { label: 'Currency', key: 'currencyCode', placeholder: 'PKR', type: 'text' },
              { label: 'Website', key: 'website', placeholder: 'https://...', type: 'url' },
            ].map(({ label, key, placeholder, type }) => (
              <div key={key}>
                <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">{label}</label>
                <input
                  type={type}
                  className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
                  placeholder={placeholder}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setField(key as keyof typeof form)(e.target.value)}
                />
              </div>
            ))}
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Address</label>
            <input
              type="text"
              className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
              placeholder="Street, city, country"
              value={form.address}
              onChange={(e) => setField('address')(e.target.value)}
            />
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Notes</label>
            <textarea
              rows={3}
              className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
              placeholder="Internal notes (max 4000 chars)"
              maxLength={4000}
              value={form.notes}
              onChange={(e) => setField('notes')(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
            >
              {creating ? 'Creating…' : 'Create supplier'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" strokeWidth={1.8} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers…"
            className="w-full pl-9 pr-3 py-2 border border-[var(--hairline-2)] bg-[var(--paper)] text-sm placeholder:text-[var(--muted)] focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
          />
        </div>
        <div className="flex border border-[var(--hairline-2)] bg-[var(--paper)]">
          {STATUS_FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={cn(
                'shrink-0 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors',
                statusFilter === value
                  ? 'bg-[var(--ink)] text-white'
                  : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="border border-[var(--hairline-2)] divide-y divide-[var(--hairline-2)]">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse bg-[var(--surface-2)]" />)}
        </div>
      ) : suppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-[var(--hairline-2)] bg-[var(--paper)]">
          <Building className="h-10 w-10 text-[var(--muted)] mb-4" strokeWidth={1.5} />
          <p className="text-sm font-medium">No suppliers found</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {search || statusFilter ? 'Try adjusting your filters.' : 'Add your first supplier to get started.'}
          </p>
        </div>
      ) : (
        <div className="border border-[var(--hairline-2)]">
          {/* Header row */}
          <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
            {['Code', 'Name', 'Type', 'Status', 'Payment terms', ''].map((h, i) => (
              <p key={i} className={cn('font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]',
                i === 0 ? 'col-span-2' : i === 1 ? 'col-span-3' : i === 2 ? 'col-span-2' : i === 3 ? 'col-span-2' : i === 4 ? 'col-span-2' : 'col-span-1',
              )}>
                {h}
              </p>
            ))}
          </div>

          {suppliers.map((s) => (
            <div key={s.id} className="grid grid-cols-12 gap-4 px-4 py-3.5 items-center border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
              <div className="col-span-2">
                <p className="font-mono text-[11px] text-[var(--muted)]">{s.supplierCode}</p>
              </div>
              <div className="col-span-3 min-w-0">
                <p className="text-sm font-medium truncate">{s.displayName}</p>
                <p className="font-mono text-[10px] text-[var(--muted)] truncate">{s.legalName}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-[var(--muted)]">{TYPE_LABELS[s.supplierType]}</p>
              </div>
              <div className="col-span-2">
                <span className={`font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 ${STATUS_BADGES[s.status]}`}>
                  {s.status}
                </span>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-[var(--muted)]">{s.paymentTerms ?? '—'}</p>
              </div>
              <div className="col-span-1 flex justify-end">
                <Link
                  to={`/org/${s.organizationId}/suppliers/${s.id}`}
                  className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                  aria-label={`View ${s.displayName}`}
                >
                  <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
