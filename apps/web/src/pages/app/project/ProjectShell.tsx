/**
 * ProjectShell — /org/:orgId/projects/:projectId
 * Loads the project into Redux, renders the sub-nav, and provides Outlet.
 * Sub-nav tabs: Overview | Phases | Cost Codes | Budget | Team | Settings
 */
import React, { useEffect } from 'react';
import { NavLink, Outlet, useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { useGetProjectQuery } from '../../../features/project/projectApi';
import { useAppDispatch } from '../../../app/store';
import {
  projectLoaded,
  projectLoadingStarted,
  projectCleared,
} from '../../../features/project/projectSlice';
import { ProjectStatusBadge } from '../../../components/project/ProjectStatusBadge';
import { useActiveProject } from '../../../features/project/useActiveProject';

const Tab: React.FC<{ to: string; label: string; end?: boolean }> = ({ to, label, end }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      cn(
        'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-[120ms] whitespace-nowrap',
        isActive
          ? 'border-[var(--ink)] text-[var(--ink)]'
          : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]',
      )
    }
  >
    {label}
  </NavLink>
);

import { MOCK_PROJECTS, MOCK_PROJECT_VERSIONS } from '../../../mocks/project.fixtures';

export const ProjectShell: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { activeProject } = useActiveProject();

  // When bypass is active the API will fail (no server) — fall back to fixtures
  const bypass = import.meta.env.VITE_DEV_BYPASS === 'true';

  const { data, isLoading, isError } = useGetProjectQuery(
    { orgId: orgId!, projectId: projectId! },
    { skip: !orgId || !projectId || bypass },
  );

  useEffect(() => {
    dispatch(projectLoadingStarted());
    return () => {
      dispatch(projectCleared());
    };
  }, [projectId, dispatch]);

  useEffect(() => {
    if (bypass && projectId) {
      // Seed from fixture directly — no network call needed
      const project = MOCK_PROJECTS.find((p) => p.id === projectId);
      if (project) {
        dispatch(projectLoaded({ project, version: MOCK_PROJECT_VERSIONS[projectId] ?? 1 }));
      } else {
        navigate(`/org/${orgId}/projects`, { replace: true });
      }
      return;
    }
    if (data) {
      dispatch(projectLoaded({ project: data.project, version: data._version }));
    }
  }, [data, bypass, projectId, orgId, navigate, dispatch]);

  useEffect(() => {
    if (!bypass && isError) navigate(`/org/${orgId}/projects`, { replace: true });
  }, [isError, bypass, navigate, orgId]);

  const base = `/org/${orgId}/projects/${projectId}`;

  if (isLoading || !activeProject) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[calc(100dvh-112px)]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--muted)]" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0">
      {/* Project header */}
      <div className="border-b border-[var(--hairline-2)] bg-[var(--paper)] px-6 sm:px-8 pt-6 pb-0">
        <div>
          <div className="flex items-start gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <ProjectStatusBadge status={activeProject.status} />
                <span className="font-mono text-[10px] text-[var(--muted)]">
                  {activeProject.projectNumber}
                </span>
                {activeProject.projectType && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] border border-[var(--hairline-2)] px-1.5 py-0.5">
                    {activeProject.projectType}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-medium tracking-[-0.03em]">{activeProject.name}</h1>
            </div>
          </div>

          {/* Sub-nav */}
          <nav className="flex overflow-x-auto gap-0 -mb-px">
            <Tab to={base} label="Overview" end />
            <Tab to={`${base}/phases`} label="Phases" />
            <Tab to={`${base}/cost-codes`} label="Cost codes" />
            <Tab to={`${base}/budget`} label="Budget" />
            <Tab to={`${base}/team`} label="Team" />
            <Tab to={`${base}/field-logs`} label="Field logs" />
            <Tab to={`${base}/issues`} label="Issues" />
            <Tab to={`${base}/tasks`} label="Tasks" />
            <Tab to={`${base}/subcontractors`} label="Subcontractors" />
            <Tab to={`${base}/commercial/change-orders`} label="Commercial" />
            <Tab to={`${base}/preconstruction/proposals`} label="Pre-construction" />
            <Tab to={`${base}/procurement/requests`} label="Procurement" />
            <Tab to={`${base}/inventory`} label="Inventory" />
            <Tab to={`${base}/settings`} label="Settings" />
          </nav>
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
};
