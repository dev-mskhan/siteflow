import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../ui/Logo';

const groups = [
  {
    heading: 'Product',
    links: [
      ['Features', '/features'],
      ['Pricing', '/pricing'],
      ['Security', '/security'],
    ],
  },
  {
    heading: 'For teams',
    links: [
      ['General contractors', '/for/general-contractors'],
      ['Subcontractors', '/for/subcontractors'],
      ['Project owners', '/for/project-owners'],
    ],
  },
  {
    heading: 'Company',
    links: [
      ['About', '/about'],
      ['Contact', '/contact'],
      ['Pakistan edition', '/construction-software-pakistan'],
      ['United States', '/construction-software-us'],
    ],
  },
];

const legalLinks = [
  ['Privacy', '/privacy'],
  ['Terms', '/terms'],
  ['Cookies', '/cookies'],
];

export const Footer: React.FC = () => (
  <footer className="border-t border-[var(--hairline)] bg-[var(--surface)]">
    {/* Main body */}
    <div className="mx-auto grid w-full max-w-[1320px] gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[1.4fr_2fr] lg:px-12 lg:py-20">
      <div>
        <Link to="/" aria-label="SiteFlow home">
          <Logo size="lg" />
        </Link>
        <p className="mt-6 max-w-sm text-sm leading-6 text-[var(--muted)]">
          One operating record for construction teams — from the first quantity takeoff to the final
          payment release.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
        {groups.map((group) => (
          <div key={group.heading}>
            <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
              {group.heading}
            </h2>
            <ul className="mt-5 space-y-3">
              {group.links.map(([label, href]) => (
                <li key={href}>
                  <Link to={href} className="text-sm transition-opacity hover:opacity-55">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>

    {/* Bottom bar */}
    <div className="border-t border-[var(--hairline)]">
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-center gap-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            © 2026 SiteFlow
          </span>
          {legalLinks.map(([label, href]) => (
            <Link
              key={href}
              to={href}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] transition-opacity hover:opacity-55"
            >
              {label}
            </Link>
          ))}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
          PKR / USD ready
        </span>
      </div>
    </div>
  </footer>
);
