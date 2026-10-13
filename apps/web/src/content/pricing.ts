/**
 * Pricing Plans & Feature Matrix
 * Rules:
 * - Read plan names, features, and prices directly.
 * - Where a price is not finalized, display "Contact us" (never an invented number).
 * - Undecided pricing notes are documented at the bottom of this file.
 */

export interface PricingPlan {
  id: string;
  name: string;
  badge?: string;
  target: string;
  priceMonthlyPKR: string; // e.g., "PKR 45,000" or "Contact us"
  priceMonthlyUSD: string; // e.g., "$180" or "Contact us"
  billingInterval: string;
  features: string[];
  ctaLabel: string;
  isPopular?: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Builder Starter',
    target: 'For small residential builders and single-crew general contractors.',
    priceMonthlyPKR: 'PKR 35,000',
    priceMonthlyUSD: '$140',
    billingInterval: 'per company / month (billed annually or monthly)',
    features: [
      'Up to 3 active construction projects',
      'Unlimited Bill of Quantities (BOQ) line items',
      'Daily mobile site logs & photo journal',
      'Material delivery verification at gate',
      'Dual currency support (PKR or USD)',
      'Up to 5 team members (Site Supervisors & PMs)',
      'Email & WhatsApp customer support',
    ],
    ctaLabel: 'Start free trial',
    isPopular: false,
  },
  {
    id: 'growth',
    name: 'Contractor Pro',
    badge: 'Most Popular for General Contractors',
    target: 'For growing commercial and multi-site general contractors.',
    priceMonthlyPKR: 'PKR 85,000',
    priceMonthlyUSD: '$320',
    billingInterval: 'per company / month (billed annually or monthly)',
    features: [
      'Up to 12 active construction projects',
      'Full Budget vs Committed vs Actual cost engine',
      'Purchase Orders tied directly to cost codes',
      'Subcontractor portal & retainage management',
      'Interim payment certificates & WHT deductions',
      'Change order approval workflow with photo audit',
      'Up to 25 team members with role-based permissions',
      'Export to Excel & print-ready branded PDF reports',
      'Priority onboarding & telephone support',
    ],
    ctaLabel: 'Start free trial',
    isPopular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise Prime',
    target: 'For large commercial builders, infrastructure firms, and developers.',
    priceMonthlyPKR: 'Contact us', // Price to be decided by user
    priceMonthlyUSD: 'Contact us', // Price to be decided by user
    billingInterval: 'custom annual agreement',
    features: [
      'Unlimited active construction projects',
      'Unlimited team members and subcontractor seats',
      'Custom division cost code mapping (CSI MasterFormat)',
      'Multi-tenant branch management & consolidated reports',
      'Dedicated account manager & on-site staff training',
      'Custom database backup schedules & SLA guarantee',
      'Custom ERP & accounting integration assistance',
    ],
    ctaLabel: 'Contact sales',
    isPopular: false,
  },
];

export const PRICING_FAQ = [
  {
    q: 'Can our subcontractors use SiteFlow without extra charges?',
    a: 'Yes. Subcontractors invited to submit work claims and view awarded line items do not count against your paid team seat limit.',
  },
  {
    q: 'Can we switch between PKR and USD payment methods?',
    a: 'Yes. Pakistani companies can pay via local bank wire (IBAN) or credit card in PKR. International companies are billed in USD.',
  },
  {
    q: 'What counts as an active project?',
    a: 'An active project is any job currently undergoing estimating, site execution, or billing. Completed and archived projects do not count toward your active limit.',
  },
  {
    q: 'Can we upgrade our plan midway through a project?',
    a: 'Yes. You can upgrade your plan at any time as your project volume grows, with immediate prorated adjustment.',
  },
];

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * NOTE FOR FOUNDER / PRODUCT OWNER (Prices still to be decided):
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Enterprise Prime plan pricing (custom tier) needs final annual rate schedule.
 * 2. High-volume project add-ons (if a contractor needs 15+ projects on Builder Pro).
 * 3. Dedicated offline field server pricing for large mega-infrastructure sites.
 */
