import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Logo } from '../ui/Logo';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-border bg-surface-muted text-text-muted text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
          {/* Brand Col */}
          <div className="col-span-2">
            <Link to="/" className="inline-block mb-3">
              <Logo size="md" />
            </Link>
            <p className="text-xs text-text-muted max-w-sm mb-4 leading-relaxed">
              Construction operations platform for small and mid-sized contractors. Budgeting, Bill of Quantities, daily field logs, and payment applications in PKR and USD.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-text-subtle">
              <ShieldCheck className="w-4 h-4 text-accent shrink-0" />
              <span>Dedicated tenant database isolation & role barriers</span>
            </div>
          </div>

          {/* Product Modules */}
          <div>
            <div className="font-heading font-bold text-xs uppercase tracking-wider text-text mb-3">
              Features
            </div>
            <ul className="space-y-2">
              <li>
                <Link to="/features/estimating-and-boq" className="hover:text-text transition-colors">
                  Estimating & BOQ
                </Link>
              </li>
              <li>
                <Link to="/features/cost-control" className="hover:text-text transition-colors">
                  Cost Control & Budgeting
                </Link>
              </li>
              <li>
                <Link to="/features/procurement" className="hover:text-text transition-colors">
                  Procurement & POs
                </Link>
              </li>
              <li>
                <Link to="/features/field-logs" className="hover:text-text transition-colors">
                  Daily Field Logs
                </Link>
              </li>
              <li>
                <Link to="/features/subcontractors" className="hover:text-text transition-colors">
                  Subcontractor Portal
                </Link>
              </li>
              <li>
                <Link to="/features/billing-and-payments" className="hover:text-text transition-colors">
                  Billing & Payments
                </Link>
              </li>
              <li>
                <Link to="/features/change-orders" className="hover:text-text transition-colors">
                  Change Orders
                </Link>
              </li>
              <li>
                <Link to="/features/scheduling" className="hover:text-text transition-colors">
                  Scheduling & Phases
                </Link>
              </li>
              <li>
                <Link to="/features/documents" className="hover:text-text transition-colors">
                  Drawings & Submittals
                </Link>
              </li>
            </ul>
          </div>

          {/* Who It's For & Editions */}
          <div>
            <div className="font-heading font-bold text-xs uppercase tracking-wider text-text mb-3">
              Who It's For
            </div>
            <ul className="space-y-2 mb-6">
              <li>
                <Link to="/for/general-contractors" className="hover:text-text transition-colors">
                  General Contractors
                </Link>
              </li>
              <li>
                <Link to="/for/subcontractors" className="hover:text-text transition-colors">
                  Subcontractors
                </Link>
              </li>
              <li>
                <Link to="/for/project-owners" className="hover:text-text transition-colors">
                  Project Owners
                </Link>
              </li>
            </ul>

            <div className="font-heading font-bold text-xs uppercase tracking-wider text-text mb-2">
              Editions
            </div>
            <ul className="space-y-2">
              <li>
                <Link to="/construction-software-pakistan" className="hover:text-text transition-colors">
                  Pakistan (PKR)
                </Link>
              </li>
              <li>
                <Link to="/construction-software-us" className="hover:text-text transition-colors">
                  United States (USD)
                </Link>
              </li>
            </ul>
          </div>

          {/* Company & Legal */}
          <div>
            <div className="font-heading font-bold text-xs uppercase tracking-wider text-text mb-3">
              Company & Legal
            </div>
            <ul className="space-y-2">
              <li>
                <Link to="/pricing" className="hover:text-text transition-colors">
                  Pricing Plans
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-text transition-colors">
                  About SiteFlow
                </Link>
              </li>
              <li>
                <Link to="/security" className="hover:text-text transition-colors">
                  Security Architecture
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-text transition-colors">
                  Book a Demo / Contact
                </Link>
              </li>
              <li className="pt-2">
                <Link to="/privacy" className="hover:text-text transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-text transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="hover:text-text transition-colors">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Legal Disclaimer & Bottom Strip */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-text-subtle">
          <div>
            © 2026 SiteFlow. All rights reserved. Built for small and mid-sized contractors.
          </div>
          <div className="text-center md:text-right">
            Note: Legal policies published on this platform must be reviewed by qualified legal counsel prior to commercial launch.
          </div>
        </div>
      </div>
    </footer>
  );
};
