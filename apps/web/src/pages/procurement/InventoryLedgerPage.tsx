/**
 * InventoryLedgerPage — /org/:orgId/projects/:projectId/inventory
 * Project inventory balances + adjustment panel.
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Archive } from 'lucide-react';
import {
  useListInventoryQuery,
  useGetInventoryTransactionsQuery,
  useAdjustInventoryMutation,
} from '../../features/project/procurementApi';
import { useListMaterialsQuery } from '../../features/material/materialApi';
import { usePermission } from '../../hooks/usePermission';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useToast } from '../../components/ui/Toast';
import { getServerError, isInlineError, isToastError, toastErrorMessage } from '../../lib/authErrors';
import type { InventoryTransactionDTO } from '../../types/procurementTypes';

const TX_TYPE_BADGE: Record<InventoryTransactionDTO['transactionType'], string> = {
  RECEIPT:        'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  ISSUE:          'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
  RETURN:         'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
  ADJUSTMENT_IN:  'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  ADJUSTMENT_OUT: 'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
  TRANSFER_IN:    'border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3]',
  TRANSFER_OUT:   'border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3]',
};

export const InventoryLedgerPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const canAdjust = usePermission('project.inventory.adjust');
  const { success: toastOk, error: toastErr } = useToast();

  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjMaterialId, setAdjMaterialId] = useState('');
  const [adjQuantity, setAdjQuantity] = useState('');
  const [adjUnitCode, setAdjUnitCode] = useState('');
  const [adjDirection, setAdjDirection] = useState<'IN' | 'OUT'>('IN');
  const [adjReason, setAdjReason] = useState('');
  const [adjLocation, setAdjLocation] = useState('default');

  const { data: balances = [], isLoading: balLoading } = useListInventoryQuery({ orgId: orgId!, projectId: projectId! });
  const { data: materialsData } = useListMaterialsQuery({ orgId: orgId!, status: 'ACTIVE' });
  const materials = materialsData?.data ?? [];
  const materialsById = new Map(materials.map((material) => [material.id, material]));
  const { data: transactions = [] } = useGetInventoryTransactionsQuery(
    { orgId: orgId!, projectId: projectId!, materialId: selectedMaterialId! },
    { skip: !selectedMaterialId },
  );

  const [adjustInventory, { isLoading: adjusting, error: adjErr }] = useAdjustInventoryMutation();

  const onAdjust = async () => {
    if (!adjMaterialId || !adjQuantity || !adjUnitCode || !adjReason.trim()) {
      toastErr('All fields required', '');
      return;
    }
    try {
      await adjustInventory({
        orgId: orgId!, projectId: projectId!,
        input: { materialId: adjMaterialId, location: adjLocation, quantity: adjQuantity, unitCode: adjUnitCode.toUpperCase(), direction: adjDirection, reason: adjReason },
      }).unwrap();
      toastOk('Adjustment recorded', '');
      setShowAdjust(false);
      setAdjMaterialId(''); setAdjQuantity(''); setAdjUnitCode(''); setAdjReason(''); setAdjDirection('IN');
    } catch (err) {
      if (isToastError(err as never)) toastErr('Adjustment failed', toastErrorMessage(err as never));
    }
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Inventory ledger</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{balances.length} material{balances.length !== 1 ? 's' : ''} on site</p>
        </div>
        {canAdjust && !showAdjust && (
          <button type="button" onClick={() => setShowAdjust(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0">
            <Plus className="h-4 w-4" strokeWidth={2} /> Adjust
          </button>
        )}
      </div>

      {showAdjust && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Manual adjustment</p>
          {isInlineError(adjErr) && <InlineAlert variant="error" message={getServerError(adjErr)?.message ?? 'Error'} />}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Material *</label>
              <select value={adjMaterialId} onChange={(e) => {
                const material = materialsById.get(e.target.value);
                setAdjMaterialId(e.target.value);
                setAdjUnitCode(material?.defaultUnitCode ?? '');
              }}
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]">
                <option value="">Select material…</option>
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>{material.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Direction</label>
              <div className="flex border border-[var(--hairline-2)]">
                {(['IN', 'OUT'] as const).map((d) => (
                  <button key={d} type="button" onClick={() => setAdjDirection(d)}
                    className={`flex-1 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${adjDirection === d ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)] hover:bg-[var(--surface-2)]'}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Location</label>
              <input type="text" value={adjLocation} onChange={(e) => setAdjLocation(e.target.value)}
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Quantity *</label>
              <input type="text" value={adjQuantity} onChange={(e) => setAdjQuantity(e.target.value)}
                placeholder="e.g. 100.000"
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Unit code *</label>
              <input type="text" value={adjUnitCode} onChange={(e) => setAdjUnitCode(e.target.value.toUpperCase())} maxLength={20}
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Reason *</label>
              <input type="text" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} maxLength={2000}
                placeholder="Reason for adjustment"
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onAdjust} disabled={adjusting}
              className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0">
              {adjusting ? 'Recording…' : 'Record adjustment'}
            </button>
            <button type="button" onClick={() => setShowAdjust(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Balances table */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-3">Current balances</p>
          <div className="border border-[var(--hairline-2)]">
            <div className="grid grid-cols-[2fr_80px_80px] gap-4 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
              {['Material', 'Balance', 'Location'].map((h) => (
                <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
              ))}
            </div>
            {balLoading ? (
              [1, 2].map((i) => <div key={i} className="h-10 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />)
            ) : balances.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 bg-[var(--paper)]">
                <Archive className="h-8 w-8 text-[var(--muted)] mb-2" strokeWidth={1.5} />
                <p className="text-sm text-[var(--muted)]">No inventory yet.</p>
              </div>
            ) : (
              balances.map((b) => (
                <div key={`${b.materialId}:${b.location}`}
                  onClick={() => setSelectedMaterialId(b.materialId)}
                  className={`grid grid-cols-[2fr_80px_80px] gap-4 items-center px-4 py-3 border-b border-[var(--hairline-2)] last:border-b-0 cursor-pointer transition-colors ${selectedMaterialId === b.materialId ? 'bg-[var(--surface-2)]' : 'bg-[var(--paper)] hover:bg-[var(--surface-2)]'}`}>
                  <p className="text-sm truncate">{materialsById.get(b.materialId)?.name ?? b.materialId}</p>
                  <p className="font-mono text-[11px] font-medium">{parseFloat(b.balance).toLocaleString()}</p>
                  <p className="font-mono text-[10px] text-[var(--muted)]">{b.location}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Transactions panel */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-3">
            {selectedMaterialId ? `Transactions — ${materialsById.get(selectedMaterialId)?.name ?? selectedMaterialId}` : 'Select a material to view transactions'}
          </p>
          {selectedMaterialId ? (
            <div className="border border-[var(--hairline-2)]">
              <div className="grid grid-cols-[110px_80px_2fr_100px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
                {['Type', 'Qty', 'Notes', 'Date'].map((h) => (
                  <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
                ))}
              </div>
              {transactions.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-[var(--muted)]">No transactions yet.</div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="grid grid-cols-[110px_80px_2fr_100px] gap-3 items-center px-4 py-3 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]">
                    <span className={`inline-block font-mono text-[8px] uppercase tracking-[0.1em] border px-1 py-0.5 w-fit ${TX_TYPE_BADGE[tx.transactionType]}`}>
                      {tx.transactionType.replace('_', ' ')}
                    </span>
                    <p className="font-mono text-[11px]">{parseFloat(tx.quantity).toLocaleString()}</p>
                    <p className="text-xs text-[var(--muted)] truncate">{tx.notes ?? tx.sourceType}</p>
                    <p className="font-mono text-[10px] text-[var(--muted)]">
                      {new Date(tx.occurredAt).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="border border-[var(--hairline-2)] border-dashed py-16 flex items-center justify-center">
              <p className="text-sm text-[var(--muted)]">Click a material on the left</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
