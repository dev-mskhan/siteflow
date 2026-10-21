/**
 * AppSidebar — left navigation panel for the app shell.
 *
 * Nav structure uses expandable dropdown groups for submodules,
 * keeping the flat design language (no shadows, hairline borders,
 * font-mono labels).
 *
 * Groups:
 *   Dashboard    — flat link (top)
 *   Projects     — flat link
 *   Catalog ▾    — Suppliers, Subcontractors, Materials
 *   Pre-construction ▾ — Tenders
 *   Reports ▾    — Portfolio report
 *   Admin ▾      — Members, Settings, Billing, Exports, Notifications
 *
 * OrgSwitcher: shows current org name, clicking reveals a popover
 * listing all user orgs from listOrgs cache.
 */

import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Settings,
  FolderKanban,
  ChevronDown,
  Building2,
  Plus,
  X,
  Building,
  Package,
  HardHat,
  FileSearch,
  BarChart3,
  CreditCard,
  Download,
  Bell,
  Boxes,
  HardHat as HardHatIcon,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { Logo } from '../ui/Logo';
import { PermissionGate } from '../guards/PermissionGate';
import { useOrgContext } from '../../features/org/useOrgContext';
import { useListOrgsQuery } from '../../features/org/orgApi';

interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
}

// ─── Nav item component (leaf) ────────────────────────────────────────────────

const NavItem: React.FC<{
  to: string;
  icon: React.ElementType;
  label: string;
  exact?: boolean;
  indent?: boolean;
}> = ({ to, icon: Icon, label, exact, indent }) => {
  const location = useLocation();
  const isActive = exact ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <Link
      to={to}
      className={cn(
        'group flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors duration-[120ms]',
        indent && 'pl-9',
        isActive
          ? 'bg-[var(--ink)] text-white'
          : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0',
          isActive ? 'text-white' : 'text-[var(--muted)] group-hover:text-[var(--ink)]',
        )}
        strokeWidth={1.75}
      />
      {label}
    </Link>
  );
};

// ─── Nav group component (expandable dropdown) ───────────────────────────────

interface NavGroupItem {
  to: string;
  icon: React.ElementType;
  label: string;
  permission?: string;
}

const NavGroup: React.FC<{
  label: string;
  icon: React.ElementType;
  items: NavGroupItem[];
}> = ({ label, icon: GroupIcon, items }) => {
  const location = useLocation();
  const [expanded, setExpanded] = useState(() => {
    // Auto-expand if current route matches any child
    return items.some((item) => {
      if (item.exact) return location.pathname === item.to;
      return location.pathname.startsWith(item.to);
    });
  });

  const hasActiveChild = items.some((item) => location.pathname.startsWith(item.to));

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'w-full group flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors duration-[120ms]',
          hasActiveChild
            ? 'text-[var(--ink)]'
            : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
        )}
      >
        <GroupIcon
          className={cn(
            'h-4 w-4 shrink-0',
            hasActiveChild
              ? 'text-[var(--ink)]'
              : 'text-[var(--muted)] group-hover:text-[var(--ink)]',
          )}
          strokeWidth={1.75}
        />
        {label}
        <ChevronDown
          className={cn(
            'ml-auto h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition-transform duration-[120ms]',
            expanded && 'rotate-180',
          )}
          strokeWidth={2}
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: 'auto',
              opacity: 1,
              transition: { duration: 0.14, ease: [0.16, 1, 0.3, 1] as const },
            }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.1 } }}
            className="overflow-hidden"
          >
            {items.map((item) =>
              item.permission ? (
                <PermissionGate key={item.to} require={item.permission}>
                  <NavItem to={item.to} icon={item.icon} label={item.label} indent />
                </PermissionGate>
              ) : (
                <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} indent />
              ),
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Nav content (shared between desktop + mobile) ────────────────────────────

const NavContent: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
      {/* Dashboard — always flat at top */}
      <NavItem to={`/org/${orgId}/dashboard`} icon={LayoutDashboard} label="Dashboard" exact />

      {/* Projects — flat */}
      <PermissionGate require="project:read">
        <NavItem to={`/org/${orgId}/projects`} icon={FolderKanban} label="Projects" />
      </PermissionGate>

      {/* Catalog group */}
      <NavGroup
        label="Catalog"
        icon={Boxes}
        items={[
          {
            to: `/org/${orgId}/suppliers`,
            icon: Building,
            label: 'Suppliers',
            permission: 'supplier:read',
          },
          {
            to: `/org/${orgId}/subcontractors`,
            icon: HardHatIcon,
            label: 'Subcontractors',
            permission: 'project.subcontractor.read',
          },
          {
            to: `/org/${orgId}/materials`,
            icon: Package,
            label: 'Materials',
            permission: 'material:read',
          },
        ]}
      />

      {/* Pre-construction group */}
      <NavGroup
        label="Pre-construction"
        icon={FileSearch}
        items={[{ to: `/org/${orgId}/tenders`, icon: FileSearch, label: 'Tenders' }]}
      />

      {/* Reports group */}
      <NavGroup
        label="Reports"
        icon={BarChart3}
        items={[
          { to: `/org/${orgId}/reports/portfolio`, icon: BarChart3, label: 'Portfolio report' },
        ]}
      />

      {/* Admin group */}
      <NavGroup
        label="Admin"
        icon={Settings}
        items={[
          { to: `/org/${orgId}/members`, icon: Users, label: 'Members', permission: 'member:read' },
          {
            to: `/org/${orgId}/settings`,
            icon: Settings,
            label: 'Settings',
            permission: 'settings:read',
          },
          {
            to: `/org/${orgId}/settings/billing`,
            icon: CreditCard,
            label: 'Billing',
            permission: 'settings:read',
          },
          {
            to: `/org/${orgId}/settings/exports`,
            icon: Download,
            label: 'Exports',
            permission: 'settings:read',
          },
          {
            to: `/org/${orgId}/settings/notifications`,
            icon: Bell,
            label: 'Notifications',
            permission: 'settings:read',
          },
        ]}
      />
    </nav>
  );
};

// ─── Org switcher ──────────────────────────────────────────────────────────────

const OrgSwitcher: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { org } = useOrgContext();
  const { data } = useListOrgsQuery();
  const [open, setOpen] = useState(false);

  const orgs = data?.organizations ?? [];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-[var(--hairline-2)] bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ink)]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center bg-[var(--ink)] text-white">
            <Building2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 text-left">
            <p className="text-sm font-medium text-[var(--ink)] truncate leading-tight">
              {org?.name ?? 'Loading…'}
            </p>
            <p className="font-mono text-[9px] text-[var(--muted)] truncate leading-tight">
              {org?.slug}
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition-transform duration-[120ms]',
            open && 'rotate-180',
          )}
          strokeWidth={2}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="org-switcher-panel"
            initial={{ opacity: 0, y: -4, scaleY: 0.97 }}
            animate={{
              opacity: 1,
              y: 0,
              scaleY: 1,
              transition: { duration: 0.14, ease: [0.16, 1, 0.3, 1] as const },
            }}
            exit={{ opacity: 0, y: -3, transition: { duration: 0.1 } }}
            style={{ originY: 0 }}
            className="absolute left-0 right-0 top-[calc(100%+2px)] z-50 border border-[var(--ink)] bg-[var(--paper)] shadow-none"
          >
            <div className="max-h-48 overflow-y-auto">
              {orgs.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (o.id !== orgId) navigate(`/org/${o.id}/dashboard`);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-[var(--surface-2)] transition-colors duration-[120ms]',
                    o.id === orgId && 'bg-[var(--surface-2)]',
                  )}
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center border border-[var(--hairline-2)] bg-[var(--surface)]">
                    <Building2 className="h-3 w-3 text-[var(--muted)]" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--ink)] truncate leading-tight">
                      {o.name}
                    </p>
                    <p className="font-mono text-[9px] text-[var(--muted)] truncate">{o.slug}</p>
                  </div>
                  {o.id === orgId && (
                    <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">
                      active
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="border-t border-[var(--hairline-2)]">
              <Link
                to="/onboarding/create-org"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors duration-[120ms]"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                Create new workspace
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Sidebar ───────────────────────────────────────────────────────────────────

export const AppSidebar: React.FC<AppSidebarProps> = ({ open, onClose }) => {
  return (
    <>
      {/* Desktop sidebar — conditionally rendered so flex recalculates when closed */}
      {open && (
        <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-[var(--hairline-2)] bg-[var(--surface)]">
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center justify-between border-b border-[var(--hairline-2)] px-3 py-3.5">
              <Link to="/" aria-label="SiteFlow home">
                <Logo size="sm" />
              </Link>
            </div>

            {/* Org switcher */}
            <div className="px-2 py-2 border-b border-[var(--hairline-2)]">
              <OrgSwitcher />
            </div>

            {/* Nav */}
            <NavContent />

            {/* Footer */}
            <div className="border-t border-[var(--hairline-2)] px-3 py-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">
                SiteFlow
              </p>
            </div>
          </div>
        </aside>
      )}

      {/* Mobile drawer overlay */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={onClose}
              className="md:hidden fixed inset-0 z-40 bg-[var(--ink)]/40"
            />
            <motion.aside
              key="sidebar-drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] as const }}
              className="md:hidden fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-[var(--hairline-2)] bg-[var(--surface)]"
            >
              <div className="flex items-center justify-between border-b border-[var(--hairline-2)] px-3 py-3.5">
                <Logo size="sm" />
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close sidebar"
                  className="p-1 text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
              <div className="px-2 py-2 border-b border-[var(--hairline-2)]">
                <OrgSwitcher />
              </div>
              <NavContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
