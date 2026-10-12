import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-border mt-auto pt-14 pb-10" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-border">
          {/* Company & Tagline */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-brand text-white font-black text-sm">
                SF
              </div>
              <span className="font-extrabold text-lg text-text">SiteFlow</span>
            </div>
            <p className="text-sm text-text-muted leading-relaxed">
              Construction operations platform engineered for general contractors, project engineers, and developers.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-xs text-text-muted">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Built for US & Pakistan Construction Standards</span>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-4">Product</h4>
            <ul className="space-y-2.5 text-sm text-text-muted">
              <li><Link to="/features" className="hover:text-text transition-colors">Estimating & BOQ</Link></li>
              <li><Link to="/features" className="hover:text-text transition-colors">Schedule & Critical Path</Link></li>
              <li><Link to="/features" className="hover:text-text transition-colors">Procurement Chain</Link></li>
              <li><Link to="/features" className="hover:text-text transition-colors">Field Logs & Daily Reports</Link></li>
              <li><Link to="/pricing" className="hover:text-text transition-colors">Pricing & Plans</Link></li>
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-4">Company</h4>
            <ul className="space-y-2.5 text-sm text-text-muted">
              <li><Link to="/about" className="hover:text-text transition-colors">About Us</Link></li>
              <li><Link to="/blog" className="hover:text-text transition-colors">Engineering Blog</Link></li>
              <li><Link to="/contact" className="hover:text-text transition-colors">Contact Sales</Link></li>
              <li><Link to="/trial" className="hover:text-text transition-colors">Start Free Trial</Link></li>
            </ul>
          </div>

          {/* Security & Multi-Currency */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-4">Enterprise Specs</h4>
            <p className="text-xs text-text-muted leading-relaxed mb-3">
              Dual-ledger multi-currency (USD & PKR), automatic unit conversions (Square Feet, Marla, Kanal, Square Meters), and strict tenant isolation.
            </p>
            <div className="text-xs font-mono text-text-dim">
              SOC2 Type II Ready • Strict RBAC
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
          <p>© {new Date().getFullYear()} SiteFlow Technologies Inc. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/about" className="hover:text-text">Privacy Policy</Link>
            <Link to="/about" className="hover:text-text">Terms of Service</Link>
            <Link to="/contact" className="hover:text-text">Support</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
