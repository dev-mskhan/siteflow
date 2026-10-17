/**
 * SupplierDetailPage — /org/:orgId/suppliers/:supplierId
 * Shows full supplier info + contacts list.
 * Edit supplier inline. Add / edit contacts.
 * Permission: supplier:read (view) · supplier:update (edit)
 */
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit2, Plus, Phone, Mail, Globe, MapPin, Star, X } from 'lucide-react';
import {
  useGetSupplierQuery,
  useUpdateSupplierMutation,
  useListSupplierContactsQuery,
  useCreateSupplierContactMutation,
  useUpdateSupplierContactMutation,
} from '../../features/supplier/supplierApi';
import { PermissionGate } from '../../components/guards/PermissionGate';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useToast } from '../../components/ui/Toast';
import { isInlineError, isToastError, getServerError, toastErrorMessage } from '../../lib/authErrors';
import type { SupplierStatus, SupplierType } from '../../features/supplier/supplierTypes';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_BADGES: Record<SupplierStatus, string> = {
  ACTIVE:    'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  INACTIVE:  'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  SUSPENDED: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
};

const TYPE_OPTIONS = [
  { value: 'MATERIAL_SUPPLIER', label: 'Material supplier' },
  { value: 'SERVICE_PROVIDER', label: 'Service provider' },
  { value: 'EQUIPMENT_SUPPLIER', label: 'Equipment supplier' },
  { value: 'GENERAL_SUPPLIER', label: 'General supplier' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export const SupplierDetailPage: React.FC = () => {
  const { orgId, supplierId } = useParams<{ orgId: string; supplierId: string }>();
  const { success: toastOk, error: toastErr } = useToast();

  const { data: supplierData, isLoading } = useGetSupplierQuery({ orgId: orgId!, supplierId: supplierId! });
  const { data: contactsData, isLoading: contactsLoading } = useListSupplierContactsQuery({ orgId: orgId!, supplierId: supplierId! });

  const [updateSupplier, { isLoading: saving, error: updateErr }] = useUpdateSupplierMutation();
  const [createContact, { isLoading: addingContact }] = useCreateSupplierContactMutation();
  const [updateContact, { isLoading: updatingContact }] = useUpdateSupplierContactMutation();

  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', role: '', email: '', phone: '', isPrimary: false });
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContactForm, setEditContactForm] = useState<Record<string, string>>({});

  const supplier = supplierData?.supplier;
  const contacts = contactsData?.contacts ?? [];

  const openEdit = () => {
    if (!supplier) return;
    setEditForm({
      legalName: supplier.legalName,
      displayName: supplier.displayName,
      supplierType: supplier.supplierType,
      status: supplier.status,
      taxReference: supplier.taxReference ?? '',
      email: supplier.email ?? '',
      phone: supplier.phone ?? '',
      address: supplier.address ?? '',
      website: supplier.website ?? '',
      paymentTerms: supplier.paymentTerms ?? '',
      currencyCode: supplier.currencyCode ?? '',
      notes: supplier.notes ?? '',
    });
    setEditMode(true);
  };

  const handleSave = async () => {
    if (!supplier) return;
    try {
      await updateSupplier({
        orgId: orgId!,
        supplierId: supplierId!,
        body: {
          legalName: editForm.legalName || undefined,
          displayName: editForm.displayName || undefined,
          supplierType: (editForm.supplierType as SupplierType) || undefined,
          status: (editForm.status as SupplierStatus) || undefined,
          taxReference: editForm.taxReference || undefined,
          email: editForm.email || null,
          phone: editForm.phone || undefined,
          address: editForm.address || undefined,
          website: editForm.website || null,
          paymentTerms: editForm.paymentTerms || undefined,
          currencyCode: editForm.currencyCode || undefined,
          notes: editForm.notes || undefined,
        },
      }).unwrap();
      toastOk('Supplier updated', '');
      setEditMode(false);
    } catch (err) {
      if (isToastError(err as never)) toastErr('Update failed', toastErrorMessage(err as never));
    }
  };

  const handleAddContact = async () => {
    if (!contactForm.name.trim()) {
      toastErr('Name required', 'Contact name is required.');
      return;
    }
    try {
      await createContact({
        orgId: orgId!,
        supplierId: supplierId!,
        body: {
          name: contactForm.name.trim(),
          role: contactForm.role.trim() || undefined,
          email: contactForm.email.trim() || undefined,
          phone: contactForm.phone.trim() || undefined,
          isPrimary: contactForm.isPrimary,
        },
      }).unwrap();
      toastOk('Contact added', '');
      setShowAddContact(false);
      setContactForm({ name: '', role: '', email: '', phone: '', isPrimary: false });
    } catch (err) {
      if (isToastError(err as never)) toastErr('Failed to add contact', toastErrorMessage(err as never));
    }
  };

  const openEditContact = (id: string) => {
    const c = contacts.find((x) => x.id === id);
    if (!c) return;
    setEditContactForm({ name: c.name, role: c.role ?? '', email: c.email ?? '', phone: c.phone ?? '' });
    setEditingContactId(id);
  };

  const handleSaveContact = async () => {
    if (!editingContactId) return;
    try {
      await updateContact({
        orgId: orgId!,
        supplierId: supplierId!,
        contactId: editingContactId,
        body: {
          name: editContactForm.name || undefined,
          role: editContactForm.role || undefined,
          email: editContactForm.email || null,
          phone: editContactForm.phone || undefined,
        },
      }).unwrap();
      toastOk('Contact updated', '');
      setEditingContactId(null);
    } catch (err) {
      if (isToastError(err as never)) toastErr('Update failed', toastErrorMessage(err as never));
    }
  };

  if (isLoading || !supplier) {
    return (
      <div className="p-6 sm:p-8 space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]" />)}
      </div>
    );
  }

  const efField = (k: string) => (v: string) => setEditForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="p-6 sm:p-8 max-w-4xl space-y-8">
      {/* Back */}
      <Link to={`/org/${orgId}/suppliers`} className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
        All suppliers
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--hairline-2)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 ${STATUS_BADGES[supplier.status]}`}>
              {supplier.status}
            </span>
            <span className="font-mono text-[10px] text-[var(--muted)]">{supplier.supplierCode}</span>
          </div>
          <h1 className="text-2xl font-medium tracking-[-0.04em]">{supplier.displayName}</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{supplier.legalName}</p>
        </div>
        <PermissionGate require="supplier:update">
          {!editMode ? (
            <button
              onClick={openEdit}
              className="inline-flex items-center gap-2 border border-[var(--hairline-2)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-2)] transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Edit
            </button>
          ) : null}
        </PermissionGate>
      </div>

      {/* Edit form */}
      {editMode && (
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Edit supplier</p>
          {isInlineError(updateErr) && <InlineAlert variant="error" message={getServerError(updateErr).message} />}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Legal name', key: 'legalName' },
              { label: 'Display name', key: 'displayName' },
              { label: 'Tax reference', key: 'taxReference' },
              { label: 'Email', key: 'email' },
              { label: 'Phone', key: 'phone' },
              { label: 'Payment terms', key: 'paymentTerms' },
              { label: 'Currency code', key: 'currencyCode' },
              { label: 'Website', key: 'website' },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">{label}</label>
                <input
                  type="text"
                  className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
                  value={editForm[key] ?? ''}
                  onChange={(e) => efField(key)(e.target.value)}
                />
              </div>
            ))}
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Type</label>
              <CustomSelect options={TYPE_OPTIONS} value={editForm.supplierType ?? ''} onChange={efField('supplierType')} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Status</label>
              <CustomSelect options={STATUS_OPTIONS} value={editForm.status ?? ''} onChange={efField('status')} />
            </div>
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Address</label>
            <input type="text" className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" value={editForm.address ?? ''} onChange={(e) => efField('address')(e.target.value)} />
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Notes</label>
            <textarea rows={3} className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" maxLength={4000} value={editForm.notes ?? ''} onChange={(e) => efField('notes')(e.target.value)} />
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" onClick={() => setEditMode(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Info grid */}
      {!editMode && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-6">
          {[
            { label: 'Type', value: TYPE_OPTIONS.find((o) => o.value === supplier.supplierType)?.label ?? supplier.supplierType },
            { label: 'Tax reference', value: supplier.taxReference },
            { label: 'Payment terms', value: supplier.paymentTerms },
            { label: 'Currency', value: supplier.currencyCode },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
              <p className="mt-1 text-sm font-medium">{value ?? '—'}</p>
            </div>
          ))}
          {supplier.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-[var(--muted)]" strokeWidth={1.75} />
              <a href={`mailto:${supplier.email}`} className="text-sm hover:underline">{supplier.email}</a>
            </div>
          )}
          {supplier.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-[var(--muted)]" strokeWidth={1.75} />
              <p className="text-sm">{supplier.phone}</p>
            </div>
          )}
          {supplier.website && (
            <div className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-[var(--muted)]" strokeWidth={1.75} />
              <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline truncate">{supplier.website}</a>
            </div>
          )}
          {supplier.address && (
            <div className="col-span-full flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 text-[var(--muted)] mt-0.5 shrink-0" strokeWidth={1.75} />
              <p className="text-sm text-[var(--muted)]">{supplier.address}</p>
            </div>
          )}
          {supplier.notes && (
            <div className="col-span-full border-t border-[var(--hairline-2)] pt-4 mt-2">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Notes</p>
              <p className="text-sm text-[var(--muted)] whitespace-pre-wrap">{supplier.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Contacts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Contacts</p>
          <PermissionGate require="supplier:update">
            <button
              type="button"
              onClick={() => setShowAddContact((v) => !v)}
              className="inline-flex items-center gap-1.5 border border-[var(--hairline-2)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface-2)] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
              Add contact
            </button>
          </PermissionGate>
        </div>

        {/* Add contact form */}
        {showAddContact && (
          <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Name *', key: 'name' },
                { label: 'Role', key: 'role' },
                { label: 'Email', key: 'email' },
                { label: 'Phone', key: 'phone' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">{label}</label>
                  <input
                    type="text"
                    className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
                    value={contactForm[key as keyof typeof contactForm] as string}
                    onChange={(e) => setContactForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={contactForm.isPrimary}
                onChange={(e) => setContactForm((f) => ({ ...f, isPrimary: e.target.checked }))}
                className="h-4 w-4 accent-[var(--ink)]"
              />
              Set as primary contact
            </label>
            <div className="flex items-center gap-3">
              <button onClick={handleAddContact} disabled={addingContact} className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:translate-y-0">
                {addingContact ? 'Adding…' : 'Add contact'}
              </button>
              <button type="button" onClick={() => setShowAddContact(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
            </div>
          </div>
        )}

        {/* Contacts list */}
        <div className="border border-[var(--hairline-2)] divide-y divide-[var(--hairline-2)]">
          {contactsLoading ? (
            <div className="h-14 animate-pulse bg-[var(--surface-2)]" />
          ) : contacts.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">No contacts yet.</div>
          ) : (
            contacts.filter((c) => c.isActive).map((c) => (
              <div key={c.id}>
                {editingContactId === c.id ? (
                  <div className="p-4 space-y-3 bg-[var(--surface-2)]">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {['name', 'role', 'email', 'phone'].map((k) => (
                        <div key={k}>
                          <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">{k}</label>
                          <input type="text" className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" value={editContactForm[k] ?? ''} onChange={(e) => setEditContactForm((f) => ({ ...f, [k]: e.target.value }))} />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={handleSaveContact} disabled={updatingContact} className="inline-flex items-center gap-2 min-h-8 bg-[var(--ink)] px-4 text-sm font-medium text-white disabled:opacity-50">
                        {updatingContact ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" onClick={() => setEditingContactId(null)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 px-4 py-3.5 bg-[var(--paper)]">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{c.name}</p>
                        {c.isPrimary && <Star className="h-3 w-3 text-[var(--muted)] fill-[var(--muted)]" />}
                      </div>
                      <p className="font-mono text-[10px] text-[var(--muted)]">{[c.role, c.email, c.phone].filter(Boolean).join(' · ')}</p>
                    </div>
                    <PermissionGate require="supplier:update">
                      <button type="button" onClick={() => openEditContact(c.id)} className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                        <Edit2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    </PermissionGate>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
