/**
 * PlatformDiagnosticsPage — /platform/diagnostics
 * Tabs: Health | Queue | Outbox | Organization
 */
import React, { useState } from 'react';
import { RefreshCw, Activity, Database, AlertTriangle, RotateCw } from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  useGetHealthQuery, useGetQueueDiagnosticsQuery, useGetOrgDiagnosticsQuery,
  useReplayOutboxEventMutation,
} from '../../api/platformApi';
import { useToast } from '../../components/ui/Toast';
import { toastErrorMessage } from '../../lib/authErrors';
import { inputCls } from '../../components/ui/FormField';

type Tab = 'health' | 'queue' | 'outbox' | 'organization';
const TabBtn: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button type="button" onClick={onClick}
    className={cn('px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] border-b-2 transition-colors', active ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]')}>
    {label}
  </button>
);

export const PlatformDiagnosticsPage: React.FC = () => {
  const { success: toastOk, error: toastErr } = useToast();
  const [tab, setTab] = useState<Tab>('health');
  const [orgId, setOrgId] = useState('');
  const [windowHours, setWindowHours] = useState(24);

  const { data: health, isLoading: hLoading, refetch: refetchHealth, isFetching: hFetching } = useGetHealthQuery();
  const { data: queue, isLoading: qLoading, refetch: refetchQueue, isFetching: qFetching } = useGetQueueDiagnosticsQuery({ windowHours });
  const { data: orgDiag } = useGetOrgDiagnosticsQuery({ orgId }, { skip: !orgId || tab !== 'organization' });
  const [replayEvent, { isLoading: replaying }] = useReplayOutboxEventMutation();

  const onReplay = async (eventId: string) => {
    try {
      await replayEvent({ eventId }).unwrap();
      toastOk('Outbox event replayed', 'Event has been requeued.');
      refetchQueue();
    } catch (err) { toastErr('Replay failed', toastErrorMessage(err as never)); }
  };

  return (
    <div className="p-6 sm:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Diagnostics</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">System health, queue state, and outbox recovery</p>
        </div>
      </div>

      <div className="flex border-b border-[var(--hairline-2)] mb-6">
        <TabBtn label="Health" active={tab === 'health'} onClick={() => setTab('health')} />
        <TabBtn label="Queue" active={tab === 'queue'} onClick={() => setTab('queue')} />
        <TabBtn label="Outbox" active={tab === 'outbox'} onClick={() => setTab('outbox')} />
        <TabBtn label="Organization" active={tab === 'organization'} onClick={() => setTab('organization')} />
      </div>

      {/* HEALTH */}
      {tab === 'health' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">Application & database health</p>
            <button onClick={() => refetchHealth()} disabled={hFetching} className="inline-flex items-center gap-1.5 border border-[var(--hairline-2)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)] disabled:opacity-50">
              <RefreshCw className={cn('h-3.5 w-3.5', hFetching && 'animate-spin')} strokeWidth={2} /> Refresh
            </button>
          </div>
          {hLoading ? <div className="h-20 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]" /> : health && (
            <div className={cn('border p-5', health.status === 'ok' ? 'border-[#bbf7d0] bg-[#f0fdf4]' : 'border-[#fecaca] bg-[#fef2f2]')}>
              <div className="flex items-center gap-4">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', health.status === 'ok' ? 'bg-[#166534]' : 'bg-[#991b1b]')}>
                  <Activity className="h-5 w-5 text-white" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-sm font-medium">{health.status === 'ok' ? 'All systems operational' : 'Degraded'}</p>
                  <p className="font-mono text-[10px] text-[var(--muted)]">Checked {new Date(health.checkedAt).toLocaleString()}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-[var(--hairline-2)]">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Database</p>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Database className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.75} />
                    {health.database.ok ? 'Connected' : 'Unreachable'} · {health.database.latencyMs}ms
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* QUEUE */}
      {tab === 'queue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">Queue state (last {windowHours}h)</p>
              <select value={windowHours} onChange={(e) => setWindowHours(parseInt(e.target.value))} className="border border-[var(--hairline-2)] bg-[var(--paper)] px-2 py-1 text-sm">
                {[1, 6, 12, 24].map((h) => <option key={h} value={h}>{h}h</option>)}
              </select>
            </div>
            <button onClick={() => refetchQueue()} disabled={qFetching} className="inline-flex items-center gap-1.5 border border-[var(--hairline-2)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)] disabled:opacity-50">
              <RefreshCw className={cn('h-3.5 w-3.5', qFetching && 'animate-spin')} strokeWidth={2} /> Refresh
            </button>
          </div>
          {qLoading ? <div className="h-40 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]" /> : queue && (
            <>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {Object.entries(queue.counts).map(([state, count]) => (
                  <div key={state} className="border border-[var(--hairline-2)] bg-[var(--paper)] p-3">
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">{state}</p>
                    <p className={cn('font-mono text-lg font-medium', state === 'failed' && count > 0 ? 'text-[#991b1b]' : '')}>{count}</p>
                  </div>
                ))}
              </div>
              {queue.oldestWaitingJobAgeSeconds != null && (
                <p className="font-mono text-[10px] text-[var(--muted)]">Oldest waiting job: {queue.oldestWaitingJobAgeSeconds}s ago</p>
              )}
              {/* Webhook inbox summary */}
              <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] mb-3">Webhook inbox</p>
                <div className="grid grid-cols-5 gap-3">
                  {Object.entries(queue.webhookInbox).map(([status, count]) => (
                    <div key={status}>
                      <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--muted)]">{status}</p>
                      <p className={cn('font-mono text-sm font-medium', status === 'FAILED' && count > 0 ? 'text-[#991b1b]' : '')}>{count}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* OUTBOX */}
      {tab === 'outbox' && (
        <div className="space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">Failed outbox events</p>
          {qLoading ? <div className="h-20 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]" /> : queue && (
            <>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-medium">{queue.outbox.failedCount} failed</span>
                {queue.outbox.oldestFailedAt && <span className="font-mono text-[10px] text-[var(--muted)]">Oldest: {new Date(queue.outbox.oldestFailedAt).toLocaleString()}</span>}
              </div>
              {queue.outbox.failed.length > 0 ? (
                <div className="border border-[var(--hairline-2)]">
                  <div className="grid grid-cols-[2fr_100px_120px_60px_100px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
                    {['Event type', 'Org ID', 'Created', 'Retries', ''].map((h) => <p key={h} className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">{h}</p>)}
                  </div>
                  {queue.outbox.failed.map((ev) => (
                    <div key={ev.id} className="grid grid-cols-[2fr_100px_120px_60px_100px] gap-3 items-center px-4 py-3 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]">
                      <p className="text-sm truncate">{ev.eventType}</p>
                      <p className="font-mono text-[9px] text-[var(--muted)] truncate">{ev.organizationId ?? '—'}</p>
                      <p className="font-mono text-[9px] text-[var(--muted)]">{new Date(ev.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short' })}</p>
                      <p className={cn('font-mono text-[10px]', ev.retryCount > 2 ? 'text-[#991b1b]' : 'text-[var(--muted)]')}>{ev.retryCount}</p>
                      <button onClick={() => onReplay(ev.id)} disabled={replaying}
                        className="inline-flex items-center gap-1 font-mono text-[8px] uppercase border border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af] px-1.5 py-0.5 hover:bg-[#dbeafe] disabled:opacity-50">
                        <RotateCw className="h-3 w-3" strokeWidth={2} /> Replay
                      </button>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-[var(--muted)]">No failed outbox events.</p>}
            </>
          )}
        </div>
      )}

      {/* ORGANIZATION */}
      {tab === 'organization' && (
        <div className="space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">Organization diagnostics</p>
          <div className="flex items-center gap-3">
            <input value={orgId} onChange={(e) => setOrgId(e.target.value)} placeholder="Organization ID" className={cn(inputCls(), 'max-w-sm')} />
          </div>
          {orgDiag && (
            <div className="space-y-4">
              <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] mb-3">Notification deliveries</p>
                <div className="grid grid-cols-4 gap-3">
                  {Object.entries(orgDiag.notificationDeliveries).map(([status, count]) => (
                    <div key={status}>
                      <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--muted)]">{status}</p>
                      <p className="font-mono text-sm font-medium">{count}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">Storage usage</p>
                <p className="font-mono text-lg font-medium">{(orgDiag.storageBytes / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
