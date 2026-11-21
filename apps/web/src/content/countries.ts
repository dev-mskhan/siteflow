export interface CountryFeatureItem {
  title: string;
  description: string;
}

export interface CountryContent {
  slug: string;
  title: string;
  badge: string;
  headline: string;
  supportingSentence: string;
  problem: string;
  currencyCode: 'USD';
  units: string[];
  localStandards: CountryFeatureItem[];
  faqs: { question: string; answer: string }[];
}

export const COUNTRIES_DATA: Record<string, CountryContent> = {
  'construction-software-us': {
    slug: 'construction-software-us',
    title: 'Commercial Construction Software US',
    badge: 'United States Edition (USD)',
    headline: 'Manage commercial projects with AIA-style billing and 10% retainage',
    supportingSentence: 'Designed for small and mid-sized general contractors in the United States. Control job costing, purchase orders, subcontractor compliance, and progress billing.',
    problem: 'US general contractors are forced to choose between enterprise software that costs $40,000 annually with 6-month onboarding, or basic spreadsheets that fail to track committed purchase orders and retainage pools accurately.',
    currencyCode: 'USD',
    units: ['Square Feet (SqFt)', 'Square Yards (SqYd)', 'Linear Feet (LF)', 'Cubic Yards (CY)', 'Tons'],
    localStandards: [
      {
        title: 'AIA-Style G702 / G703 progress applications',
        description: 'Generate standardized payment applications with schedule of values continuation sheets, certified work completed, and automated retainage escrow withholding.',
      },
      {
        title: 'CSI MasterFormat division cost coding',
        description: 'Structure Bill of Quantities and job cost codes using standard 16 or 50 CSI MasterFormat divisions (e.g., Division 03 Concrete, Division 05 Metals).',
      },
      {
        title: 'Subcontractor lien waiver tracking',
        description: 'Track conditional and unconditional lien waivers alongside certified payroll reports before releasing progress draws.',
      },
      {
        title: 'Dual commitment accounting',
        description: 'Maintain strict separation between contracted budget, committed purchase order obligations, actual cleared invoices, and projected cost at completion.',
      },
    ],
    faqs: [
      {
        question: 'Can we export data directly to QuickBooks or Sage?',
        answer: 'Yes. Approved purchasing summaries, vendor bills, and progress billing certificates export cleanly to CSV and Excel for direct accounting import.',
      },
      {
        question: 'Does SiteFlow support standard 10% and 5% retainage rules?',
        answer: 'Yes. Retainage percentage is configurable per trade subcontract and automatically deducted from every progress billing cycle until final punch list sign-off.',
      },
      {
        question: 'Can subcontractors submit their own payment applications online?',
        answer: 'Yes. Subcontractors receive secure access to their awarded line items where they can enter completed percentages and attach inspection photos without extra license fees.',
      },
    ],
  },
};
