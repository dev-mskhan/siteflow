/**
 * SubcontractorDetailPage — /org/:orgId/subcontractors/:subcontractorId
 * Org-level subcontractor: edit info, contacts, general performance summary.
 *
 * Backend:
 *   GET   /:orgId/subcontractors/:subcontractorId               permission: project.subcontractor.read
 *   PATCH /:orgId/subcontractors/:subcontractorId               permission: project.subcontractor.update
 *   POST  /:orgId/.../subcontractors/:subcontractorId/contacts  permission: project.subcontractor.update
 *   PATCH /:orgId/.../subcontractors/:subcontractorId/contacts/:contactId  permission: project.subcontractor.update
 *
 * Validation: packages/shared/src/modules/project/subcontractor.schema.ts
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Pencil, X, Check, Plus, UserCircle } from 'lucide-react';
import {
  useGetSubcontractorQuery,
  useUpdateSubcontractorMutation,
  useListContactsQuery,
  useCreateContactMutation,
  useUpdateContactMutation,
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

export const SubcontractorDetailPage: React.FC = () => {
  const { orgId, subcontractorId } = useParams<{ orgId: string; subcontractorId: string }>();
  const { success: toastOk, error: toastErr } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

  // Edit form state
  const [eLegalName, setELegalName]   = useState('');
  const [eDisplayName, setEDisplayName] = useState('');
  const [eTrade, setETrade]           = useState('');
  const [eStatus, setEStatus]         = useState<SubcontractorStatus>('ACTIVE');
  const [eEmail, setEEmail]           = useState('');
  const [ePhone, setEPhone]           = useState('');
  const [eAddress, setEAddress]       = useState('');
  const [eRegRef, setERegRef]         = useState('');
  const [eTaxRef, setETaxRef]         = useState('');
  const [eNotes, setENotes]           = useState('');

  // New contact form state
  const [cName, setCName]       = useState('');
  const [cRole, setCRole]       = useState('');
  const [cEmail, setCEmail]     = useState('');
  const [cPhone, setCPhone]     = useState('');
  const [cPrimary, setCPrimary] = useState(false);

  // Edit contact form state
  const [ecName, setEcName]       = useState('');
  const [ecRole, setEcRole]       = useState('');
  const [ecEmail, setEcEmail]     = useState('');
  const [ecPhone, setEcPhone]     = useState('');
  const [ecActive, setEcActive]   = useState(true);

  const { data: sub, isLoading } = useGetSubcontractorQuery({ orgId: orgId!, subcontractorId: subcontractorId! });
  const { data: contacts = [] } = useListContactsQuery({ orgId: orgId!, subcontractorId: subcontractorId! });

  const [updateSubcontractor, { isLoading: saving, error: updateErr }] = useUpdateSubcontractorMutation();
  const [createContact, { isLoading: creatingC, error: createCErr }] = useCreateContactMutation();
  const [updateContact, { isLoading: updatingC }] = useUpdateContactMutation();

  const startEdit = () => {
    if (!sub) return;
    setELegalName(sub.legalName);
    setEDisplayName(sub.displayName);
    setETrade(sub.trade ?? '');
    setEStatus(sub.status);
    setEEmail(sub.primaryEmail ?? '');
    setEPhone(sub.primaryPhone ?? '');
    setEAddress(sub.address ?? '');
    setERegRef(sub.registrationReference ?? '');
    setETaxRef(sub.taxReference ?? '');
    setENotes(sub.notes ?? '');
    setIsEditing(true);
  };

  const onSave = async () => {
    try {
      await updateSubcontractor({
        orgId: orgId!,
        subcontractorId: subcontractorId!,
        input: {
          legalName: eLegalName,
          displayName: eDisplayName,
          trade: eTrade || undefined,
          status: eStatus,
          primaryEmail: eEmail || null,
          primaryPhone: ePhone || undefined,
          address: eAddress || undefined,
          registrationReference: eRegRef || undefined,
          taxReference: eTaxRef || undefined,
          notes: eNotes || undefined,
        },
      }).unwrap();
      toastOk('Subcontractor updated', '');
      setIsEditing(false);
    } catch (err) {
      if (isToastError(err as never)) toastErr('Save failed', toastErrorMessage(err as never));
    }
  };

  const onAddContact = async () => {
    if (!cName.trim()) { toastErr('Name required', ''); return; }
    try {
      await createContact({
        orgId: orgId!,
        subcontractorId: subcontractorId!,
        input: {
          name: cName.trim(),
          role: cRole.trim() || undefined,
          email: cEmail.trim() || undefined,
          phone: cPhone.trim() || undefined,
          isPrimary: cPrimary,
        },
      }).unwrap();
      toastOk('Contact added', '');
      setCName(''); setCRole(''); setCEmail(''); setCPhone(''); setCPrimary(false);
      setShowAddContact(false);
    } catch (err) {
      if (isToastError(err as never)) toastErr('Add failed', toastErrorMessage(err as never));
    }
  };

  const startEditContact = (contactId: string) => {
    const c = contacts.find((x) => x.id === contactId);
    if (!c) return;
    setEcName(c.name); setEcRole(c.role ?? ''); setEcEmail(c.email ?? '');
    setEcPhone(c.phone ?? ''); setEcActive(c.isActive);
    setEditingContactId(contactId);
  };

  const onSaveContact = async (contactId: string) => {
    try {
      await updateContact({
        orgId: orgId!,
        subcontractorId: subcontractorId!,
        contactId,
        input: {
          name: ecName,
          role: ecRole || undefined,
          email: ecEmail || null,
          phone: ecPhone || undefined,
          isActive: ecActive,
        },
      }).unwrap();
      toastOk('Contact updated', '');
      setEditingContactId(null);
    } catch (err) {
      toastErr('Update failed', toastErrorMessage(err as never));
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 sm:p-8 space-y-3">
        {[1, 2].map((i) => <div key={i} className="h-20 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]" />)}
      </div>
    );
  }
  if (!sub) {
    return <div className="p-6 sm:p-8"><p className="text-sm text-[var(--muted)]">Subcontractor not found.</p></div>;
  }

  return (
    <div className="p-6 sm:p-8 max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--hairline-2)]">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">Subcontractor</p>
          <h1 className="mt-1 text-2xl font-medium tracking-[-0.04em]">{sub.displayName}</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className={`font-mono text-[9px] uppercase tracking-[0.12em] border px-2 py-0.5 ${STATUS_BADGE[sub.status]}`}>
              {sub.status}
            </span>
            {sub.trade && (
              <span className="font-mono text-[10px] text-[var(--muted)]">{sub.trade}</span>
            )}
          </div>
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex items-center gap-1.5 border border-[var(--hairline-2)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface-2)] transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} /> Edit
          </button>
        )}
      </div>

      {/* Edit form */}
      {isEditing && (
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Edit subcontractor</p>
          {isInlineError(updateErr) && (
            <InlineAlert variant="error" message={getServerError(updateErr)?.message ?? 'Error'} />
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              { label: 'Legal name *',    value: eLegalName,   set: setELegalName,   max: 500 },
              { label: 'Display name *',  value: eDisplayName, set: setEDisplayName, max: 500 },
              { label: 'Trade',           value: eTrade,       set: setETrade,       max: 200 },
              { label: 'Email',           value: eEmail,       set: setEEmail,       max: 254 },
              { label: 'Phone',           value: ePhone,       set: setEPhone,       max: 50  },
              { label: 'Reg. reference',  value: eRegRef,      set: setERegRef,      max: 200 },
              { label: 'Tax reference',   value: eTaxRef,      set: setETaxRef,      max: 200 },
            ].map(({ label, value, set, max }) => (
              <div key={label}>
                <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">{label}</label>
                <input type="text" value={value} onChange={(e) => set(e.target.value)} maxLength={max} className={inputCls()} />
              </div>
            ))}
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Status</label>
              <select value={eStatus} onChange={(e) => setEStatus(e.target.value as SubcontractorStatus)} className={inputCls()}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Address</label>
            <input type="text" value={eAddress} onChange={(e) => setEAddress(e.target.value)} maxLength={1000} className={inputCls()} />
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Notes</label>
            <textarea value={eNotes} onChange={(e) => setENotes(e.target.value)} rows={2} maxLength={4000}
              className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onSave} disabled={saving}
              className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" onClick={() => setIsEditing(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Details read view */}
      {!isEditing && (
        <div className="grid gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Legal name',      value: sub.legalName },
            { label: 'Email',           value: sub.primaryEmail ?? '—' },
            { label: 'Phone',           value: sub.primaryPhone ?? '—' },
            { label: 'Address',         value: sub.address ?? '—' },
            { label: 'Reg. reference',  value: sub.registrationReference ?? '—' },
            { label: 'Tax reference',   value: sub.taxReference ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[var(--paper)] p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
              <p className="mt-1.5 text-sm truncate">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Notes read view */}
      {!isEditing && sub.notes && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-2">Notes</p>
          <p className="text-sm">{sub.notes}</p>
        </div>
      )}

      {/* Contacts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Contacts</p>
          <button
            type="button"
            onClick={() => setShowAddContact((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium border border-[var(--hairline-2)] px-3 py-1.5 hover:bg-[var(--surface-2)] transition-colors"
          >
            <Plus className="h-3 w-3" strokeWidth={2} /> Add contact
          </button>
        </div>

        {showAddContact && (
          <div className="mb-4 border border-[var(--hairline-2)] bg-[var(--paper)] p-4 space-y-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">New contact</p>
            {isInlineError(createCErr) && (
              <InlineAlert variant="error" message={getServerError(createCErr)?.message ?? 'Error'} />
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Name *',  value: cName,  set: setCName,  max: 300 },
                { label: 'Role',    value: cRole,  set: setCRole,  max: 200 },
                { label: 'Email',   value: cEmail, set: setCEmail, max: 254 },
                { label: 'Phone',   value: cPhone, set: setCPhone, max: 50  },
              ].map(({ label, value, set, max }) => (
                <div key={label}>
                  <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">{label}</label>
                  <input type="text" value={value} onChange={(e) => set(e.target.value)} maxLength={max} className={inputCls()} />
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={cPrimary} onChange={(e) => setCPrimary(e.target.checked)}
                className="h-3.5 w-3.5 border border-[var(--hairline-2)] accent-[var(--ink)]" />
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">Primary contact</span>
            </label>
            <div className="flex items-center gap-3">
              <button onClick={onAddContact} disabled={creatingC}
                className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50">
                {creatingC ? 'Adding…' : 'Add contact'}
              </button>
              <button type="button" onClick={() => setShowAddContact(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
            </div>
          </div>
        )}

        <div className="border border-[var(--hairline-2)]">
          {contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 bg-[var(--paper)]">
              <UserCircle className="h-8 w-8 text-[var(--muted)] mb-2" strokeWidth={1.5} />
              <p className="text-sm text-[var(--muted)]">No contacts yet.</p>
            </div>
          ) : (
            contacts.map((c) =>
              editingContactId === c.id ? (
                /* Inline edit row */
                <div key={c.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_80px] gap-2 items-center px-4 py-2.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--surface-2)]">
                  {[
                    { val: ecName, set: setEcName },
                    { val: ecRole, set: setEcRole },
                    { val: ecEmail, set: setEcEmail },
                    { val: ecPhone, set: setEcPhone },
                  ].map(({ val, set }, i) => (
                    <input key={i} type="text" value={val} onChange={(e) => set(e.target.value)} className={inputCls()} />
                  ))}
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => onSaveContact(c.id)} disabled={updatingC}
                      className="p-1.5 text-[#166534] hover:bg-[#f0fdf4] transition-colors">
                      <Check className="h-4 w-4" strokeWidth={2} />
                    </button>
                    <button type="button" onClick={() => setEditingContactId(null)}
                      className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                      <X className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              ) : (
                <div key={c.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_80px] gap-4 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{c.name}</p>
                      {c.isPrimary && (
                        <span className="font-mono text-[8px] uppercase tracking-[0.1em] border border-[var(--hairline-2)] px-1 py-0 text-[var(--muted)]">PRIMARY</span>
                      )}
                      {!c.isActive && (
                        <span className="font-mono text-[8px] uppercase tracking-[0.1em] border border-[#fecaca] bg-[#fef2f2] text-[#991b1b] px-1 py-0">INACTIVE</span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-[var(--muted)] truncate">{c.role ?? '—'}</p>
                  <p className="font-mono text-[10px] text-[var(--muted)] truncate">{c.email ?? '—'}</p>
                  <p className="font-mono text-[10px] text-[var(--muted)]">{c.phone ?? '—'}</p>
                  <button type="button" onClick={() => startEditContact(c.id)}
                    className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              )
            )
          )}
        </div>
      </div>
    </div>
  );
};
