/**
 * Pricing Plans & Feature Matrix
 *
 * Prices come from the shared catalog (APPROVED_PRICING_V1) which is the
 * single source of truth for both the server entitlement checks and the
 * frontend display. No VITE_ env vars needed for pricing amounts.
 */

import { APPROVED_PRICING_V1 } from '@siteflow/shared';

function fmtUsd(n: number): string {
  return `$${n.toLocaleString()}`;
}

// Convenience: monthly prices from the catalog
const P = {
  starter:      APPROVED_PRICING_V1.starter.month,
  professional: APPROVED_PRICING_V1.professional.month,
  enterprise:   APPROVED_PRICING_V1.enterprise.month,
};

export interface PricingPlan {
  id: 'trial' | 'starter' | 'professional' | 'enterprise';
  name: string;
  badge?: string;
  target: string;
  priceMonthlyUSD: string;
  billingInterval: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;    // explicit href so pricing page CTA carries plan intent
  isPopular?: boolean;
  isContact?: boolean;
  isFree?: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'trial',
    name: 'Free Trial',
    badge: '14 Days',
    target: 'Experience Professional features risk-free before you commit.',
    priceMonthlyUSD: '$0',
    billingInterval: 'free for 14 days — no credit card required',
    features: [
      '2 active projects to test workflows',
      '5 team members with role-based access',
      'Full Professional feature set',
      'Complete procurement chain (MR → PO → receipt)',
      'Subcontractor management & retainage',
      'Change order approval workflow',
      'AIA payment applications',
      'Full cost control & financial summaries',
      'Conversational AI chat + specialized agents',
      'AI Assistant: 100,000 tokens',
      '5GB secure cloud storage',
      'Portfolio & executive summary reports',
      'CSV export',
    ],
    ctaLabel: 'Start free trial',
    ctaHref: '/register?plan=trial',
    isFree: true,
  },
  {
    id: 'starter',
    name: 'Starter',
    target: 'Essential project execution for smaller teams and specialized contractors.',
    priceMonthlyUSD: fmtUsd(P.starter.unitAmountUsd),
    billingInterval: 'per company / month (billed annually or monthly)',
    features: [
      '3 active construction projects',
      '10 team members with role-based access',
      'Project execution, estimating & BOQ',
      'Schedule tracking, tasks & baselines',
      'Daily mobile site logs & photo journal',
      'Submittals, RFIs, quality & safety',
      'Material delivery verification',
      'Suppliers & materials directories',
      'Basic project reports (health, schedule, cost)',
      'AI-powered document analysis & BOQ extraction',
      'AI Assistant: 100,000 tokens/month',
      '50GB secure cloud storage',
      'Email & chat customer support',
    ],
    ctaLabel: 'Get started',
    ctaHref: '/register?plan=starter',
    isPopular: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    badge: 'Most Popular',
    target: 'Comprehensive operations and multi-project coordination for growing contractors.',
    priceMonthlyUSD: fmtUsd(P.professional.unitAmountUsd),
    billingInterval: 'per company / month (billed annually or monthly)',
    features: [
      '15 active construction projects',
      '50 team members with advanced permissions',
      'All Starter features, plus:',
      '✦ Full procurement chain (MR → quote → approval → PO → receipt → inventory)',
      '✦ Subcontractor portal & retainage management',
      '✦ Change order approval workflow with photo audit',
      '✦ AIA G702/G703 payment applications with certified retainage',
      '✦ Full cost control: budget vs committed vs actual',
      '✦ Commercial & financial summary dashboards',
      '✦ Conversational AI chat for project insights',
      '✦ AI agents for cost analysis, schedule optimization & risk detection',
      '✦ Portfolio & executive summary reports',
      '✦ CSV export for all reports',
      'AI Assistant: 500,000 tokens/month',
      '250GB secure cloud storage',
      'Priority onboarding & telephone support',
    ],
    ctaLabel: 'Get started',
    ctaHref: '/register?plan=professional',
    isPopular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    target: 'Full-scale enterprise coordination with priority support and higher limits.',
    priceMonthlyUSD: fmtUsd(P.enterprise.unitAmountUsd),
    billingInterval: 'per company / month (custom annual agreements available)',
    features: [
      '100 active construction projects',
      '500 team members with enterprise-grade permissions',
      'All Professional features at scale',
      'Same feature set as Professional tier',
      'AI Assistant: 2,000,000 tokens/month',
      '1TB secure cloud storage',
      'Dedicated account manager & on-site staff training',
      'Custom database backup schedules',
      'Priority 24/7 support with 2-hour response SLA',
      'Custom annual agreements available',
    ],
    ctaLabel: 'Get started',
    ctaHref: '/register?plan=enterprise',
    isPopular: false,
    isContact: false,
  },
];

export const PRICING_FAQ = [
  {
    q: 'What happens after my free trial ends?',
    a: 'After 14 days, you can choose to subscribe to Starter, Professional, or Enterprise. If you don\'t subscribe, you\'ll have 3 days of grace period to export your data before access is restricted.',
  },
  {
    q: 'What features are restricted on Starter?',
    a: 'Starter excludes: full procurement chain (MR→PO→receipt), subcontractor management, change orders, payment applications, cost control summaries, conversational AI chat, and portfolio/executive reports. All other features (estimating, BOQ, site logs, RFIs, quality/safety, document analysis) are fully available.',
  },
  {
    q: 'How does AI token usage work?',
    a: 'AI tokens measure the amount of text processed by AI features (document analysis, chat, agents). Each plan includes a monthly token allowance. If you reach your limit, AI features pause until the next billing cycle. You can upgrade anytime for higher limits.',
  },
  {
    q: 'Can our subcontractors use SiteFlow without extra charges?',
    a: 'Yes. Subcontractors invited to submit work claims and view awarded line items do not count against your paid team seat limit.',
  },
  {
    q: 'What counts as an active project?',
    a: 'An active project is any job currently undergoing estimating, site execution, or billing. Completed and archived projects do not count toward your active limit.',
  },
  {
    q: 'Can we upgrade our plan midway through a project?',
    a: 'Yes. You can upgrade your plan at any time as your project volume grows, with immediate prorated adjustment. Downgrading is also possible but may restrict access to features that exceed lower-tier limits.',
  },
  {
    q: 'Is Enterprise just a bigger Professional plan?',
    a: 'Yes. Enterprise provides the same feature set as Professional but with significantly higher limits (100 projects, 500 members, 1TB storage, 2M AI tokens) plus dedicated support, SLA guarantees, and custom agreements.',
  },
];
