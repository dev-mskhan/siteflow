import { useAuth } from '../../features/auth/hooks/useAuth';
import { useAppStore } from '../../lib/store/appStore';
import { Button } from '../ui/Button';

export function Topbar() {
  const { user, logout } = useAuth();
  const { locale, setLocale, toggleSidebar } = useAppStore();

  return (
    <header
      className="h-16 border-b border-border px-6 flex items-center justify-between gap-4 sticky top-0 z-30"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Search Bar & Sidebar Toggle */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button
          type="button"
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface-2 transition-colors lg:hidden"
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
        <div className="relative w-full">
          <input
            type="search"
            placeholder="Search projects, tasks, BOQs, drawings..."
            className="w-full pl-9 pr-4 py-1.5 rounded-lg text-xs bg-bg text-text border border-border focus:border-accent-1 outline-none placeholder:text-text-muted"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
          />
          <span className="absolute left-3 top-2 text-text-muted text-xs">🔍</span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Currency / Locale Switcher powered by Zustand */}
        <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs bg-surface-2">
          <button
            type="button"
            onClick={() => setLocale('USD')}
            className={`px-2.5 py-1 font-mono transition-colors ${
              locale === 'USD'
                ? 'bg-accent-1 text-white font-bold'
                : 'text-text-muted hover:text-text'
            }`}
            style={locale === 'USD' ? { background: 'var(--gradient-brand)', color: '#fff' } : {}}
          >
            $ USD
          </button>
          <button
            type="button"
            onClick={() => setLocale('PKR')}
            className={`px-2.5 py-1 font-mono transition-colors ${
              locale === 'PKR'
                ? 'bg-accent-1 text-white font-bold'
                : 'text-text-muted hover:text-text'
            }`}
            style={locale === 'PKR' ? { background: 'var(--gradient-brand)', color: '#fff' } : {}}
          >
            ₨ PKR
          </button>
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center gap-3 pl-2 border-l border-border">
          <div className="flex flex-col text-right">
            <span className="text-xs font-semibold text-text">
              {user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Project Engineer'}
            </span>
            <span className="text-[10px] text-text-muted">{user?.email || 'admin@siteflow.internal'}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} title="Sign Out">
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
}
