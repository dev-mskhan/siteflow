/**
 * PricingPage — /org/:orgId/projects/:projectId/preconstruction/pricing
 *
 * Backend:
 *   GET  /:orgId/projects/:projectId/pricing/rates                       permission: project.pricing.read
 *     querystring: materialId (required)
 *   POST /:orgId/projects/:projectId/pricing/rates                       permission: project.pricing.manage
 *   GET  /:orgId/projects/:projectId/pricing/rates/:rateId               permission: project.pricing.read
 *   POST /:orgId/projects/:projectId/pricing/rates/:rateId/approve       permission: project.pricing.approve
 *   POST /:orgId/projects/:projectId/pricing/rates/:rateId/retire        permission: project.pricing.manage
 *     body: { effectiveTo: YYYY-MM-DD }
 *   GET  /:orgId/projects/:projectId/pricing/resolve                     permission: project.pricing.read
 *     querystring: materialId (required), asOf (YYYY-MM-DD required), projectId? (optional)
 *
 * State machine (pricing.service.ts):
 *   DRAFT → APPROVED (approve) → RETIRED (retire with effectiveTo)
 *   Only one APPROVED rate per material/scope/period (overlap check)
 *   Actor separation on approve (assertFinancialActorSeparation)
 *   rate.unitCode must match material.defaultUnitCode
 *   effectiveTo must be after effectiveFrom; cannot extend approved period when retiring
 *
 * Validation: packages/shared/src/modules/project/pricing.schema.ts
 *   unitPrice: /^\d{1,11}(?:\.\d{1,4})?$/
 *   currencyCode: /^[A-Z]{3}$/
 *   effectiveTo > effectiveFrom
 *   scope='PROJECT' → projectId required
 *   scope='ORGANIZATION' → projectId must be null
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Tag } from 'lucide-react';
import {
  useListRateVersionsQuery,
  useCreateRateVersionMutation,
  useApproveRateVersionMutation,
  useRetireRateVersionMutation,
} from '../../api/preconstructionApi';
import { useListMaterialsQuery } from '../../features/material/materialApi';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../components/ui/Toast';
import { isToastError, toastErrorMessage } from '../../lib/authErrors';
import { inputCls } from '../../components/ui/FormField';
import { MOCK_MATERIAL_NAMES_PRECONSTRUCTION } from '../../fixtures/preconstruction.fixtures';
import type { PricingRateStatus } from '../../types/preconstructionTypes';

const STATUS_BADGE: Record<PricingRateStatus, string> = {
  DRAFT:    'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  APPROVED: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  RETIRED:  'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)] opacity-60',
};

export const PricingPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const canManage  = usePermission('project.pricing.manage');
  const canApprove = usePermission('project.pricing.approve');
  const { success: toastOk, error: toastErr } = useToast();

  const [selectedMaterialId, setSelectedMaterialId] = useState('mat_01');
  const [showCreate, setShowCreate] = useState(false);
  const [retiringId, setRetiringId] = useState<string | null>(null);
  const [retireDate, setRetireDate] = useState('');

  // Create form
  const [unitPrice, setUnitPrice] = useState('');
  const [currencyCode, setCurrencyCode] = useState('PKR');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]!);
  const [effectiveTo, setEffectiveTo] = useState('');
  const [scope, setScope] = useState<'PROJECT' | 'ORGANIZATION'>('PROJECT');

  const { data: rates = [], isLoading: ratesLoading } = useListRateVersionsQuery({
    orgId: orgId!,
    projectId: projectId!,
    materialId: selectedMaterialId,
  }, { skip: !selectedMaterialId });

  const { data: materialsData } = useListMaterialsQuery({ orgId: orgId! });

  const [createRate, { isLoading: creating }] = useCreateRateVersionMutation();
  const [approveRate, { isLoading: approving }] = useApproveRateVersionMutation();
  const [retireRate, { isLoading: retiring }] = useRetireRateVersionMutation();

  const onCreate = async () => {
    if (!unitPrice.trim() || !effectiveFrom) { toastErr('Unit price and effective from required', ''); return; }
    try {
      await createRate({
        orgId: orgId!, projectId: projectId!,
        input: {
          materialId: selectedMaterialId,
          scope,
          projectId: scope === 'PROJECT' ? projectId : undefined,
          unitCode: materialsData?.materials.find((m) => m.id === selectedMaterialId)?.defaultUnitCode ?? 'KG',
          unitPrice: unitPrice.trim(),
          currencyCode: currencyCode.toUpperCase(),
          effectiveFrom,
          effectiveTo: effectiveTo || undefined,
        },
      }).unwrap();
      toastOk('Rate version created', '');
      setShowCreate(false); setUnitPrice(''); setEffectiveTo('');
    } catch (err) {
      if (isToastError(err as never)) toastErr('Create failed', toastErrorMessage(err as never));
    }
  };

  const onApprove = async (rateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await approveRate({ orgId: orgId!, projectId: projectId!, rateId }).unwrap();
      toastOk('Rate approved', '');
    } catch (err) { toastErr('Approve failed', toastErrorMessage(err as never)); }
  };

  const onRetire = async () => {
    if (!retiringId || !retireDate) { toastErr('Effective-to date required', ''); return; }
    try {
      await retireRate({ orgId: orgId!, projectId: projectId!, rateId: retiringId, effectiveTo: retireDate }).unwrap();
      toastOk('Rate retired', '');
      setRetiringId(null); setRetireDate('');
    } catch (err) { toastErr('Retire failed', toastErrorMessage(err as never)); }
  };

  const materials = materialsData?.materials ?? [];
  const materialName = (id: string) =>
    materials.find((m) => m.id === id)?.name ?? MOCK_MATERIAL_NAMES_PRECONSTRUCTION[id] ?? id;

  return (
    <div className="p-6 sm:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Pricing rates</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            Material rate versions — project or organisation scope
          </p>
        </div>
        {canManage && !showCreate && selectedMaterialId && (
          <button type="button" onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0">
            <Plus className="h-4 w-4" strokeWidth={2} /> New rate version
          </button>
        )}
      </div>

      {/* Material selector */}
      <div className="mb-6">
        <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Material</label>
        <select value={selectedMaterialId} onChange={(e) => setSelectedMaterialId(e.target.value)}
          className="border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)] min-w-[280px]">
          {materials.length > 0
            ? materials.map((m) => <option key={m.id} value={m.id}>{m.materialCode} — {m.name}</option>)
            : Object.entries(MOCK_MATERIAL_NAMES_PRECONSTRUCTION).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
        </select>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New rate version — {materialName(selectedMaterialId)}</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Scope</label>
              <select value={scope} onChange={(e) => setScope(e.target.value as any)} className={inputCls()}>
                <option value="PROJECT">Project</option>
                <option value="ORGANIZATION">Organisation</option>
              </select>
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Unit price * <span className="normal-case tracking-normal text-[8px]">(up to 4 dp)</span></label>
              <input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="e.g. 110.0000" className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Currency</label>
              <input value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())} maxLength={3} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Effective from *</label>
              <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Effective to</label>
              <input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} className={inputCls()} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreate} disabled={creating}
              className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50">
              {creating ? 'Creating…' : 'Create rate version'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Retire inline form */}
      {retiringId && (
        <div className="mb-4 border border-[var(--hairline-2)] bg-[var(--paper)] p-4 flex items-center gap-3">
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Retire effective to *</label>
            <input type="date" value={retireDate} onChange={(e) => setRetireDate(e.target.value)} className={inputCls()} />
          </div>
          <button onClick={onRetire} disabled={retiring}
            className="font-mono text-[9px] uppercase border border-[#fde68a] bg-[#fffbeb] text-[#92400e] px-3 py-2 hover:bg-[#fef3c7] disabled:opacity-50 mt-5">
            {retiring ? 'Retiring…' : 'Confirm retire'}
          </button>
          <button type="button" onClick={() => setRetiringId(null)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)] mt-5">✕</button>
        </div>
      )}

      {/* Rates table */}
      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[50px_2fr_90px_90px_90px_90px_140px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['Ver.', 'Material', 'Status', 'Unit price', 'From', 'To', ''].map((h) => (
            <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
          ))}
        </div>

        {!selectedMaterialId ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--muted)]">Select a material to view rates.</div>
        ) : ratesLoading ? (
          [1, 2].map((i) => <div key={i} className="h-10 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />)
        ) : rates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-[var(--paper)]">
            <Tag className="h-8 w-8 text-[var(--muted)] mb-2" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No rate versions for this material.</p>
          </div>
        ) : (
          rates.map((r) => (
            <div key={r.id} className="grid grid-cols-[50px_2fr_90px_90px_90px_90px_140px] gap-3 items-center px-4 py-3 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]">
              <p className="font-mono text-[10px] text-[var(--muted)]">v{r.versionNumber}</p>
              <div>
                <p className="text-sm truncate">{materialName(r.materialId)}</p>
                <p className="font-mono text-[9px] text-[var(--muted)]">{r.scope} · {r.unitCode}</p>
              </div>
              <span className={`inline-block font-mono text-[9px] uppercase tracking-[0.1em] border px-1.5 py-0.5 w-fit ${STATUS_BADGE[r.status]}`}>{r.status}</span>
              <p className="font-mono text-[11px] font-medium">{r.currencyCode} {r.unitPrice}</p>
              <p className="font-mono text-[10px] text-[var(--muted)]">{r.effectiveFrom}</p>
              <p className="font-mono text-[10px] text-[var(--muted)]">{r.effectiveTo ?? 'open'}</p>

              <div className="flex gap-1.5">
                {r.status === 'DRAFT' && canApprove && (
                  <button onClick={(e) => onApprove(r.id, e)} disabled={approving}
                    className="font-mono text-[8px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-1.5 py-0.5 hover:bg-[#dcfce7] disabled:opacity-50">
                    Approve
                  </button>
                )}
                {r.status === 'APPROVED' && canManage && (
                  <button onClick={() => { setRetiringId(r.id); setRetireDate(''); }}
                    className="font-mono text-[8px] uppercase border border-[#fde68a] bg-[#fffbeb] text-[#92400e] px-1.5 py-0.5 hover:bg-[#fef3c7]">
                    Retire
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
