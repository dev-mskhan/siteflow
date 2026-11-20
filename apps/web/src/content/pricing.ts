/**
 * Pricing Plans & Feature Matrix
 *
 * Prices are read from VITE_ environment variables so they can be changed
 * in .env without touching source code. The VITE_ prefix is required for
 * Vite to expose them to the browser bundle.
 *
 * To update prices: edit .env, then restart the dev server or rebuild.
 */

// Pull from env with numeric defaults matching catalog.schema.ts APPROVED_PRICING_V1
const env = import.meta.env;

const PRICES = {
  starter:      { usd: Number(env.VITE_PLAN_STARTER_PRICE_USD      ?? 199),  pkr: Number(env.VITE_PLAN_STARTER_PRICE_PKR      ?? 49700) },
  professional: { usd: Number(env.VITE_PLAN_PROFESSIONAL_PRICE_USD ?? 499),  pkr: Number(env.VITE_PLAN_PROFESSIONAL_PRICE_PKR ?? 124700) },
  enterprise:   { usd: Number(env.VITE_PLAN_ENTERPRISE_PRICE_USD   ?? 999),  pkr: Number(env.VITE_PLAN_ENTERPRISE_PRICE_PKR   ?? 249700) },
};

function fmt(n: number, currency: 'USD' | 'PKR'): string {
  if (currency === 'USD') return `$${n.toLocaleString()}`;
  return `PKR ${n.toLocaleString()}`;
}

export interface PricingPlan {
  id: 'starter' | 'professional' | 'enterprise';
  name: string;
  badge?: string;
  target: string;
  priceMonthlyPKR: string;
  priceMonthlyUSD: string;
  billingInterval: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;    // NEW: explicit href so pricing page CTA carries plan intent
  isPopular?: boolean;
  isContact?: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    target: 'Essential construction management for smaller teams and specialized contractors.',
    priceMonthlyPKR: fmt(PRICES.starter.pkr, 'PKR'),
    priceMonthlyUSD: fmt(PRICES.starter.usd, 'USD'),
    billingInterval: 'per company / month (billed annually or monthly)',
    features: [
      'Up to 3 active construction projects',
      'Up to 10 team members with role-based access',
      'Unlimited Bill of Quantities (BOQ) line items',
      'Daily mobile site logs & photo journal',
      'Material delivery verification at gate',
      'AI Assistant: 100,000 tokens/month',
      'AI-powered document analysis & BOQ extraction',
      'Dual currency support (PKR or USD)',
      '50GB secure cloud storage',
      'Email & WhatsApp customer support',
    ],
    ctaLabel: 'Start free trial',
    ctaHref: '/register?plan=starter',
    isPopular: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    badge: 'Most Popular',
    target: 'Comprehensive operations and multi-project coordination for growing contractors.',
    priceMonthlyPKR: fmt(PRICES.professional.pkr, 'PKR'),
    priceMonthlyUSD: fmt(PRICES.professional.usd, 'USD'),
    billingInterval: 'per company / month (billed annually or monthly)',
    features: [
      'Up to 15 active construction projects',
      'Up to 50 team members with advanced permissions',
      'Full Budget vs Committed vs Actual cost engine',
      'Purchase Orders tied directly to cost codes',
      'Subcontractor portal & retainage management',
      'AI Assistant: 500,000 tokens/month',
      'AI agents for cost analysis, schedule optimization & risk detection',
      'Conversational AI chat for project insights',
      'Interim payment certificates & WHT deductions',
      'Change order approval workflow with photo audit',
      '250GB secure cloud storage',
      'Export to Excel & print-ready branded PDF reports',
      'Priority onboarding & telephone support',
    ],
    ctaLabel: 'Start free trial',
    ctaHref: '/register?plan=professional',
    isPopular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    target: 'Full-scale enterprise coordination, custom integrations, and portfolio visibility.',
    priceMonthlyPKR: fmt(PRICES.enterprise.pkr, 'PKR'),
    priceMonthlyUSD: fmt(PRICES.enterprise.usd, 'USD'),
    billingInterval: 'per company / month (custom annual agreements available)',
    features: [
      'Up to 100 active construction projects',
      'Up to 500 team members with enterprise-grade permissions',
      'AI Assistant: 2,000,000 tokens/month',
      'Custom AI agent training on your project data',
      'Advanced AI workflow automation & approval routing',
      'AI-powered predictive analytics & forecasting',
      'Custom division cost code mapping (CSI MasterFormat)',
      'Multi-tenant branch management & consolidated reports',
      '1TB secure cloud storage',
      'Dedicated account manager & on-site staff training',
      'Custom database backup schedules & SLA guarantee',
      'Custom ERP & accounting integration assistance',
      'Priority 24/7 support with 2-hour response SLA',
    ],
    ctaLabel: 'Contact sales',
    ctaHref: '/contact?plan=enterprise',
    isPopular: false,
    isContact: true,
  },
];

export const PRICING_FAQ = [
  {
    q: 'How does AI token usage work?',
    a: 'AI tokens measure the amount of text processed by AI features (document analysis, chat, agents). Each plan includes a monthly token allowance. If you reach your limit, AI features pause until the next billing cycle. You can upgrade anytime for higher limits.',
  },
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
  {
    q: 'What AI features are included in each plan?',
    a: 'All plans include AI-powered document analysis and BOQ extraction. Professional adds conversational AI chat and specialized agents for cost, schedule, and risk analysis. Enterprise includes custom AI training, advanced automation, and predictive analytics.',
  },
];
