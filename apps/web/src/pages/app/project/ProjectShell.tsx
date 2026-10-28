/**
 * ProjectShell — /org/:orgId/projects/:projectId
 * Loads the project into Redux, renders the sub-nav, and provides Outlet.
 * Sub-nav tabs: Overview | Phases | Cost Codes | Budget | Team | Settings
 */
import React, { useEffect } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useGetProjectQuery } from '../../../features/project/projectApi';
import { useAppDispatch } from '../../../app/store';
import {
  projectLoaded,
  projectLoadingStarted,
  projectCleared,
} from '../../../features/project/projectSlice';
import { ProjectStatusBadge } from '../../../components/project/ProjectStatusBadge';
import { useActiveProject } from '../../../features/project/useActiveProject';
import { SectionNavDropdown } from '../../../components/ui/SectionNavDropdown';

import { MOCK_PROJECTS, MOCK_PROJECT_VERSIONS } from '../../../mocks/project.fixtures';

export const ProjectShell: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { activeProject } = useActiveProject();

  // When bypass is active the API may fail (no server) — fall back to fixtures on error.
  // Key change: we NO LONGER skip the query when bypass is true. We always try the
  // live API first, and only fall back to fixtures if the API call fails.
  const bypass = import.meta.env.VITE_DEV_BYPASS === 'true';

  const { data, isLoading, isError } = useGetProjectQuery(
    { orgId: orgId!, projectId: projectId! },
    { skip: !orgId || !projectId },
  );

  useEffect(() => {
    dispatch(projectLoadingStarted());
    return () => {
      dispatch(projectCleared());
    };
  }, [projectId, dispatch]);

  // Load from live API response
  useEffect(() => {
    if (data) {
      dispatch(projectLoaded({ project: data.project, version: data._version }));
    }
  }, [data, dispatch]);

  // Handle errors: in bypass mode, fall back to fixtures; in live mode, redirect
  useEffect(() => {
    if (isError) {
      if (bypass) {
        // API failed (server not running) — fall back to fixture data
        const project = MOCK_PROJECTS.find((p) => p.id === projectId);
        if (project) {
          dispatch(projectLoaded({ project, version: (projectId ? MOCK_PROJECT_VERSIONS[projectId] : undefined) ?? 1 }));
        } else {
          navigate(`/org/${orgId}/projects`, { replace: true });
        }
      } else {
        // Live mode — redirect to projects list on error
        navigate(`/org/${orgId}/projects`, { replace: true });
      }
    }
  }, [isError, bypass, projectId, orgId, navigate, dispatch]);

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

        </div>
      </div>

      <SectionNavDropdown
        fallbackTo={base}
        fallbackLabel="Overview"
        groups={[
          {
            label: 'Planning',
            items: [
              { to: `${base}/phases`, label: 'Phases' },
              { to: `${base}/tasks`, label: 'Tasks' },
              { to: `${base}/baselines`, label: 'Baselines' },
              { to: `${base}/calendar`, label: 'Calendar' },
              { to: `${base}/schedule-history`, label: 'Schedule history' },
              { to: `${base}/cost-codes`, label: 'Cost codes' },
              { to: `${base}/budget`, label: 'Budget' },
            ],
          },
          {
            label: 'Field operations',
            items: [
              { to: `${base}/team`, label: 'Team' },
              { to: `${base}/field-logs`, label: 'Field logs' },
              { to: `${base}/issues`, label: 'Issues' },
              { to: `${base}/subcontractors`, label: 'Subcontractors' },
              { to: `${base}/safety`, label: 'Safety' },
              { to: `${base}/quality`, label: 'Quality' },
              { to: `${base}/rfis`, label: 'RFIs' },
              { to: `${base}/submittals`, label: 'Submittals' },
            ],
          },
          {
            label: 'Commercial',
            items: [
              { to: `${base}/commercial/change-orders`, label: 'Change orders' },
              { to: `${base}/commercial/sov`, label: 'Schedule of values' },
              { to: `${base}/commercial/payment-applications`, label: 'Payment applications' },
              { to: `${base}/commercial/invoices`, label: 'Invoices' },
              { to: `${base}/commercial/payments`, label: 'Payments' },
              { to: `${base}/commercial/retainage`, label: 'Retainage' },
              { to: `${base}/commercial/cost-transactions`, label: 'Cost transactions' },
              { to: `${base}/commercial/commercial-summary`, label: 'Commercial summary' },
              { to: `${base}/commercial/financial-summary`, label: 'Financial summary' },
            ],
          },
          {
            label: 'Pre-construction',
            items: [
              { to: `${base}/preconstruction/proposals`, label: 'Proposals' },
              { to: `${base}/preconstruction/estimates`, label: 'Estimates' },
              { to: `${base}/preconstruction/boq`, label: 'Bill of quantities' },
              { to: `${base}/preconstruction/takeoffs`, label: 'Takeoffs' },
              { to: `${base}/preconstruction/pricing`, label: 'Pricing' },
            ],
          },
          {
            label: 'Procurement',
            items: [
              { to: `${base}/procurement/requests`, label: 'Material requests' },
              { to: `${base}/procurement/quotes`, label: 'Quotes' },
              { to: `${base}/procurement/orders`, label: 'Purchase orders' },
              { to: `${base}/procurement/approvals`, label: 'Approvals' },
              { to: `${base}/procurement/deliveries`, label: 'Deliveries' },
              { to: `${base}/procurement/committed`, label: 'Committed costs' },
              { to: `${base}/inventory`, label: 'Inventory' },
            ],
          },
          {
            label: 'Records & controls',
            items: [
              { to: `${base}/documents`, label: 'Documents' },
              { to: `${base}/compliance`, label: 'Compliance' },
              { to: `${base}/audit`, label: 'Audit' },
              { to: `${base}/settings`, label: 'Settings' },
            ],
          },
          {
            label: 'Reports',
            items: [
              { to: `${base}/reports/health`, label: 'Project health' },
              { to: `${base}/reports/schedule`, label: 'Schedule' },
              { to: `${base}/reports/cost`, label: 'Cost' },
              { to: `${base}/reports/procurement`, label: 'Procurement' },
              { to: `${base}/reports/subcontractor`, label: 'Subcontractors' },
              { to: `${base}/reports/executive`, label: 'Executive' },
            ],
          },
        ]}
      />

      {/* Page content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
};
