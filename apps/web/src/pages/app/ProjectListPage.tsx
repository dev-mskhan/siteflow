/**
 * ProjectListPage — /org/:orgId/projects
 * Shows all projects for the org with status filter, search, and create button.
 */
import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, Search, ArrowUpRight, FolderOpen } from 'lucide-react';
import { useListProjectsQuery } from '../../features/project/projectApi';
import { ProjectStatusBadge } from '../../components/project/ProjectStatusBadge';
import { PermissionGate } from '../../components/guards/PermissionGate';
import { CreateProjectModal } from './CreateProjectModal';
import type { ProjectStatus } from '../../features/project/projectTypes';
import { cn } from '../../lib/cn';

const STATUS_FILTERS: { label: string; value: ProjectStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'On hold', value: 'ON_HOLD' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Archived', value: 'ARCHIVED' },
];

function formatCurrency(value: string | null, currency: string): string {
  if (!value) return '—';
  const num = parseFloat(value);
  if (currency === 'PKR') return `PKR ${new Intl.NumberFormat('en-PK').format(num)}`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num);
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(d),
  );
}

export const ProjectListPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | ''>('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useListProjectsQuery({
    orgId: orgId!,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const projects = data?.projects ?? [];

  return (
    <div className="p-6 sm:p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-medium tracking-[-0.03em]">Projects</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <PermissionGate require="project:create">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New project
          </button>
        </PermissionGate>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]"
            strokeWidth={1.8}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="w-full pl-9 pr-3 py-2 border border-[var(--hairline-2)] bg-[var(--paper)] text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)] transition-colors"
          />
        </div>

        {/* Status tabs */}
        <div className="flex overflow-x-auto gap-0 border border-[var(--hairline-2)] bg-[var(--paper)]">
          {STATUS_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={cn(
                'shrink-0 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors duration-[120ms]',
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

      {/* Project grid */}
      {isLoading ? (
        <div className="grid gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse bg-[var(--surface-2)]" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border border-[var(--hairline-2)] bg-[var(--paper)]">
          <FolderOpen className="h-10 w-10 text-[var(--muted)] mb-4" strokeWidth={1.5} />
          <p className="text-sm font-medium text-[var(--ink)]">No projects found</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {search || statusFilter
              ? 'Try adjusting your filters.'
              : 'Create your first project to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/org/${orgId}/projects/${project.id}`}
              className="group flex flex-col justify-between bg-[var(--paper)] p-6 hover:bg-[var(--surface-2)] transition-colors duration-[120ms]"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex flex-col gap-1.5">
                    <ProjectStatusBadge status={project.status} />
                    <span className="font-mono text-[10px] text-[var(--muted)]">
                      {project.projectNumber}
                    </span>
                  </div>
                  <ArrowUpRight
                    className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    strokeWidth={1.6}
                  />
                </div>
                <h2 className="text-base font-medium tracking-[-0.02em] leading-snug">
                  {project.name}
                </h2>
                {project.description && (
                  <p className="mt-2 text-sm text-[var(--muted)] line-clamp-2">
                    {project.description}
                  </p>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-[var(--hairline)] grid grid-cols-2 gap-3">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">
                    Contract value
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {formatCurrency(project.contractValue, project.currency)}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">
                    Planned end
                  </p>
                  <p className="mt-1 text-sm font-medium">{formatDate(project.plannedEndDate)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {createOpen && <CreateProjectModal orgId={orgId!} onClose={() => setCreateOpen(false)} />}
    </div>
  );
};
