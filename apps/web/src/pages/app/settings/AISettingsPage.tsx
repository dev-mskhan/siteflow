/**
 * AISettingsPage — /org/:orgId/settings/ai
 *
 * Shows AI assistant configuration:
 * - Daily budget cap (informational — set via env on the server)
 * - Memory TTL (informational)
 * - Langfuse trace link (if configured)
 * - Links to AI assistant pages
 */
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Sparkles, MessageSquare, Activity, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { useListRunsQuery } from '../../../features/ai/aiApi';

export const AISettingsPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();

  const { data: recentRuns } = useListRunsQuery(
    { orgId: orgId!, limit: 5 },
    { skip: !orgId },
  );

  const succeeded = recentRuns?.filter((r) => r.status === 'SUCCEEDED').length ?? 0;
  const failed = recentRuns?.filter((r) => r.status === 'FAILED').length ?? 0;
  const pending = recentRuns?.filter(
    (r) => r.status === 'QUEUED' || r.status === 'RUNNING' || r.status === 'AWAITING_APPROVAL',
  ).length ?? 0;

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--hairline-2)] pb-5">
        <div className="flex h-9 w-9 items-center justify-center bg-[var(--ink)]">
          <Sparkles className="h-4 w-4 text-white" strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="text-base font-medium tracking-[-0.02em]">AI Assistant</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            Configuration and usage for the AI assistant module.
          </p>
        </div>
      </div>

      {/* Quick links */}
      <div>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Quick access
        </p>
        <div className="grid gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] sm:grid-cols-3">
          {[
            { to: `/org/${orgId}/ai/chat`, icon: MessageSquare, label: 'Chat', desc: 'Ask the AI' },
            { to: `/org/${orgId}/ai/runs`, icon: Activity, label: 'Runs', desc: 'Agent run history' },
            { to: `/org/${orgId}/ai/approvals`, icon: CheckCircle2, label: 'Approvals', desc: 'Pending sign-offs' },
          ].map(({ to, icon: Icon, label, desc }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-center gap-3 bg-[var(--paper)] px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
            >
              <Icon className="h-4 w-4 text-[var(--muted)] group-hover:text-[var(--ink)]" strokeWidth={1.6} />
              <div>
                <p className="text-sm font-medium text-[var(--ink)]">{label}</p>
                <p className="text-xs text-[var(--muted)]">{desc}</p>
              </div>
              <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={1.6} />
            </Link>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Recent activity (last 5 runs)
        </p>
        <div className="grid grid-cols-3 gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)]">
          <div className="bg-[var(--paper)] px-4 py-3 text-center">
            <p className="text-xl font-medium text-[var(--ink)]">{succeeded}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Succeeded</p>
          </div>
          <div className="bg-[var(--paper)] px-4 py-3 text-center">
            <p className="text-xl font-medium text-[var(--ink)]">{pending}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">In progress</p>
          </div>
          <div className="bg-[var(--paper)] px-4 py-3 text-center">
            <p className="text-xl font-medium text-[var(--ink)]">{failed}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Failed</p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
          How it works
        </p>
        <div className="space-y-0 border border-[var(--hairline-2)]">
          {[
            {
              num: '01',
              title: 'Ask in plain English',
              desc: 'Type a question about your project. The AI reads your live data — budgets, orders, safety events, documents.',
            },
            {
              num: '02',
              title: 'Answers use real numbers',
              desc: 'Every figure in an AI answer comes from a live data query. The AI cannot invent or estimate numbers.',
            },
            {
              num: '03',
              title: 'Actions need your approval',
              desc: 'If the AI wants to send a message or create a purchase request, it stops and waits for your sign-off. Nothing happens without your confirmation.',
            },
            {
              num: '04',
              title: 'Five specialist agents',
              desc: 'Cost & Finance, Procurement, Safety & Compliance, Estimating & BOQ, and Reports — each scoped to its domain.',
            },
          ].map(({ num, title, desc }) => (
            <div
              key={num}
              className="flex gap-4 border-b border-[var(--hairline-2)] bg-[var(--paper)] px-5 py-4 last:border-b-0"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] pt-0.5">
                {num}
              </span>
              <div>
                <p className="text-sm font-medium text-[var(--ink)]">{title}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Observability */}
      <div>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Observability
        </p>
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] px-5 py-4">
          <p className="text-sm font-medium text-[var(--ink)]">Langfuse traces</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Every AI run generates a trace with full token counts, tool calls, and latency.
            View all traces in Langfuse.
          </p>
          <a
            href="http://localhost:3020"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
          >
            Open Langfuse
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.6} />
          </a>
        </div>
      </div>
    </div>
  );
};
