import { Outlet, Link } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div
      className="min-h-screen flex flex-col justify-center items-center p-4 blueprint-grid hero-glow relative"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      {/* Top Brand Link */}
      <div className="mb-6 z-10">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-brand text-white font-black text-lg shadow-md">
            SF
          </div>
          <div className="flex flex-col text-left">
            <span className="font-extrabold tracking-tight text-xl text-text leading-none">SiteFlow</span>
            <span className="text-[10px] text-accent-1 font-mono tracking-widest uppercase leading-none mt-1">
              Construction OS
            </span>
          </div>
        </Link>
      </div>

      {/* Main Auth Form Container */}
      <div className="w-full max-w-md z-10">
        <Outlet />
      </div>

      {/* Subtle Bottom Trust Text */}
      <div className="mt-8 text-center text-xs text-text-dim z-10 flex items-center gap-2 font-mono">
        <span>🔒 256-bit TLS Encryption</span>
        <span>•</span>
        <span>US & Pakistan Compliance</span>
      </div>
    </div>
  );
}
