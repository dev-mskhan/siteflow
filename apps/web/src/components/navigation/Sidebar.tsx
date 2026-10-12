import { NavLink, Link } from 'react-router-dom';
import { useAppStore } from '../../lib/store/appStore';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: 'Projects', path: '/projects', icon: '📁' },
  { label: 'Dashboard', path: '/dashboard', icon: '📊' },
  { label: 'Schedule', path: '/schedule', icon: '📅' },
  { label: 'Daily Logs', path: '/daily-logs', icon: '📝' },
  { label: 'Procurement', path: '/procurement', icon: '📦' },
  { label: 'Inventory', path: '/inventory', icon: '🏗️' },
  { label: 'Documents', path: '/documents', icon: '📄' },
  { label: 'Quality & Safety', path: '/quality-safety', icon: '🛡️' },
  { label: 'Commercial', path: '/commercial', icon: '💰' },
  { label: 'Reports', path: '/reports', icon: '📈' },
  { label: 'Billing', path: '/billing', icon: '💳' },
  { label: 'Settings', path: '/settings', icon: '⚙️' },
];

export function Sidebar() {
  const { sidebarOpen } = useAppStore();

  return (
    <aside
      className={`border-r border-border flex flex-col shrink-0 min-h-screen text-text select-none transition-all duration-200 ${
        sidebarOpen ? 'w-64' : 'hidden lg:flex lg:w-20'
      }`}
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Brand Header */}
      <div className="h-16 px-6 border-b border-border flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-brand text-white font-black text-sm shrink-0">
            SF
          </div>
          {sidebarOpen && (
            <span className="font-extrabold tracking-tight text-base text-text">SiteFlow</span>
          )}
        </Link>
        {sidebarOpen && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-2 text-text-muted border border-border">
            v1.0
          </span>
        )}
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 py-4 px-3 overflow-y-auto space-y-1">
        {sidebarOpen && (
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">
            Operations
          </div>
        )}
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={item.label}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-surface-2 text-text border border-border/80 font-semibold'
                  : 'text-text-muted hover:text-text hover:bg-surface-2/60'
              } ${!sidebarOpen ? 'justify-center px-0' : ''}`
            }
          >
            <span className="text-base shrink-0">{item.icon}</span>
            {sidebarOpen && <span>{item.label}</span>}
          </NavLink>
        ))}
      </div>

      {/* Organization Indicator Footer */}
      <div className="p-3 border-t border-border mt-auto">
        <div className={`p-2.5 rounded-xl bg-surface-2 border border-border/70 flex items-center gap-3 ${!sidebarOpen ? 'justify-center p-2' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-accent-1 flex items-center justify-center font-bold text-xs border border-orange-500/30 shrink-0">
            GC
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-text truncate">Apex Builders</p>
              <p className="text-[10px] text-text-muted font-mono truncate">Pro Plan (14d left)</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
