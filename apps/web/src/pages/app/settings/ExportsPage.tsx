/**
 * ExportsPage — /org/:orgId/settings/exports
 * Request CSV report exports, poll status, download via presigned URL.
 * Backend: apps/server/src/modules/reporting/exports/export.routes.ts
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import {
  useRequestExportMutation,
  useListExportsQuery,
  useGetExportDownloadUrlQuery,
} from '../../../api/exportApi';
import { useToast } from '../../../components/ui/Toast';
import { toastErrorMessage } from '../../../lib/authErrors';
import { inputCls } from '../../../components/ui/FormField';
import { cn } from '../../../lib/cn';
import type { ExportStatus } from '../../../api/exportApi';

const REPORT_TYPES = [
  { value: 'portfolio', label: 'Portfolio report' },
  { value: 'health', label: 'Project health' },
  { value: 'schedule', label: 'Schedule report' },
  { value: 'cost', label: 'Cost report' },
  { value: 'procurement', label: 'Procurement report' },
  { value: 'subcontractor', label: 'Subcontractor report' },
  { value: 'executive-summary', label: 'Executive summary' },
];

const STATUS_BADGE: Record<ExportStatus, string> = {
  PENDING:   'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  PROCESSING: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
  COMPLETED: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  FAILED:    'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
  EXPIRED:   'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
};

const DownloadCell: React.FC<{ orgId: string; exportId: string; status: ExportStatus }> = ({ orgId, exportId, status }) => {
  const { data, isLoading } = useGetExportDownloadUrlQuery(
    { orgId, exportId },
    { skip: status !== 'COMPLETED' },
  );
  if (status !== 'COMPLETED') return <p className="font-mono text-[9px] text-[var(--muted)]">—</p>;
  if (isLoading || !data) return <RefreshCw className="h-3 w-3 animate-spin text-[var(--muted)]" />;
  return (
    <a href={data.downloadUrl} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-[9px] uppercase text-[var(--muted)] hover:text-[var(--ink)]">
      <Download className="h-3 w-3" strokeWidth={2} /> Download
    </a>
  );
};

export const ExportsPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { success: toastOk, error: toastErr } = useToast();

  const [reportType, setReportType] = useState('portfolio');
  const [projectId, setProjectId] = useState('');

  const { data, isLoading, refetch, isFetching } = useListExportsQuery({ orgId: orgId! });
  const [requestExport, { isLoading: requesting }] = useRequestExportMutation();

  const onRequest = async () => {
    try {
      await requestExport({ orgId: orgId!, projectId: projectId.trim() || null, reportType }).unwrap();
      toastOk('Export requested', 'You will be able to download it shortly.');
      setProjectId('');
    } catch (err) { toastErr('Request failed', toastErrorMessage(err as never)); }
  };

  const exports = data?.exports ?? [];

  return (
    <div className="p-6 sm:p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Exports</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">Request CSV report downloads</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="inline-flex items-center gap-1.5 border border-[var(--hairline-2)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)] disabled:opacity-50">
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} strokeWidth={2} /> Refresh
        </button>
      </div>

      {/* Request form */}
      <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Request export</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Report type</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)} className={inputCls()}>
              {REPORT_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Project ID (optional)</label>
            <input value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="Leave blank for org-wide" className={inputCls()} />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
          <button onClick={onRequest} disabled={requesting}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-50">
            {requesting ? 'Requesting…' : 'Request export'}
          </button>
        </div>
      </div>

      {/* Export list */}
      {isLoading ? (
        [1, 2].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)] mb-2" />)
      ) : exports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-[var(--hairline-2)] bg-[var(--paper)]">
          <FileSpreadsheet className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
          <p className="text-sm text-[var(--muted)]">No exports requested yet.</p>
        </div>
      ) : (
        <div className="border border-[var(--hairline-2)]">
          <div className="grid grid-cols-[2fr_80px_100px_120px_120px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
            {['Report type', 'Format', 'Status', 'Created', ''].map((h) => <p key={h} className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">{h}</p>)}
          </div>
          {exports.map((exp) => (
            <div key={exp.id} className="grid grid-cols-[2fr_80px_100px_120px_120px] gap-3 items-center px-4 py-3 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
              <p className="text-sm">{exp.reportType}</p>
              <p className="font-mono text-[9px] uppercase text-[var(--muted)]">{exp.format}</p>
              <span className={cn('inline-block font-mono text-[9px] uppercase border px-1.5 py-0.5 w-fit', STATUS_BADGE[exp.status])}>{exp.status}</span>
              <p className="font-mono text-[10px] text-[var(--muted)]">{new Date(exp.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              <DownloadCell orgId={orgId!} exportId={exp.id} status={exp.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
