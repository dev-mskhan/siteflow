/**
 * MaterialsPage — /org/:orgId/materials
 * Lists org material catalog. Create + inline edit.
 * Permission: material:read (view) · material:create · material:update
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Search, Edit2, Package } from 'lucide-react';
import { PermissionGate } from '../../components/guards/PermissionGate';
import {
  useListMaterialsQuery,
  useCreateMaterialMutation,
  useUpdateMaterialMutation,
} from '../../features/material/materialApi';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useToast } from '../../components/ui/Toast';
import { isInlineError, isToastError, getServerError, toastErrorMessage } from '../../lib/authErrors';
import { cn } from '../../lib/cn';
import type { MaterialDTO, MaterialStatus, MaterialType } from '../../features/material/materialTypes';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_BADGES: Record<MaterialStatus, string> = {
  ACTIVE:   'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  INACTIVE: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
};

const TYPE_LABELS: Record<MaterialType, string> = {
  MATERIAL:    'Material',
  EQUIPMENT:   'Equipment',
  CONSUMABLE:  'Consumable',
  SERVICE:     'Service',
  OTHER:       'Other',
};

const TYPE_OPTIONS = [
  { value: 'MATERIAL', label: 'Material' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'CONSUMABLE', label: 'Consumable' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'OTHER', label: 'Other' },
];

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const inputCls = 'w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]';

// ── Inline edit row ───────────────────────────────────────────────────────────

const EditRow: React.FC<{
  material: MaterialDTO;
  orgId: string;
  onDone: () => void;
}> = ({ material, orgId, onDone }) => {
  const { success: toastOk, error: toastErr } = useToast();
  const [updateMaterial, { isLoading: saving, error: updateErr }] = useUpdateMaterialMutation();
  const [form, setForm] = useState({
    name: material.name,
    description: material.description ?? '',
    category: material.category ?? '',
    defaultUnitCode: material.defaultUnitCode,
    materialType: material.materialType,
    status: material.status,
    defaultTaxCode: material.defaultTaxCode ?? '',
    defaultCurrencyCode: material.defaultCurrencyCode ?? '',
  });

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    try {
      await updateMaterial({
        orgId,
        materialId: material.id,
        body: {
          name: form.name || undefined,
          description: form.description || undefined,
          category: form.category || undefined,
          defaultUnitCode: form.defaultUnitCode || undefined,
          materialType: (form.materialType as MaterialType) || undefined,
          status: (form.status as MaterialStatus) || undefined,
          defaultTaxCode: form.defaultTaxCode || undefined,
          defaultCurrencyCode: form.defaultCurrencyCode || undefined,
        },
      }).unwrap();
      toastOk('Material updated', '');
      onDone();
    } catch (err) {
      if (isToastError(err as never)) toastErr('Update failed', toastErrorMessage(err as never));
    }
  };

  return (
    <div className="col-span-full px-4 py-4 bg-[var(--surface-2)] border-b border-[var(--hairline-2)] space-y-3">
      {isInlineError(updateErr) && <InlineAlert variant="error" message={getServerError(updateErr).message} />}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">Name</label>
          <input type="text" className={inputCls} value={form.name} onChange={(e) => set('name')(e.target.value)} />
        </div>
        <div>
          <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">Unit code</label>
          <input type="text" className={inputCls} value={form.defaultUnitCode} onChange={(e) => set('defaultUnitCode')(e.target.value.toUpperCase())} maxLength={20} />
        </div>
        <div>
          <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">Category</label>
          <input type="text" className={inputCls} value={form.category} onChange={(e) => set('category')(e.target.value)} maxLength={200} />
        </div>
        <div>
          <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">Type</label>
          <CustomSelect options={TYPE_OPTIONS} value={form.materialType} onChange={set('materialType')} />
        </div>
        <div>
          <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">Status</label>
          <CustomSelect options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]} value={form.status} onChange={set('status')} />
        </div>
        <div>
          <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">Tax code</label>
          <input type="text" className={inputCls} value={form.defaultTaxCode} onChange={(e) => set('defaultTaxCode')(e.target.value)} maxLength={50} />
        </div>
        <div>
          <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">Currency</label>
          <input type="text" className={inputCls} value={form.defaultCurrencyCode} onChange={(e) => set('defaultCurrencyCode')(e.target.value.toUpperCase())} maxLength={3} />
        </div>
      </div>
      <div>
        <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">Description</label>
        <textarea rows={2} className={`${inputCls} resize-none`} value={form.description} onChange={(e) => set('description')(e.target.value)} maxLength={2000} />
      </div>
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:translate-y-0">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onDone} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
      </div>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

export const MaterialsPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { success: toastOk, error: toastErr } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    materialCode: '', name: '', description: '', category: '',
    defaultUnitCode: '', materialType: 'MATERIAL', defaultTaxCode: '', defaultCurrencyCode: '',
  });

  const { data, isLoading } = useListMaterialsQuery({
    orgId: orgId!,
    status: statusFilter || undefined,
  });
  const [createMaterial, { isLoading: creating, error: createErr }] = useCreateMaterialMutation();

  const allMaterials = data?.materials ?? [];
  const materials = allMaterials.filter(
    (m) => !search || m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.materialCode.toLowerCase().includes(search.toLowerCase()) ||
      (m.category ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const cf = (k: keyof typeof createForm) => (v: string) => setCreateForm((f) => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!createForm.materialCode.trim() || !createForm.name.trim() || !createForm.defaultUnitCode.trim()) {
      toastErr('Required fields', 'Code, name and unit code are required.');
      return;
    }
    try {
      await createMaterial({
        orgId: orgId!,
        body: {
          materialCode: createForm.materialCode.trim(),
          name: createForm.name.trim(),
          description: createForm.description.trim() || undefined,
          category: createForm.category.trim() || undefined,
          defaultUnitCode: createForm.defaultUnitCode.trim(),
          materialType: (createForm.materialType as MaterialType) || undefined,
          defaultTaxCode: createForm.defaultTaxCode.trim() || undefined,
          defaultCurrencyCode: createForm.defaultCurrencyCode.trim() || undefined,
        },
      }).unwrap();
      toastOk('Material created', '');
      setShowCreate(false);
      setCreateForm({ materialCode: '', name: '', description: '', category: '', defaultUnitCode: '', materialType: 'MATERIAL', defaultTaxCode: '', defaultCurrencyCode: '' });
    } catch (err) {
      if (isToastError(err as never)) toastErr('Create failed', toastErrorMessage(err as never));
    }
  };

  // Unique categories for potential filter
  const categories = [...new Set(allMaterials.map((m) => m.category).filter(Boolean))] as string[];

  return (
    <div className="p-6 sm:p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-medium tracking-[-0.03em]">Materials</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {materials.length} item{materials.length !== 1 ? 's' : ''}
            {categories.length > 0 && ` · ${categories.length} categories`}
          </p>
        </div>
        <PermissionGate require="material:create">
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New material
          </button>
        </PermissionGate>
      </div>

      {/* Create panel */}
      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New material</p>
          {isInlineError(createErr) && <InlineAlert variant="error" message={getServerError(createErr).message} />}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Material code *', key: 'materialCode', hint: '1–100 chars' },
              { label: 'Name *', key: 'name', hint: '1–500 chars' },
              { label: 'Unit code *', key: 'defaultUnitCode', hint: 'e.g. MT, BAG, M3 (uppercase)' },
              { label: 'Category', key: 'category', hint: 'Optional, max 200' },
              { label: 'Default tax code', key: 'defaultTaxCode', hint: 'e.g. GST17' },
              { label: 'Default currency', key: 'defaultCurrencyCode', hint: '3-char, e.g. PKR' },
            ].map(({ label, key, hint }) => (
              <div key={key}>
                <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">{label}</label>
                <input
                  type="text"
                  className={inputCls}
                  value={createForm[key as keyof typeof createForm]}
                  onChange={(e) => cf(key as keyof typeof createForm)(e.target.value)}
                />
                <p className="mt-1 font-mono text-[9px] text-[var(--muted)]">{hint}</p>
              </div>
            ))}
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Type</label>
              <CustomSelect options={TYPE_OPTIONS} value={createForm.materialType} onChange={cf('materialType')} />
            </div>
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Description</label>
            <textarea rows={2} className={`${inputCls} resize-none`} placeholder="Optional description (max 2000 chars)" maxLength={2000} value={createForm.description} onChange={(e) => cf('description')(e.target.value)} />
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={handleCreate} disabled={creating} className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:translate-y-0">
              {creating ? 'Creating…' : 'Create material'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
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
            placeholder="Search by name, code or category…"
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
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 animate-pulse bg-[var(--surface-2)]" />)}
        </div>
      ) : materials.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-[var(--hairline-2)] bg-[var(--paper)]">
          <Package className="h-10 w-10 text-[var(--muted)] mb-4" strokeWidth={1.5} />
          <p className="text-sm font-medium">No materials found</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {search || statusFilter ? 'Try adjusting your filters.' : 'Add your first material to get started.'}
          </p>
        </div>
      ) : (
        <div className="border border-[var(--hairline-2)]">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
            {[
              { label: 'Code', span: 'col-span-2' },
              { label: 'Name', span: 'col-span-4' },
              { label: 'Type', span: 'col-span-2' },
              { label: 'Category', span: 'col-span-2' },
              { label: 'Unit', span: 'col-span-1' },
              { label: 'Status', span: 'col-span-1' },
            ].map(({ label, span }) => (
              <p key={label} className={`font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] ${span}`}>{label}</p>
            ))}
          </div>

          {materials.map((m) => (
            <React.Fragment key={m.id}>
              <div className={cn(
                'grid grid-cols-12 gap-4 px-4 py-3 items-center border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]',
                editingId !== m.id && 'hover:bg-[var(--surface-2)] transition-colors',
              )}>
                <div className="col-span-2">
                  <p className="font-mono text-[11px] text-[var(--muted)]">{m.materialCode}</p>
                </div>
                <div className="col-span-4 min-w-0">
                  <p className="text-sm font-medium truncate">{m.name}</p>
                  {m.description && <p className="font-mono text-[10px] text-[var(--muted)] truncate">{m.description}</p>}
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-[var(--muted)]">{TYPE_LABELS[m.materialType]}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-[var(--muted)]">{m.category ?? '—'}</p>
                </div>
                <div className="col-span-1">
                  <p className="font-mono text-[11px] text-[var(--muted)]">{m.defaultUnitCode}</p>
                </div>
                <div className="col-span-1 flex items-center justify-between gap-1">
                  <span className={`font-mono text-[9px] uppercase tracking-[0.12em] border px-1 py-0.5 ${STATUS_BADGES[m.status]}`}>
                    {m.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </span>
                  <PermissionGate require="material:update">
                    <button
                      type="button"
                      onClick={() => setEditingId(editingId === m.id ? null : m.id)}
                      className="p-1 text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                      aria-label="Edit material"
                    >
                      <Edit2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </PermissionGate>
                </div>
              </div>

              {editingId === m.id && (
                <EditRow material={m} orgId={orgId!} onDone={() => setEditingId(null)} />
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
