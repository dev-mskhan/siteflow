import { Link, useLocation } from 'react-router-dom';
import { Button } from '../ui/Button';
import { useAuth } from '../../lib/auth/index';

export function Navbar() {
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();

  const navLinks = [
    { label: 'Features', path: '/features' },
    { label: 'Pricing', path: '/pricing' },
    { label: 'About', path: '/about' },
    { label: 'Blog', path: '/blog' },
    { label: 'Contact', path: '/contact' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 backdrop-blur-md" style={{ backgroundColor: 'rgba(11, 15, 23, 0.85)', borderColor: 'var(--border)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-brand text-white font-black text-base shadow-sm group-hover:scale-105 transition-transform">
            SF
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold tracking-tight text-lg text-text leading-none">
              SiteFlow
            </span>
            <span className="text-[10px] text-accent-1 font-mono tracking-widest uppercase leading-none mt-0.5">
              Operations OS
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`text-sm font-medium transition-colors ${
                  isActive ? 'text-text font-semibold' : 'text-text-muted hover:text-text'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Link to="/projects">
              <Button size="sm" variant="primary">
                Open App ({user?.firstName})
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/login" className="hidden sm:inline-block">
                <Button size="sm" variant="ghost">
                  Sign In
                </Button>
              </Link>
              <Link to="/trial">
                <Button size="sm" variant="primary">
                  Start Free Trial
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
